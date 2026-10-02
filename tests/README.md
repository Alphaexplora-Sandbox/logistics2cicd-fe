# Tests

This folder is the home for all test suites in this repository.

| Folder | Purpose |
| ------ | ------- |
| `unit/` | Unit tests. Run by `npm test` and enforced with coverage in CI. |

## Conventions

- Unit test files end with `.spec.ts` or `.test.ts` (`.tsx` for React components).
- Mirror the `src/` structure: `src/user/user.service.ts` is tested by `tests/unit/user/user.service.spec.ts`.
- Co-located specs inside `src/` also work, but `tests/unit/` is the checked convention: CI verifies this folder exists.
- When you add end-to-end suites, keep them in `tests/e2e/` and name files `*.e2e-spec.ts` so the unit test runner does not pick them up.
