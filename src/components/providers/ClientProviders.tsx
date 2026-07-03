'use client';

import React from 'react';
import LiquidGlassBackground from '@/components/ui/LiquidGlassBackground';
import { LanguageProvider } from '@/components/i18n/LanguageTools';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>
    <LanguageProvider>
      <LiquidGlassBackground />
      {children}
    </LanguageProvider>
  </>;
}
