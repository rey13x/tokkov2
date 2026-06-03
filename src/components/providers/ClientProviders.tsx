'use client';

import React from 'react';
import LiquidGlassBackground from '@/components/ui/LiquidGlassBackground';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>
    <LiquidGlassBackground />
    {children}
  </>;
}
