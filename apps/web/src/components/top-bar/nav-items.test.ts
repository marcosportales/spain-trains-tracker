import { describe, expect, it } from 'vitest';
import { currentNavItem } from './nav-items';

describe('currentNavItem', () => {
  it.each([
    ['/', 'map'],
    ['/runs/2026-11-02/04001', 'map'],
    ['/punctuality', 'punctuality'],
    ['/replay', 'replay'],
  ])('%s is %s', (pathname, expected) => {
    expect(currentNavItem(pathname)).toBe(expected);
  });

  it('is none for pages outside the nav', () => {
    expect(currentNavItem('/stations/ATOCHA')).toBeUndefined();
  });
});
