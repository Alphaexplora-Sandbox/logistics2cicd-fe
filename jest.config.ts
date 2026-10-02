import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/*.spec.tsx',
    '**/*.test.tsx',
  ],
  // Browser suites live in tests/e2e and are named *.e2e-spec.ts, which the
  // patterns above already miss. Ignored explicitly as well, so renaming one
  // cannot drag it into the unit runner, where page.goto fails in a way that
  // reads like an application bug rather than a misplaced file.
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  // json-summary is the one that matters: it writes coverage-summary.json,
  // which is the ONLY file the CI coverage gate reads. Jest defaults to
  // clover, json, lcov and text - none of them that - so a suite could pass,
  // write three reports, and still fail the gate with
  // "coverage/coverage-summary.json not found". lcov is kept for SonarCloud
  // and text for the log.
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageDirectory: 'coverage',
};

export default config;