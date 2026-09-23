'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LanguageProvider } from '@/components/i18n/LanguageTools';
import { registerFirebaseServiceWorker } from '@/lib/push-notifications';
import { fetchStoreData } from '@/lib/store-client';
import { fetchSessionCached, PUBLIC_DATA_CACHE_KEY } from '@/lib/public-data-cache';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      pathname === '/profil' ||
      session.user.role === 'admin' ||
      session.user.phone?.trim()
    ) {
      return;
    }

    const redirect = `${window.location.pathname}${window.location.search}`;
    router.replace(`/profil?requiredPhone=1&redirect=${encodeURIComponent(redirect)}`);
  }, [pathname, router, session, status]);

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
