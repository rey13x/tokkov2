"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreData } from "@/lib/store-client";
import WaitLoading from "@/components/ui/WaitLoading";

type StoreDataContextValue = {
  data: StoreData;
  isInitialLoading: boolean;
};

const StoreDataContext = createContext<StoreDataContextValue | null>(null);

function hasStoreData(data: StoreData) {
  return data.products.length > 0
    || data.informations.length > 0
    || data.testimonials.length > 0
    || Boolean(data.privacyPolicy);
}

export function StoreDataProvider({
  initialData,
  children,
}: {
  initialData: StoreData;
  children: React.ReactNode;
}) {
  const [data, setData] = useState(initialData);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      fetchStoreData()
        .then((nextData) => {
          if (mounted) {
            setData((currentData) => hasStoreData(nextData) || !hasStoreData(currentData) ? nextData : currentData);
            window.dispatchEvent(new CustomEvent("tokko:store-data-updated", { detail: nextData }));
          }
          window.setTimeout(() => {
            if (mounted) {
              setIsInitialLoading(false);
            }
          }, 600);
        })
        .catch(() => {
          if (mounted) {
            setIsInitialLoading(false);
          }
        });
    };

    refresh();
    const refreshTimer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refresh);
    };
  }, [pathname]);

  return (
    <StoreDataContext.Provider value={{ data, isInitialLoading }}>
      {isInitialLoading ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "grid",
            placeItems: "center",
            background: "rgba(255, 255, 255, 0.72)",
            backdropFilter: "blur(3px)",
            pointerEvents: "all",
          }}
        >
          <WaitLoading centered text="Lagi ngambil data, Pastiin internet kamu ada..." />
        </div>
      ) : null}
      {children}
    </StoreDataContext.Provider>
  );
}

export function useStoreData() {
  const context = useContext(StoreDataContext);
  if (!context) {
    throw new Error("useStoreData must be used inside StoreDataProvider");
  }
  return context;
}
