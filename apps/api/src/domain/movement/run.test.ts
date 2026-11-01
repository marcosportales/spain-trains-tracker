import { describe, expect, it } from 'vitest';
import { InvalidMovementValueError } from './errors.js';
import { createRun } from './run.js';
import { createRunId } from './run-id.js';

describe('createRun', () => {
  const id = createRunId('3063', '2026-10-31');

  it('creates a Run with its service type and optional Line', () => {
    expect(createRun({ id, serviceType: 'ave', lineCode: ' AVE ' })).toEqual({
      id,
      serviceType: 'ave',
      lineCode: 'AVE',
    });
    expect(createRun({ id, serviceType: 'cercanias' })).not.toHaveProperty('lineCode');
  });

  it('rejects an unknown service type or blank Line', () => {
    expect(() => createRun({ id, serviceType: 'tram' as never })).toThrow(
      InvalidMovementValueError,
    );
    expect(() => createRun({ id, serviceType: 'ave', lineCode: ' ' })).toThrow(
      InvalidMovementValueError,
    );
  });

  it('keeps an optional status and wheelchair flag', () => {
    expect(
      createRun({ id, serviceType: 'cercanias', status: 'cancelled', wheelchairAccessible: false }),
    ).toEqual({ id, serviceType: 'cercanias', status: 'cancelled', wheelchairAccessible: false });
    const bare = createRun({ id, serviceType: 'ave' });
    expect(bare).not.toHaveProperty('status');
    expect(bare).not.toHaveProperty('wheelchairAccessible');
  });

  it('rejects an unknown status', () => {
    expect(() => createRun({ id, serviceType: 'ave', status: 'late' as never })).toThrow(
      InvalidMovementValueError,
    );
  });
});
