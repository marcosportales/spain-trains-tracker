export const NAV_ITEMS = [
  { key: 'map', href: '/' },
  { key: 'punctuality', href: '/punctuality' },
  { key: 'replay', href: '/replay' },
] as const;

export type NavKey = (typeof NAV_ITEMS)[number]['key'];

/** The nav entry a locale-less `pathname` belongs to. A Run's page is still the map. */
export function currentNavItem(pathname: string): NavKey | undefined {
  if (pathname === '/' || pathname.startsWith('/runs/')) return 'map';
  return NAV_ITEMS.find((item) => item.href !== '/' && pathname.startsWith(item.href))?.key;
}
