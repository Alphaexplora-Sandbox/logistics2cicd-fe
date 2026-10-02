import defaultHandler, { SERVICE_NAME, App, startServer, generateHtml, handleRequest } from '../../src/index';

describe('logistics2cicd-frontend', () => {
  it('should export SERVICE_NAME and all runtime bindings', () => {
    expect(SERVICE_NAME).toBe('logistics2cicd-frontend');
    expect(defaultHandler).toBe(handleRequest);
    expect(typeof App).toBe('function');
    expect(typeof generateHtml).toBe('function');
    expect(typeof startServer).toBe('function');

    // Access exports dynamically to trigger TS getter functions
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const indexModule = require('../../src/index');
    expect(indexModule.App).toBeDefined();
    expect(indexModule.startServer).toBeDefined();
    expect(indexModule.generateHtml).toBeDefined();
    expect(indexModule.handleRequest).toBeDefined();
    expect(indexModule.SERVICE_NAME).toBe('logistics2cicd-frontend');
  });
});