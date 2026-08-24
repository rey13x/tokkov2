'use client';

import React, { useEffect } from 'react';
import LiquidGlassBackground from '@/components/ui/LiquidGlassBackground';
import { LanguageProvider } from '@/components/i18n/LanguageTools';
import { registerFirebaseServiceWorker } from '@/lib/push-notifications';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    registerFirebaseServiceWorker().catch(() => {
      // Ignore service worker registration errors.
    });
  }, []);

  return <>
    <LanguageProvider>
      <LiquidGlassBackground />
      {children}
    </LanguageProvider>
  </>;
}
