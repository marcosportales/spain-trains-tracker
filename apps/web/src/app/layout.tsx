import type { ReactNode } from 'react';

// Root layout is a pass-through; <html> lives in app/[locale]/layout.tsx so `lang` follows the locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
