"use client";

import { useEffect, useState } from "react";

export type MaintenanceSettings = {
  isEnabled: boolean;
  message: string;
  accessKey: string;
  maintenanceMode: "instant" | "schedule"; // instant = tutup sekarang, schedule = pakai jam
  openTime: string; // HH:MM format, Jakarta timezone
  closeTime: string; // HH:MM format, Jakarta timezone
  maintenanceTitle?: string;
  maintenanceSubtitle?: string;
  updatedAt: string;
};

const MAINTENANCE_MODE_KEY = "tokko_maintenance_access_key";
const MAINTENANCE_ACK_KEY = "tokko_maintenance_acknowledged_at";
export const MAINTENANCE_REOPEN_EVENT = "tokko:maintenance-reopen";

// Convert UTC date to Jakarta timezone (GMT+7)
function getJakartaTime(): Date {
  const now = new Date();
  const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  return jakartaTime;
}

function isMaintenanceScheduleActive(settings: MaintenanceSettings): boolean {
  if (!settings.isEnabled) return false;

  // If mode is instant, maintenance is active
  if (settings.maintenanceMode === "instant") return true;

  // For schedule mode, check if current time is within operating hours
  // If no schedule is set, maintenance is NOT active (website is open)
  if (!settings.openTime || !settings.closeTime) return false;

  try {
    const jakartaNow = getJakartaTime();
    
    // Parse open time and close time (both required for daily schedule)
    const [openHour, openMinute] = settings.openTime.split(":").map(Number);
    const [closeHour, closeMinute] = settings.closeTime.split(":").map(Number);

    // Get current Jakarta time components
    const currentHour = jakartaNow.getHours();
    const currentMinute = jakartaNow.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Convert scheduled times to minutes for easier comparison
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    // Check if we're within operating hours
    let isWithinOperatingHours = false;

    if (openTimeInMinutes < closeTimeInMinutes) {
      // Normal case: open time is before close time (e.g., 09:00 - 18:00)
      isWithinOperatingHours = currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;
    } else {
      // Overnight case: close time is before open time (e.g., 22:00 - 08:00)
      isWithinOperatingHours = currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes;
    }

    // Maintenance is ACTIVE (website closed) when NOT within operating hours
    return !isWithinOperatingHours;
  } catch (error) {
    console.error("Error parsing maintenance schedule:", error);
    return settings.isEnabled; // Fall back to enabled flag
  }
}

export function useMaintenanceMode() {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMaintenanceEnabled, setIsMaintenanceEnabled] = useState(false);

  // Load settings from API
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

    // Refresh settings every 5 minutes
    const settingsInterval = setInterval(loadSettings, 5 * 60 * 1000);
    return () => clearInterval(settingsInterval);
  }, []);

  // Check maintenance status in real-time
  useEffect(() => {
    if (!settings) {
      return;
    }

    const updateMaintenanceStatus = () => {
      const isActive = isMaintenanceScheduleActive(settings);
      setIsMaintenanceEnabled(isActive);
    };

    // Check immediately
    updateMaintenanceStatus();

    // Check every 30 seconds for accuracy
    const statusInterval = setInterval(updateMaintenanceStatus, 30 * 1000);

    return () => clearInterval(statusInterval);
  }, [settings]);

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
