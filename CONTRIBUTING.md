# Contributing to AgenticES

Thank you for your interest in contributing to AgenticES. This document describes how to contribute effectively and what to expect from the process.

## License

AgenticES is released under the GNU Affero General Public License, version 3 (AGPL-3.0-or-later). All contributions to this repository are licensed under AGPL-3.0-or-later when included in releases. See the [LICENSE](./LICENSE) file for the full text.

## Contributor License Agreement

Before your first contribution can be merged, you will be asked to sign our Contributor License Agreement (CLA). The CLA is automatically presented as a comment on your first pull request, with a one-click signing link.

### What the CLA does

- You **retain copyright** in your contributions. You do not transfer ownership of your code.
- You grant the AgenticES project a broad, perpetual, royalty-free license to use, modify, distribute, and sublicense your contributions.
- This grant gives the project the rights it needs to enforce the AGPL license against violators and to manage the codebase responsibly over time.
- It also preserves the project's ability to transfer stewardship to the AgenticES nonprofit foundation once it is formed (see below).

### What the CLA does not do

- It does not restrict what you can do with your own code. You are free to use your contributions in your own projects, license them differently elsewhere, or fork AgenticES.
- It does not impose ongoing obligations after you sign. You sign once; future contributions are covered.
- It does not change what downstream users receive. AgenticES remains AGPL.

### Interim stewardship

AgenticES is currently steered by Frontier Stream, Inc. (a Delaware corporation) while a 501(c)(3) nonprofit foundation and a wholly-owned subsidiary LLC are being formed to hold the project long-term. The CLA grants rights to Frontier Stream, Inc. with an explicit forward-assignment clause covering any successor entity in that structure. All entities share the same founders. You consent to that assignment in advance when you sign. No action from contributors is required at the time of any such transition.

This arrangement is documented in the CLA text and in the project's [ARCHITECTURE.md](./ARCHITECTURE.md).

### Individual and corporate CLAs

- If you are contributing on your own behalf, sign the **Individual CLA**.
- If you are contributing as part of your employment or on behalf of a company, your employer may need to sign the **Corporate CLA**. The CLA bot will guide you through determining which applies.
- If you are unsure whether your employer holds rights to your contribution, please consult your employment agreement or your employer's policies before signing.

The CLA texts are in the [/CLA/](./CLA/) directory of this repository.

## How to contribute

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes. Include tests where applicable.
4. Ensure existing tests pass: `npm test`
5. Open a pull request against the `main` branch.
6. The CLA bot will prompt you to sign if you have not already done so.
7. A maintainer will review your PR. Expect feedback and revisions.

## Code style

- TypeScript throughout; no `any` without a comment explaining why.
- Tailwind utility classes directly in JSX — no separate CSS files for component styles.
- Use the `cn()` helper from `@/lib/utils` for conditional class merging.
- Follow the conventions in [CLAUDE.md](./CLAUDE.md) for stack-specific patterns.

## Code of conduct

All participation in the AgenticES project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to its terms.

## Questions

If you have questions about contributing, the CLA, or anything else, open a Discussion in the GitHub repository.
