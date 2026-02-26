"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

export default function PageTransition({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) {
      return;
    }

    const tween = gsap.fromTo(
      node,
      {
        opacity: 0,
      },
      {
        opacity: 1,
        duration: 0.45,
        ease: "power2.out",
      },
    );

    return () => {
      tween.kill();
    };
  }, [pathname]);

  return (
    <div ref={wrapRef} className="route-transition-shell">
      {children}
    </div>
  );
}
