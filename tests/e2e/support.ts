import type { Page } from '@playwright/test';

/**
 * The routes the page-load and accessibility checks visit.
 *
 * Start with the home page and ADD YOUR OWN ROUTES here as the app grows,
 * for example ['/', '/pricing', '/login']. Each entry becomes one test in
 * pages.e2e-spec.ts and one in a11y.e2e-spec.ts. Keep it to pages that
 * render without being signed in: these checks have no session.
 */
export const PAGES: string[] = ['/'];

/**
 * Start listening for console errors and uncaught page errors on `page`.
 * Returns the live list: read it after the page has loaded.
 *
 * A failed favicon request is ignored. Browsers log it as a console error,
 * but it says nothing about the app and fails on any site without one.
 */
export function collectPageProblems(page: Page): string[] {
  const problems: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }
    const source = message.location().url;
    if (source.includes('favicon') || message.text().includes('favicon')) {
      return;
    }
    problems.push('console error: ' + message.text());
  });

  page.on('pageerror', (error) => {
    problems.push('uncaught error: ' + error.message);
  });

  return problems;
}
