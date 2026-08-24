'use client';

import React, { useEffect } from 'react';
import LiquidGlassBackground from '@/components/ui/LiquidGlassBackground';
import { LanguageProvider } from '@/components/i18n/LanguageTools';
import { registerFirebaseServiceWorker } from '@/lib/push-notifications';
import { StoreDataProvider } from '@/components/providers/StoreDataProvider';
import type { StoreData } from '@/lib/store-client';

export default function ClientProviders({
  children,
  initialStoreData,
}: {
  children: React.ReactNode;
  initialStoreData: StoreData;
}) {
  useEffect(() => {
    registerFirebaseServiceWorker().catch(() => {
      // Ignore service worker registration errors.
    });
  }, []);

  useEffect(() => {
    const blockInspectionShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (event.key === "F12" || (modifier && key === "u") || (modifier && event.shiftKey && ["i", "j", "c"].includes(key))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const blockContextMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("keydown", blockInspectionShortcuts, true);
    document.addEventListener("contextmenu", blockContextMenu, true);
    return () => {
      document.removeEventListener("keydown", blockInspectionShortcuts, true);
      document.removeEventListener("contextmenu", blockContextMenu, true);
    };
  }, []);

  return <>
    <LanguageProvider>
      <StoreDataProvider initialData={initialStoreData}>
        <LiquidGlassBackground />
        {children}
      </StoreDataProvider>
    </LanguageProvider>
  </>;
}
