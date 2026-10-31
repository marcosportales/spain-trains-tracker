import { describe, expect, it } from 'vitest';
import { CONTRACTS_PACKAGE } from './index.js';

describe('@stt/contracts', () => {
  it('exposes its package name', () => {
    expect(CONTRACTS_PACKAGE).toBe('@stt/contracts');
  });
});
