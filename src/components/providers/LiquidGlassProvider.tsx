'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import LiquidGlassCursor from '../liquid-glass/LiquidGlassCursor';
import LiquidGlassBackground from '../liquid-glass/LiquidGlassBackground';
import DynamicLights from '../liquid-glass/DynamicLights';
import { useLiquidGlassHover } from '@/hooks/useLiquidGlassHover';

export default function LiquidGlassProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useLiquidGlassHover();

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >
        <Canvas
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMappingExposure: 1.5,
            stencil: false,
            alpha: true,
            toneMapping: THREE.NeutralToneMapping,
          }}
          camera={{
            near: 0.01,
            far: 1000,
            fov: 5,
            position: [0, 0, 25],
          }}
          dpr={[1, 1.5]}
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <Suspense fallback={null}>
            <LiquidGlassBackground />
            <LiquidGlassCursor />
            <DynamicLights />
          </Suspense>
        </Canvas>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </>
  );
}
