import http from 'node:http';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';

export const PORT = Number(process.env.PORT) || 3000;

export function generateHtml(): string {
  const renderedApp = renderToString(React.createElement(App, { title: 'logistics2cicd-frontend' }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cold-Chain Logistics Cloud</title>
  <meta name="description" content="Cold-chain telematics, fleet compatibility and geofenced proof of delivery platform.">
</head>
<body style="margin: 0; background-color: #0f172a;">
  <div id="root">${renderedApp}</div>
</body>
</html>`;
}

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  const pathname = url.pathname;

  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'logistics2cicd-frontend' }));
    return;
  }

  const html = generateHtml();
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(html);
}

export function startServer(port: number = PORT): http.Server {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`Logistics2cicd Frontend listening at http://localhost:${port}`);
  });
  return server;
}
