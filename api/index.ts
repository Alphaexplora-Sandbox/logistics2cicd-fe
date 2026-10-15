import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleRequest } from '../src/server';

/**
 * Vercel entry point.
 *
 * On Vercel this app runs as one serverless function, not as a long-running
 * server: Vercel calls the default export once per request. It must not call
 * `startServer()` (http.listen) - a function that listens never answers and
 * Vercel reports FUNCTION_INVOCATION_FAILED. `vercel.json` routes every path
 * here; locally and in Docker the app still starts with `npm start`.
 */
export default function handler(req: IncomingMessage, res: ServerResponse): void {
  handleRequest(req, res);
}
