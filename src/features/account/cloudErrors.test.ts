import { describe, expect, it } from 'vitest';
import { CloudError } from '../../platform/cloud';
import { he } from '../../i18n/he';
import { cloudErrorMessage, errorDetail } from './cloudErrors';

describe('cloudErrorMessage', () => {
  it('hides cancelled errors', () => {
    expect(cloudErrorMessage(new CloudError('cancelled'))).toBeNull();
  });

  it('uses the plain Hebrew text for known codes', () => {
    expect(cloudErrorMessage(new CloudError('network', 'auth/network-request-failed'))).toBe(
      he.account.errors.network,
    );
  });

  it('appends the technical detail to unexpected errors', () => {
    const msg = cloudErrorMessage(new CloudError('unknown', '10: Developer console is not set up'));
    expect(msg).toBe(`${he.account.errors.unknown} (10: Developer console is not set up)`);
  });

  it('omits an empty or placeholder detail', () => {
    expect(cloudErrorMessage(new CloudError('unknown'))).toBe(he.account.errors.unknown);
  });

  it('trims long details', () => {
    expect(errorDetail(new Error('x'.repeat(300))).length).toBe(141);
  });
});
