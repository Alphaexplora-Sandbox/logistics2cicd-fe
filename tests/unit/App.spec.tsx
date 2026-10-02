import { renderToString } from 'react-dom/server';
import React from 'react';
import { App, getErrorMessage } from '../../src/App';
import { ColdChainManager } from '../../src/services/coldChainManager';
import { LoadingManifest } from '../../src/types/logistics';

describe('App & Helpers', () => {
  it('renders the default service title', () => {
    expect(renderToString(<App />)).toContain('logistics2cicd-frontend');
  });

  it('renders a custom title', () => {
    expect(renderToString(<App title="custom" />)).toContain('custom');
  });

  it('formats errors correctly with getErrorMessage', () => {
    expect(getErrorMessage(new Error('standard error'))).toBe('standard error');
    expect(getErrorMessage('plain string error')).toBe('plain string error');
    expect(getErrorMessage(500)).toBe('500');
  });

  it('renders with active manifest and custom statuses', () => {
    const manager = new ColdChainManager();
    const manifest: LoadingManifest = {
      manifestId: 'MNF-99999',
      consignmentIds: ['shp-sample-01'],
      vehicleId: 'vh-cold-01',
      driverId: 'drv-01',
      totalWeightKg: 25,
      generatedAt: '2026-10-02T12:00:00Z',
    };

    const html = renderToString(
      <App
        initialTab="dispatch"
        managerInstance={manager}
        initialManifest={manifest}
      />,
    );
    expect(html).toContain('MNF-99999');
    expect(html).toContain('vh-cold-01');
  });
});