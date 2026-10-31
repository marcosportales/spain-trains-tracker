import { describe, expect, it } from 'vitest';
import { GetHealth } from './get-health.use-case.js';

describe('GetHealth', () => {
  it('reports ok', () => {
    expect(new GetHealth().execute()).toEqual({ status: 'ok' });
  });
});
