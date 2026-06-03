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
  updatedAt: string;
};

const MAINTENANCE_MODE_KEY = "tokko_maintenance_access_key";
const MAINTENANCE_ACK_KEY = "tokko_maintenance_acknowledged_at";
export const MAINTENANCE_REOPEN_EVENT = "tokko:maintenance-reopen";

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
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/maintenance-settings", {
          cache: "no-store",
        });
        if (!response.ok) {
          setIsLoading(false);
          return;
        }
        const data = (await response.json()) as { settings: MaintenanceSettings };
        setSettings(data.settings);

        const storedAck = localStorage.getItem(MAINTENANCE_ACK_KEY);
        setHasAcknowledged(storedAck === data.settings.updatedAt);
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

  useEffect(() => {
    const reopen = () => setHasAcknowledged(false);
    window.addEventListener(MAINTENANCE_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(MAINTENANCE_REOPEN_EVENT, reopen);
  }, []);

  const acknowledgeMaintenance = () => {
    if (!settings) {
      return;
    }
    localStorage.setItem(MAINTENANCE_ACK_KEY, settings.updatedAt);
    setHasAcknowledged(true);
  };

  const isMaintenanceEnabled = settings ? isMaintenanceScheduleActive(settings) : false;

  return {
    settings,
    hasAcknowledged,
    acknowledgeMaintenance,
    isLoading,
    isMaintenanceEnabled,
    isMaintenanceActive: isMaintenanceEnabled && !hasAcknowledged,
  };
}

export function reopenMaintenanceNotice() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(MAINTENANCE_ACK_KEY);
  window.localStorage.removeItem(MAINTENANCE_MODE_KEY);
  window.dispatchEvent(new Event(MAINTENANCE_REOPEN_EVENT));
}
