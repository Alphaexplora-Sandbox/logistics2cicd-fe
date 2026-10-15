import type { IncomingMessage, ServerResponse } from 'node:http';

import handler from '../../api/index';

interface Captured {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

function call(url: string): Captured {
  const captured: Captured = {};
  const req = { url, headers: { host: 'example.vercel.app' } } as unknown as IncomingMessage;
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      captured.status = status;
      captured.headers = headers;
      return this;
    },
    end(body: string) {
      captured.body = body;
      return this;
    },
  } as unknown as ServerResponse;
  handler(req, res);
  return captured;
}

describe('Vercel entry (api/index.ts)', () => {
  it('renders the app as HTML for any page path', () => {
    const page = call('/');
    expect(page.status).toBe(200);
    expect(page.headers?.['Content-Type']).toContain('text/html');
    expect(page.body).toContain('<div id="root">');

    expect(call('/dispatch?tab=telemetry').status).toBe(200);
  });

  it('answers the health check as JSON', () => {
    const health = call('/api/health');
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body ?? '{}')).toEqual({ status: 'ok', service: 'logistics2cicd-frontend' });
  });

  it('never starts a listening server (a serverless function must not)', () => {
    const http = jest.requireActual<typeof import('node:http')>('node:http');
    const createServer = jest.spyOn(http, 'createServer');
    call('/');
    expect(createServer).not.toHaveBeenCalled();
    createServer.mockRestore();
  });
});
