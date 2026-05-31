'use client';

import dynamic from 'next/dynamic';

const ThemeToggleDynamic = dynamic(
  () => import('./ThemeToggle').then(mod => ({ default: mod.ThemeToggle })),
  {
    loading: () => <div style={{ width: '44px', height: '44px' }} />,
    ssr: false
  }
);

export function ThemeToggleWrapper() {
  return <ThemeToggleDynamic />;
}
