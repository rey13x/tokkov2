'use client';

import React, { useEffect } from 'react';
import { LanguageProvider } from '@/components/i18n/LanguageTools';
import { registerFirebaseServiceWorker } from '@/lib/push-notifications';
import { fetchStoreData } from '@/lib/store-client';
import { fetchSessionCached, PUBLIC_DATA_CACHE_KEY } from '@/lib/public-data-cache';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    registerFirebaseServiceWorker().catch(() => {
      // Ignore service worker registration errors.
    });

    void fetchStoreData().catch(() => {
      // Individual pages retry through the shared cache when needed.
    });

    const storiesTimer = window.setTimeout(() => {
      void fetchSessionCached(
        PUBLIC_DATA_CACHE_KEY.bookStories,
        '/api/book-stories/approved',
      ).catch(() => {});
    }, 1200);

    return () => window.clearTimeout(storiesTimer);
  }, []);

  return <>
    <LanguageProvider>
      {children}
    </LanguageProvider>
  </>;
}
