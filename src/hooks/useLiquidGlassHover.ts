'use client';

import { useEffect } from 'react';
import { liquidGlassState } from '@/lib/liquidGlass-store';

export function useLiquidGlassHover() {
  useEffect(() => {
    const handleMouseEnter = () => {
      liquidGlassState.hovered = true;
    };

    const handleMouseLeave = () => {
      liquidGlassState.hovered = false;
    };

    // Add listeners to all interactive elements
    const interactiveElements = document.querySelectorAll(
      'button, a, [role="button"], input, textarea, select, [data-cursor-hover="true"]'
    );

    const addListeners = () => {
      document.querySelectorAll(
        'button, a, [role="button"], input, textarea, select, [data-cursor-hover="true"]'
      ).forEach((el) => {
        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
      });
    };

    addListeners();

    // Use MutationObserver to watch for new elements
    const observer = new MutationObserver(() => {
      addListeners();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.querySelectorAll(
        'button, a, [role="button"], input, textarea, select, [data-cursor-hover="true"]'
      ).forEach((el) => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, []);
}
