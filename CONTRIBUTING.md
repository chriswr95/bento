# Contributing to Bento

Use Node.js 22.13+ (CI uses Node 24) and the pinned pnpm version in `package.json`.
Run `pnpm install --frozen-lockfile`; desktop setup is described in [README](README.md).

## Before committing

- Keep commits focused and self-contained. Follow [AGENTS.md](AGENTS.md).
- Run `pnpm lint` for JavaScript and Markdown correctness, then `pnpm test`.
- Run browser or desktop workflows when the affected behavior needs them; see the [test plan](docs/testing.md). Desktop tests run hidden by default.
- Review `git diff --check` and the staged diff. Keep generated bundles, secrets and local workspace data out of commits.
- Update the spec for product behavior and the design doc for implementation decisions.

ESLint uses the recommended rules with browser, Node and CommonJS contexts. Markdownlint checks documentation, examples and templates; frontmatter titles are metadata, not an extra heading. Long prose lines, intentional embedded HTML and table column alignment are allowed. Generated editor bundles and build/output folders are excluded. EditorConfig and Git attributes keep source files in UTF-8 with LF endings; Markdown hard line breaks are preserved.

Keep source changes readable and limited to the task. A repository-wide formatter migration should be a separate change with no behavior edits.

## Dependency maintenance

Commit `package.json` and `pnpm-lock.yaml` together. Pin direct dependencies and review updates rather than merging them automatically. Run `pnpm outdated` and `pnpm audit` during dependency reviews; assess findings before changing packages.

Dependabot proposes weekly grouped GitHub Actions updates. Its [documented pnpm support](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) currently stops at v10, so pnpm 11 package updates remain manual until support is available. Enable npm-ecosystem updates only after verifying compatibility with this repository's pinned package manager.

The CI hygiene, unit, native and browser workflows should pass before a change is adopted. If PR-based collaboration starts, protect `main` with required checks and review; repository protection settings are managed on GitHub rather than by this file.
