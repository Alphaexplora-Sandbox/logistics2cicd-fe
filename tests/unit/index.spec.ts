import { SERVICE_NAME } from '../../src/index';

describe('logistics2cicd-frontend', () => {
  it('should export SERVICE_NAME', () => {
    expect(SERVICE_NAME).toBe('logistics2cicd-frontend');
  });
});