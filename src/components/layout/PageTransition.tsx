"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import WaitLoading from "@/components/ui/WaitLoading";

export default function PageTransition({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRouteLoading(true);
    const timer = window.setTimeout(() => {
      setIsRouteLoading(false);
    }, 480);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div ref={wrapRef} className="route-transition-shell">
      {isRouteLoading && pathname !== "/" ? (
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1200,
            pointerEvents: "none",
          }}
        >
          <WaitLoading />
        </div>
      ) : null}
      {children}
    </div>
  );
}
