export type ShareData = { title: string; url: string };

/** The browser capabilities sharing needs, injectable so the policy is testable. */
export type ShareEnv = {
  share?: ((data: ShareData) => Promise<void>) | undefined;
  canShare?: ((data: ShareData) => boolean) | undefined;
  writeText?: ((text: string) => Promise<void>) | undefined;
};

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Share a link: the native share sheet when the Web Share API is there (mobile), else copy the URL
 * to the clipboard (desktop). Dismissing the share sheet is not an error and does not copy.
 */
export async function shareLink(env: ShareEnv, data: ShareData): Promise<ShareOutcome> {
  if (env.share && (env.canShare?.(data) ?? true)) {
    try {
      await env.share(data);
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
  }
  if (!env.writeText) return 'failed';
  try {
    await env.writeText(data.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** The real browser's capabilities (call only on the client). */
export function browserShareEnv(): ShareEnv {
  const nav = navigator;
  return {
    share: nav.share ? (d) => nav.share(d) : undefined,
    canShare: nav.canShare ? (d) => nav.canShare(d) : undefined,
    writeText: nav.clipboard?.writeText ? (t) => nav.clipboard.writeText(t) : undefined,
  };
}
