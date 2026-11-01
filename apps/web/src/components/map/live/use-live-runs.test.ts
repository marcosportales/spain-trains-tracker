import { describe, expect, it } from 'vitest';
import { liveStreamUrl } from './use-live-runs';

describe('liveStreamUrl', () => {
  it('targets /live/stream without a query when unfiltered', () => {
    expect(liveStreamUrl({}, 'http://api')).toBe('http://api/live/stream');
  });

  it('encodes only the filters that are set', () => {
    expect(liveStreamUrl({ serviceType: 'ave', hub: undefined, line: 'C1' }, 'http://api')).toBe(
      'http://api/live/stream?serviceType=ave&line=C1',
    );
  });
});
