"use client";

import { useEffect, useState } from "react";

export type MaintenanceSettings = {
  isEnabled: boolean;
  message: string;
  accessKey: string;
  openDate?: string;
  openTime?: string;
  closeDate?: string;
  closeTime?: string;
};

const MAINTENANCE_MODE_KEY = "tokko_maintenance_access_key";

function isMaintenanceScheduleActive(settings: MaintenanceSettings): boolean {
  if (!settings.isEnabled) return false;

  // If no schedule is set, use the isEnabled flag
  if (!settings.closeDate || !settings.closeTime) return true;

  try {
    // Parse close date and time
    const [year, month, day] = settings.closeDate.split("-").map(Number);
    const [hour, minute] = settings.closeTime.split(":").map(Number);
    
    const closeDateTime = new Date(year, month - 1, day, hour, minute);
    const now = new Date();

    // Check if current time is before close date/time
    return now < closeDateTime;
  } catch {
    return true;
  }
}

export function useMaintenanceMode() {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/admin/maintenance-settings", {
          cache: "no-store",
        });
        if (!response.ok) {
          setIsLoading(false);
          return;
        }
        const data = (await response.json()) as { settings: MaintenanceSettings };
        setSettings(data.settings);

        // Check if user has stored access key
        if (data.settings.accessKey) {
          const storedKey = localStorage.getItem(MAINTENANCE_MODE_KEY);
          setHasAccess(storedKey === data.settings.accessKey);
        } else {
          setHasAccess(true); // No access key needed
        }
      } catch (error) {
        console.error("Failed to load maintenance settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Load immediately
    loadSettings();

    // Refresh every 10 seconds (more aggressive)
    const interval = setInterval(loadSettings, 10000);
    return () => clearInterval(interval);
  }, []);

  const setAccessKey = (key: string) => {
    if (settings?.accessKey === key) {
      localStorage.setItem(MAINTENANCE_MODE_KEY, key);
      setHasAccess(true);
      return true;
    }
    return false;
  };

  return {
    settings,
    hasAccess,
    setAccessKey,
    isLoading,
    isMaintenanceActive: settings ? (isMaintenanceScheduleActive(settings) && !hasAccess) : false,
  };
}
