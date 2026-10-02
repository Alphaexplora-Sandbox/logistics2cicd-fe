import { handleRequest, startServer, generateHtml } from './server';
import { App } from './App';

export const SERVICE_NAME = 'logistics2cicd-frontend';
export { App, startServer, generateHtml, handleRequest };

export default handleRequest;

if (typeof require !== 'undefined' && require.main === module) {
  startServer();
}