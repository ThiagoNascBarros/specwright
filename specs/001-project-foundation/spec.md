# Feature Specification: Project foundation (repository, structure, build, CI)

**Feature Branch**: `feature/SW-1-project-foundation`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `project-foundation`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project foundation (repository, structure, build, CI) (Priority: P1)

First spec of the [Roadmap](../../docs/03-roadmap.md). It creates the base on which the following specs are developed with TDD: the repository, the folder structure from TRD §3, the build, the CI and an MCP server that starts over stdio, still with no tools. Requirements met: NFR-9 (portability) and the base of NFR-10 (test suite and verification gate).

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-009 (AC-1 to AC-9 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The private repository `ThiagoNascBarros/specwright` exists on GitHub (was AC-1)
- **FR-002**: `npm ci && npm run build` finishes with exit code 0 and generates `dist/index.js` starting with `#!/usr/bin/env node` (was AC-2)
- **FR-003**: `npm run typecheck` finishes with exit code 0, with `strict: true` in `tsconfig.json` (was AC-3)
- **FR-004**: The contract test starts `node dist/index.js` over stdio with the SDK client and receives `serverInfo.name === "specwright"` and `serverInfo.version` equal to the `version` of `package.json` (was AC-4)
- **FR-005**: The contract test confirms that the server exposes zero tools: `listTools` returns an empty list, or the server does not announce the `tools` capability (was AC-5)
- **FR-006**: All folders and files listed under "Requirements" exist, and `package.json` declares exactly the dependencies of TRD §2 (was AC-6)
- **FR-007**: `README.md` exists with 0 bytes (was AC-7)
- **FR-008**: The GitHub Actions CI runs green on Node 22 and 24 in this spec's PR (was AC-8)
- **FR-009**: `main` receives this spec through a PR, with the merge done after the CI is green. Since the repository is empty, `main` is born from an initial commit that contains only the empty `README.md`, and the PR starts from it. (was AC-9)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 9 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: MCP tools, `config.ts`, `errors.ts`, `storage/*` (spec 2 `spec-reading`)
- Out of scope: README content
- Out of scope: License (PRD Q2) and npm publication
- Out of scope: Branch protection, Dependabot and linter
- Out of scope: `.mcp.json` for dogfooding (enters in spec 2, when there are tools)
