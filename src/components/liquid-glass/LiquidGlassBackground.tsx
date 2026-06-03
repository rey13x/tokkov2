'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function LiquidGlassBackground() {
  const { scene } = useThree();
  const geometryRef = useRef<THREE.PlaneGeometry>(null);

  useEffect(() => {
    // Create a simple gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Create liquid-like gradient
      const gradient = ctx.createLinearGradient(0, 0, 512, 512);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(0.5, '#16213e');
      gradient.addColorStop(1, '#0f3460');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 512);

      // Add some subtle radial gradients for liquid effect
      const radial = ctx.createRadialGradient(256, 256, 0, 256, 256, 512);
      radial.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      radial.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, 512, 512);
    }

    const texture = new THREE.CanvasTexture(canvas);
    scene.background = texture;

    return () => {
      texture.dispose();
    };
  }, [scene]);

  return null;
}
