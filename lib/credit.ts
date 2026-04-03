/**
 * Contributor Role Taxonomy (CRediT) — https://credit.niso.org/
 *
 * 14 standardised roles for attributing contributions to scholarly publications.
 * Journals can enable CRediT attribution per-journal via the
 * `credit_taxonomy_enabled` key in manuscript.journal_settings.
 */

export interface CreditRole {
  /** URL-safe slug — stored in manuscript.credit_contributions.credit_role */
  slug: string
  /** Display label as defined by the NISO CRediT standard */
  label: string
  /** Official definition */
  definition: string
}

export const CREDIT_ROLES: CreditRole[] = [
  {
    slug: "conceptualization",
    label: "Conceptualization",
    definition:
      "Ideas; formulation or evolution of overarching research goals and aims.",
  },
  {
    slug: "data-curation",
    label: "Data Curation",
    definition:
      "Management activities to annotate (produce metadata), scrub data and maintain research data (including software code, where it is necessary for interpreting the data itself) for initial use and later re-use.",
  },
  {
    slug: "formal-analysis",
    label: "Formal Analysis",
    definition:
      "Application of statistical, mathematical, computational, or other formal techniques to analyse or synthesize study data.",
  },
  {
    slug: "funding-acquisition",
    label: "Funding Acquisition",
    definition:
      "Acquisition of the financial support for the project leading to this publication.",
  },
  {
    slug: "investigation",
    label: "Investigation",
    definition:
      "Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection.",
  },
  {
    slug: "methodology",
    label: "Methodology",
    definition:
      "Development or design of methodology; creation of models.",
  },
  {
    slug: "project-administration",
    label: "Project Administration",
    definition:
      "Management and coordination responsibility for the research activity planning and execution.",
  },
  {
    slug: "resources",
    label: "Resources",
    definition:
      "Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools.",
  },
  {
    slug: "software",
    label: "Software",
    definition:
      "Programming, software development; designing computer programs; implementation of the computer code and supporting algorithms; testing of existing code components.",
  },
  {
    slug: "supervision",
    label: "Supervision",
    definition:
      "Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team.",
  },
  {
    slug: "validation",
    label: "Validation",
    definition:
      "Verification, whether as a part of the activity or separate, of the overall replication/reproducibility of results/experiments and other research outputs.",
  },
  {
    slug: "visualization",
    label: "Visualization",
    definition:
      "Preparation, creation and/or presentation of the published work, specifically visualization/data presentation.",
  },
  {
    slug: "writing-original-draft",
    label: "Writing – original draft",
    definition:
      "Preparation, creation and/or presentation of the published work, specifically writing the initial draft (including substantive translation).",
  },
  {
    slug: "writing-review-editing",
    label: "Writing – review & editing",
    definition:
      "Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision – including pre- or post-publication stages.",
  },
]

export const CREDIT_ROLE_SLUGS = CREDIT_ROLES.map((r) => r.slug)

export const CREDIT_DEGREE_OPTIONS = [
  { value: "lead",       label: "Lead" },
  { value: "equal",      label: "Equal" },
  { value: "supporting", label: "Supporting" },
] as const

export type CreditDegree = "lead" | "equal" | "supporting"
