# logistics2cicd-frontend

Created by ALPHACI as a React app standalone repository.

This starter already includes source files, package scripts, TypeScript, ESLint, Jest coverage, SonarQube metadata, branch protections, and ALPHACI workflow files that match the selected stack. Use it as the first working baseline, then replace the starter code with your application code.

## Project structure

- `src/App.tsx` contains the starter React component.
- `tests/unit/App.spec.tsx` renders the component with `react-dom/server` so unit tests pass without choosing a bundler for you.
- Add Vite, Next.js, or another bundler when you are ready to build the real app shell.

## Branch strategy

| Branch  | Purpose |
|---------|---------|
| main    | Production - protected |
| uat     | Integration and test - protected |
| develop | Development integration - unprotected, no CI pipeline |

## CI/CD

Workflow files live in `.github/workflows/`. The CI pipeline runs on `uat` and `main` only. `develop` and user-created branches do not trigger workflows. Push to `uat` to trigger your first run.

## Getting started

```bash
npm install
npm run lint
npm test
npm run build
```

Create a feature branch, open a pull request into `dev`, and let ALPHACI promote green changes through `uat` to `main`.