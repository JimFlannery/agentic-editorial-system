# AgenticES — Architecture & Design Principles

> **Status:** Living document. This describes the principles AgenticES is being built toward, not a snapshot of current implementation. When the code and this document disagree, this document is the direction of travel.

## Purpose

This document captures the design principles that govern AgenticES architectural decisions. It is intended for three audiences:

- **Contributors** — to understand why the abstractions are shaped the way they are, and what constraints new code is expected to honor.
- **Partners and integrators** — to understand deployment options, interoperability commitments, and what AgenticES will and will not depend on.
- **Funders and supporters** — to understand the sustainability story, the project's posture toward proprietary dependencies, and the alignment with open infrastructure principles.

The principles below are binding, not aspirational. When a proposed feature, integration, or shortcut would violate one of these principles, the principle wins; the feature gets redesigned or deferred.

---

## 1. Core Design Principles

### 1.1 Open infrastructure, not just open source

AgenticES is being built to function as scholarly communication infrastructure, not as a product with an open-source license attached. The distinction matters. Open infrastructure means: governance is transparent, the codebase has no proprietary dependencies that hold the community hostage, the data is portable on terms the community controls, and the project's sustainability does not depend on the goodwill of any single commercial provider.

This commitment is intended to align with the [Principles of Open Scholarly Infrastructure (POSI)](https://openscholarlyinfrastructure.org/) — succession planning, transparent governance, no proprietary IP holding the community hostage, sustainable funding. Formal POSI signatory status is a target as the project matures.

### 1.2 The property graph is the substrate

Every meaningful relationship in scholarly communication is a graph relationship: who contributed what, who reviewed what, what was decided, what was changed, what was cited, what was discussed, what was retracted, what was replicated. Modeled correctly, these form a single coherent dataset that any number of overlay services can run against — a curated journal, a replication tracker, a retraction monitor, a discussion thread, a recommendation engine, a discovery interface.

The property graph is not an implementation detail. It is the architectural substrate that lets the project's planned ecosystem — editorial workflow, production pipeline, identity layer, community layer — share a common foundation. Schema decisions in the graph are foundational and expensive to refactor later. New features that introduce data models outside the graph need explicit justification.

### 1.3 AI provider independence is non-negotiable

A commons infrastructure project that depends on a single proprietary AI provider has reproduced, in miniature, the publisher dependency the project is meant to solve. The architecture must treat the model provider as a swappable component, not a foundational assumption.

In practice this means:

- The codebase must not import or reference any single AI provider's SDK in a way that makes substitution hard.
- A clean provider interface (or a library like [LiteLLM](https://github.com/BerriAI/litellm) that provides one) must mediate every model call.
- Sensible defaults are fine; hard-coded provider choices are not.
- The system must be operable end-to-end with at least two distinct provider configurations: a frontier API tier and a local open-weight tier. If a workflow only works with one provider, that workflow is incomplete.

This principle does not mean every task must run on every model. It means the project does not get held hostage by any one provider's pricing, availability, or terms of service.

### 1.4 Configuration over code for variable concerns

Things that change on a different cadence than the core codebase should live in configuration, not code. This includes:

- Model selection per task and tier
- Prompt templates and their versioning
- Provider endpoints, credentials, and rate limits
- Routing rules and fallback chains
- Standards-conformance rules (JATS validation, reference style, etc.)
- Per-tenant policy (data residency, model restrictions, opt-outs)

The test: a deployment operator should be able to swap a routine-task model from one open-weight model to another, or shift a task from cloud to local inference, without recompiling or modifying code. If a change requires a code release, it probably belongs in configuration.

### 1.5 Local inference is a first-class deployment target

The trajectory of open-weight model quality, the compression of inference costs, and the maturation of platforms like the AMD Ryzen AI MAX+ 395 (Strix Halo) make local AI a near-term reality, not a long-term aspiration. A small society could plausibly run an entire journal's editorial workflow on a single workstation-class machine within the lifetime of this project.

AgenticES treats local inference as a first-class target, not a fallback:

- Workflows that depend on cloud-only features (long context windows, frontier reasoning capability, specific tool-use patterns unique to one provider) must be explicitly flagged and have a documented degradation path.
- The reference deployment configurations include a fully local mode that runs end-to-end without external API calls.
- Performance and quality are benchmarked across cloud and local configurations as part of the evaluation infrastructure (see section 3.5).

The [DreamServer](https://github.com/Light-Heart-Labs/DreamServer) project is one likely deployment substrate for the local tier — Apache 2.0 licensed, supports both NVIDIA and AMD Strix Halo, ships with LiteLLM as its API gateway, has explicit `local | cloud | hybrid` modes, and uses a manifest-based extension system. AgenticES may eventually ship as a DreamServer extension for the on-premise tier; the design philosophies are aligned.

### 1.6 Standards alignment before custom protocols

When a published standard exists for what AgenticES needs to do, the project uses the standard rather than inventing a new one. This is true even when the standard is imperfect. Custom protocols create integration costs for everyone the project hopes will adopt or interoperate with it.

Initial standards commitments:

- **JATS** (NLM/NISO Journal Article Tag Suite) for article XML
- **Crossref** schemas for DOI registration and metadata
- **ORCID** for author identity, **ROR** for institutional identity
- **COUNTER** for usage reporting
- **OAI-PMH** and **ResourceSync** for metadata harvesting
- **JATS4R** recommendations for JATS conformance
- **DOCMaps** for editorial process metadata
- **COAR Notify** for inter-repository communication
- **W3C Verifiable Credentials** and **DIDs** for the planned identity layer

When a standard does not exist for what AgenticES needs, the preference is to publish a draft specification openly and engage with relevant standards bodies (NISO, W3C, ORCID, ROR, COAR, OASPA) rather than ship a closed protocol.

### 1.7 Confidentiality is architectural, not a policy

Editorial systems handle sensitive content: unpublished manuscripts, confidential reviews, embargoed findings, identity verification context. "We promise not to look" is not an architecture. The system must support deployments in which sensitive content never leaves the customer's infrastructure, and must support per-task policy that routes sensitive operations to local inference even when cloud inference would be cheaper or faster.

This is not a feature flag. It is a constraint on every workflow that touches sensitive data: the workflow must have a documented confidentiality posture, and the deployment must be able to enforce it.

---

## 2. Architecture Overview

### 2.1 The property graph layer

The graph captures entities (manuscripts, contributors, reviews, decisions, versions, citations, discussions) and the relationships between them. The schema is intentionally extensible — new entity and relationship types can be added without invalidating existing data — but extensions to the schema require review because the graph is the substrate the rest of the system runs on.

The graph is the source of truth. Materialized views, search indexes, and other derived data structures are rebuildable from the graph; the inverse is not true.

### 2.2 The agentic workflow layer

Workflows are composed of tasks. A task is a unit of work that takes structured input, optionally calls a language model, and produces structured output that gets written back to the graph. Tasks are the unit of routing: each task declares what kind of model capability it needs, and the routing layer matches it to an appropriate provider.

Tasks are intended to be:

- **Idempotent where possible** — re-running a task on the same input should produce equivalent output.
- **Composable** — workflows are sequences and dependencies of tasks, not monolithic prompts.
- **Observable** — every task execution produces a record (inputs, outputs, model used, cost, latency, evaluation results) that lives in the graph.

### 2.3 The provider abstraction layer

A provider is anything that can fulfill a model call: a frontier API (Claude, GPT, Gemini), a hosted open-weight inference service (Together, Anyscale, Fireworks), a self-hosted inference server (vLLM, llama.cpp, Ollama, llama-server via DreamServer), or a future provider that does not yet exist.

The provider interface is small and capability-focused:

- What context window does this provider support?
- What modalities (text, images, structured output, tool use)?
- What is the latency profile?
- What is the cost profile?
- What confidentiality guarantees does this provider make?
- What is the provider's availability?

Tasks declare requirements; providers declare capabilities; the routing layer matches them.

### 2.4 Task routing

Routing decisions are policy, not code. The routing layer reads:

- The task's declared requirements (capability, confidentiality, latency budget)
- The deployment's policy (which providers are available, which are preferred, which are restricted)
- The current state of providers (availability, cost, observed quality on this task type)

And produces a provider selection. The routing layer is responsible for fallback chains, retry behavior, and graceful degradation when preferred providers are unavailable.

The default routing taxonomy, intended as a starting point that deployments can override:

| Tier | Task examples | Typical providers |
|------|--------------|-------------------|
| Frontier | Decision letter synthesis, integrity screening, manuscript-vs-version-of-record diffs, sophisticated paper-mill detection | Claude, GPT-class frontier APIs, possibly Anthropic via Bedrock |
| Mid | Reviewer comment categorization, structured summary generation, format normalization with judgment | 30B–70B class open-weight models (Qwen, Llama, Mistral lines), or smaller frontier models |
| Routine | Reference format normalization, metadata extraction, JATS conformance checking, deterministic transformations | 7B–14B class open-weight models, or rule-based pipelines where appropriate |

These tiers are configuration, not architecture. Migrating tasks between tiers as model quality changes is expected and supported.

### 2.5 The standards interface

The system exposes its content through standard formats wherever standards exist. JATS XML for articles, Crossref-compatible metadata for citations, ORCID-aware author records, COUNTER usage data, OAI-PMH endpoints for harvesting. Custom APIs exist for things standards do not cover, but the standards interface is the primary integration surface for external systems.

---

## 3. Multi-Provider Inference

### 3.1 The provider interface

Concretely, a provider implementation must:

- Accept a normalized request format (messages, tools, parameters) and produce a normalized response.
- Report its capabilities (modalities, max context, supported features) so the routing layer can match tasks.
- Surface cost and latency telemetry per call.
- Honor confidentiality assertions — providers that cannot make a given confidentiality guarantee must not advertise it.

The current intention is to use [LiteLLM](https://github.com/BerriAI/litellm) as the underlying abstraction for cloud and self-hosted-OpenAI-compatible providers, with custom adapters where LiteLLM does not cover the case. This may change; the principle is that there is a single abstraction point for model calls, regardless of the implementation underneath.

### 3.2 Cloud, hybrid, and local modes

Three reference deployment modes:

- **Cloud mode** — all model calls go to cloud providers. Lowest operational overhead, highest dependency on external services, highest per-call costs at scale, weakest confidentiality guarantees.
- **Hybrid mode** — frontier-required tasks go to cloud providers; mid and routine tasks go to local inference. Balanced cost and capability, moderate operational complexity, stronger confidentiality for the bulk of operations.
- **Local mode** — all model calls go to local inference, with frontier-tier tasks running on the largest local model available (typically a 70B-class model on appropriate hardware). Highest operational complexity, strongest confidentiality, lowest external dependency.

These are not presets so much as named points on a continuum. A deployment can route any task to any provider per its policy.

### 3.3 Compatibility with DreamServer

For on-premise and small-society deployments, DreamServer is a strong candidate substrate:

- Apache 2.0 licensed and actively maintained
- One-command install with hardware auto-detection (NVIDIA and AMD Strix Halo)
- Ships with LiteLLM as the API gateway, which is the same abstraction AgenticES is targeting
- Has explicit `local | cloud | hybrid` modes that map to AgenticES routing modes
- Manifest-based extension system that AgenticES could ship into

The intended path is that AgenticES on a DreamServer deployment uses DreamServer's LiteLLM instance as its provider abstraction, inheriting the hardware detection, model selection, and lifecycle management that DreamServer already does well. Implementation details to be worked out with the DreamServer team.

### 3.4 Evaluation infrastructure

Routing decisions require measurement. The project maintains an evaluation harness with:

- Golden examples for each major task type, drawn from real editorial workflows where possible.
- Continuous evaluation across multiple provider configurations.
- Quality metrics appropriate to each task (structured output validity, semantic agreement with reference outputs, human review on a sample).
- Cost and latency telemetry alongside quality metrics.

Evaluation is build-it-once infrastructure that pays off across all stages of the project. New tasks are expected to come with at least a small evaluation set before they go into production routing.

---

## 4. Deployment Tiers

AgenticES is intended to support a spectrum of deployment options, recognizing that different customers have different constraints:

| Tier | Description | Typical customer |
|------|-------------|------------------|
| **Hosted SaaS** | Multi-tenant deployment operated by AgenticES Services. Cloud or hybrid inference. | Small societies, OA publishers, university press programs without IT capacity |
| **Hybrid managed** | Single-tenant cloud deployment with optional on-premise components for sensitive workloads | Mid-size publishers, society publishers with confidentiality requirements |
| **Managed on-premise** | Hardware appliance (likely DreamServer-based) operated by AgenticES Services inside the customer's facility | Customers with strict data residency, embargoed content, or institutional policy requirements |
| **Self-hosted** | Customer takes the open-source code and runs it entirely themselves | Customers with strong internal IT, customers who prefer not to depend on AgenticES Services, contributors to the project |

These tiers are not architectural variants. The same codebase runs in all four; the difference is operational ownership and deployment topology. Workflows that work in cloud SaaS must also work, possibly with degraded or different routing, in self-hosted local deployments.

---

## 5. License and Governance Posture

### 5.1 License

The current intention is to license the core AgenticES platform under **AGPL-3.0** or a similarly strong copyleft license. Rationale:

- Strong copyleft prevents proprietary forks that would extract value from the commons without contributing back.
- AGPL specifically extends copyleft to network-deployed services, which is the relevant deployment model for scholarly infrastructure.
- Mastodon, MongoDB (formerly), and other infrastructure projects with successful community ecosystems have used AGPL successfully.

Specific tools, libraries, or extensions may use other open-source licenses where appropriate (Apache 2.0 for libraries intended for broad embedding, MIT for small utilities).

### 5.2 Patents

The AgenticES codebase will not be the basis for software patent prosecution. Defensibility in this domain comes from network effects on the verified-identity graph, switching costs on editorial workflows, ecosystem of integrations, governance legitimacy, and execution speed — not from patents. Patents would actively harm the project's ability to align with open infrastructure principles and would alienate the open-source community the project depends on.

### 5.3 Governance

The project is intended to operate under a foundation structure once it reaches the scale that justifies the overhead. The interim path is fiscal sponsorship under an organization like Code for Science & Society or NumFOCUS. Governance documentation will be published as the structure is formalized.

Commercial services — hosting, KYC-as-a-service, enterprise integrations, managed on-premise deployments — are expected to operate through a separate entity (likely a wholly-owned subsidiary of the foundation, patterned after the Mozilla Foundation / Mozilla Corporation structure). The core platform code lives under foundation governance; commercial services around it operate under normal-business governance with surplus flowing back to the foundation.

---

## 6. What This Architecture Is Not

To avoid ambiguity, a few things AgenticES is explicitly not:

- **Not a wrapper around a single AI provider.** Provider independence is non-negotiable (1.3).
- **Not a hosted-only service.** Local and on-premise deployments are first-class (1.5, section 4).
- **Not a closed platform.** Standards alignment is preferred over custom protocols (1.6).
- **Not a venture-economics business.** The project structure is foundation-bound; the commercial services entity exists to sustain the commons, not to extract from it.
- **Not a competitor to existing open scholarly infrastructure** like PKP, Crossref, ORCID, ROR, COAR, or DOAJ. AgenticES integrates with these, contributes back where relevant, and avoids duplicating their work. Where AgenticES overlaps with another project's scope (for example, OJS for editorial workflow), the intended posture is collaborative — explore integration, fork-and-contribute-back, or interoperability before competition.

---

## 7. Open Decisions

This document does not commit on the following yet. Each is being actively considered:

- **Graph storage backend.** Property graph databases (Neo4j, Memgraph, ArangoDB) versus graph-on-relational (PostgreSQL with Apache AGE, or a custom layer over SQLite/Postgres). The decision criteria are local-deployment friendliness, license compatibility, and operational simplicity for small deployments.
- **Provider abstraction implementation.** LiteLLM versus a custom abstraction. LiteLLM is the leading candidate; the open question is whether its abstractions are sufficient for AgenticES's needs or whether a thin custom layer is warranted.
- **Frontend architecture.** Editor UI, dashboard, reviewer interface, and admin tooling are likely to share a frontend stack. The choice of stack and the degree to which the frontend is customizable per-tenant is unresolved.
- **Identity layer integration timing.** The identity layer (KYC, verifiable credentials, contribution provenance) is planned but not yet integrated. The architectural hooks for it should be present from early in the codebase, but the implementation depends on standards work that is still maturing.
- **JATS production pipeline integration.** Whether the production pipeline (manuscript → JATS XML → HTML/PDF) lives in the same codebase as the editorial workflow or in a sister project that integrates via the graph and standards interfaces.

These will be resolved through normal project decision-making. RFC-style design documents for major decisions are encouraged and will be archived in `docs/decisions/` as they are produced.

---

## 8. Document History

This document is versioned with the codebase. Substantive changes to architectural principles require a pull request and review by maintainers. The intent is for the principles to be stable; the implementation guidance below them can evolve more freely.

---

*Maintainer notes: When introducing a new feature, integration, or architectural change, reference this document to verify alignment with the principles. When a proposed change conflicts with a principle, the conflict should be raised explicitly — either the change is reshaped to align, the principle is amended through documented review, or the change is deferred.*
