import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchActiveAlerts } from './alerts-api';

afterEach(() => vi.unstubAllGlobals());

const stub = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('fetchActiveAlerts', () => {
  it('requests only active alerts', async () => {
    const body = [{ id: 'a', lineCodes: ['C1'], header: 'h' }];
    const fetchMock = stub({ ok: true, json: async () => body });
    await expect(fetchActiveAlerts('http://api')).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith('http://api/alerts?active=true', undefined);
  });

  it('rejects a failed response', async () => {
    stub({ ok: false, status: 503 });
    await expect(fetchActiveAlerts('http://api')).rejects.toThrow('503');
  });
});
