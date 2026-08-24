"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import WaitLoading from "@/components/ui/WaitLoading";

export default function PageTransition({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const isNavigatingRef = useRef(false);
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
    const node = wrapRef.current;
    if (!node) {
      return;
    }

    const handleInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (isNavigatingRef.current) {
        return;
      }

      isNavigatingRef.current = true;
      gsap.to(node, {
        opacity: 0,
        duration: 0.28,
        ease: "power2.inOut",
        onComplete: () => {
          router.push(`${url.pathname}${url.search}${url.hash}`);
        },
      });
    };

    document.addEventListener("click", handleInternalNavigation, true);
    return () => document.removeEventListener("click", handleInternalNavigation, true);
  }, [router]);

  useEffect(() => {
    isNavigatingRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRouteLoading(true);
    const timer = window.setTimeout(() => {
      setIsRouteLoading(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div ref={wrapRef} className="route-transition-shell">
      {isRouteLoading && pathname !== "/" ? (
        <div
          style={{
            position: "fixed",
            top: pathname.startsWith("/produk/") ? "50%" : "10px",
            left: "50%",
            transform: pathname.startsWith("/produk/")
              ? "translate(-50%, -50%)"
              : "translateX(-50%)",
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
