import { describe, expect, it, vi } from 'vitest';
import { type ShareEnv, shareLink } from './share-link';

const data = { title: 'Run 03063', url: 'https://x.test/es/runs/2026-10-31/03063' };

describe('shareLink', () => {
  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const env: ShareEnv = { share, canShare: () => true, writeText: vi.fn() };
    expect(await shareLink(env, data)).toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
    expect(env.writeText).not.toHaveBeenCalled();
  });

  it('treats a dismissed share sheet as cancelled, without copying', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    const env: ShareEnv = {
      share: vi.fn().mockRejectedValue(abort),
      canShare: () => true,
      writeText: vi.fn(),
    };
    expect(await shareLink(env, data)).toBe('cancelled');
    expect(env.writeText).not.toHaveBeenCalled();
  });

  it('copies the URL when the Web Share API is missing (desktop)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink({ writeText }, data)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it('copies the URL when sharing fails for another reason', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const env: ShareEnv = { share: vi.fn().mockRejectedValue(new Error('no')), writeText };
    expect(await shareLink(env, data)).toBe('copied');
  });

  it('copies when canShare rejects the data', async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareLink({ share, canShare: () => false, writeText }, data)).toBe('copied');
    expect(share).not.toHaveBeenCalled();
  });

  it('reports failure when nothing works', async () => {
    expect(await shareLink({}, data)).toBe('failed');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await shareLink({ writeText }, data)).toBe('failed');
  });
});
