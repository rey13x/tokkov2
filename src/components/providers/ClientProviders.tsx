'use client';

import React from 'react';
import LiquidGlassBackground from '@/components/ui/LiquidGlassBackground';
import { FloatingLanguageToggle, LanguageProvider } from '@/components/i18n/LanguageTools';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>
    <LanguageProvider>
      <LiquidGlassBackground />
      <FloatingLanguageToggle />
      {children}
    </LanguageProvider>
  </>;
}
