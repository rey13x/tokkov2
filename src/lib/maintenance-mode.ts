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
  maintenanceTitle?: string;
  maintenanceSubtitle?: string;
  updatedAt: string;
};

const MAINTENANCE_MODE_KEY = "tokko_maintenance_access_key";
const MAINTENANCE_ACK_KEY = "tokko_maintenance_acknowledged_at";
export const MAINTENANCE_REOPEN_EVENT = "tokko:maintenance-reopen";

function isMaintenanceScheduleActive(settings: MaintenanceSettings): boolean {
  if (!settings.isEnabled) return false;

  // If no schedule is set, maintenance is active (only limited by enabled flag)
  if (!settings.closeTime) return true;

  try {
    const now = new Date();

    // Parse close date and time (required)
    const closeDate = settings.closeDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const [closeYear, closeMonth, closeDay] = closeDate.split("-").map(Number);
    const [closeHour, closeMinute] = settings.closeTime.split(":").map(Number);
    const closeDateTime = new Date(closeYear, closeMonth - 1, closeDay, closeHour, closeMinute);

    // Check if we haven't reached close time yet
    const beforeClose = now < closeDateTime;

    // If open time is set, check if we've passed it
    if (settings.openTime) {
      const openDate = settings.openDate || closeDate;
      const [openYear, openMonth, openDay] = openDate.split("-").map(Number);
      const [openHour, openMinute] = settings.openTime.split(":").map(Number);
      const openDateTime = new Date(openYear, openMonth - 1, openDay, openHour, openMinute);
      const afterOpen = now >= openDateTime;
      
      // Maintenance is active if: we're after open AND before close
      return afterOpen && beforeClose;
    }

    // If only close time is set, maintenance is active until that time
    return beforeClose;
  } catch (error) {
    console.error("Error parsing maintenance schedule:", error);
    return settings.isEnabled; // Fall back to enabled flag
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
