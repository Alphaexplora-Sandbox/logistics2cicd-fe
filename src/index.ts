import { handleRequest, startServer, generateHtml } from './server';
import { App } from './App';

export const SERVICE_NAME = 'logistics2cicd-frontend';
export { App, startServer, generateHtml, handleRequest };

export default handleRequest;

if (typeof module !== 'undefined' && module.exports) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlerFn: any = handleRequest;
  handlerFn.default = handleRequest;
  handlerFn.SERVICE_NAME = SERVICE_NAME;
  handlerFn.App = App;
  handlerFn.startServer = startServer;
  handlerFn.generateHtml = generateHtml;
  handlerFn.handleRequest = handleRequest;
  module.exports = handlerFn;
}

if (typeof require !== 'undefined' && require.main === module) {
  startServer();
}