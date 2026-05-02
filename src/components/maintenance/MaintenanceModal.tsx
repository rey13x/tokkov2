"use client";

import { FormEvent, useEffect, useState } from "react";
import { FiAlertTriangle, FiLock } from "react-icons/fi";
import { useMaintenanceMode } from "@/lib/maintenance-mode";
import styles from "./MaintenanceModal.module.css";

// Anti-inspection detection
function detectDevTools() {
  const threshold = 160; // Height threshold for devtools detection
  
  const checkDevTools = () => {
    if (window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold) {
      return true;
    }
    
    // Check for debugger statement execution time
    const start = performance.now();
    debugger; // eslint-disable-line no-debugger
    const end = performance.now();
    
    return end - start > 100;
  };

  return checkDevTools();
}

export default function MaintenanceModal() {
  const { settings, isMaintenanceActive, setAccessKey } = useMaintenanceMode();
  const [accessKeyInput, setAccessKeyInput] = useState("");
  const [error, setError] = useState("");
  const [devToolsDetected, setDevToolsDetected] = useState(false);

  // Prevent body scroll and background interaction when maintenance is active
  useEffect(() => {
    if (!isMaintenanceActive) {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      document.documentElement.style.overflow = "";
      return;
    }

    // Hide all page content
    const mainElement = document.querySelector("main");
    const footerElement = document.querySelector("footer");
    const headerElement = document.querySelector("header");
    
    if (mainElement) (mainElement as HTMLElement).style.pointerEvents = "none";
    if (footerElement) (footerElement as HTMLElement).style.pointerEvents = "none";
    if (headerElement) (headerElement as HTMLElement).style.pointerEvents = "none";

    document.body.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";
    document.documentElement.style.overflow = "hidden";

    // Prevent all keyboard shortcuts
    const preventKeyboard = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+I
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "I" || e.key === "i")) ||
        (e.ctrlKey && e.altKey && (e.key === "I" || e.key === "i")) ||
        e.key === "F11" ||
        (e.ctrlKey && e.key === "U")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const preventRightClick = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Bind with capture and multiple listeners
    document.addEventListener("keydown", preventKeyboard, true);
    document.addEventListener("contextmenu", preventRightClick as any, true);
    window.addEventListener("keydown", preventKeyboard, true);
    window.addEventListener("contextmenu", preventRightClick as any, true);

    // Detect devtools opening
    const devToolsInterval = setInterval(() => {
      if (detectDevTools()) {
        setDevToolsDetected(true);
      }
    }, 500);

    // Override common inspection methods
    (window as any).document.addEventListener = function() { return false; };
    (window as any).addEventListener = function() { return false; };

    return () => {
      clearInterval(devToolsInterval);
      document.removeEventListener("keydown", preventKeyboard, true);
      document.removeEventListener("contextmenu", preventRightClick as any, true);
      window.removeEventListener("keydown", preventKeyboard, true);
      window.removeEventListener("contextmenu", preventRightClick as any, true);
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      document.documentElement.style.overflow = "";
      if (mainElement) (mainElement as HTMLElement).style.pointerEvents = "";
      if (footerElement) (footerElement as HTMLElement).style.pointerEvents = "";
      if (headerElement) (headerElement as HTMLElement).style.pointerEvents = "";
    };
  }, [isMaintenanceActive, setDevToolsDetected]);

  // Disable console completely
  useEffect(() => {
    if (!isMaintenanceActive) return;

    if (typeof window !== "undefined") {
      // Override all console methods
      (window.console as any).log = () => {};
      (window.console as any).info = () => {};
      (window.console as any).warn = () => {};
      (window.console as any).error = () => {};
      (window.console as any).debug = () => {};
      (window.console as any).table = () => {};
      (window.console as any).time = () => {};
      (window.console as any).timeEnd = () => {};
      (window.console as any).trace = () => {};
      (window.console as any).assert = () => {};
      (window.console as any).group = () => {};
      (window.console as any).groupEnd = () => {};
      
      // Prevent window modifications
      Object.defineProperty(window, "devtools", {
        get() {
          setDevToolsDetected(true);
          return false;
        },
      });
    }
  }, [isMaintenanceActive, setDevToolsDetected]);

  if (!isMaintenanceActive || !settings) {
    return null;
  }

  // If devtools detected, show warning
  if (devToolsDetected) {
    return (
      <div className={styles.overlay}>
        <div className={styles.backdrop} />
        <div className={styles.modal}>
          <h1 className={styles.title}>
            <FiAlertTriangle aria-hidden="true" style={{ marginRight: "8px", verticalAlign: "middle" }} />
            Akses Ditolak
          </h1>
          <p className={styles.message}>
            Penggunaan developer tools tidak diizinkan. Mohon tutup DevTools dan refresh halaman.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className={styles.submitButton}
            style={{ marginTop: "16px" }}
          >
            Refresh Halaman
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!accessKeyInput.trim()) {
      setError("Mohon masukkan kunci akses.");
      return;
    }

    if (setAccessKey(accessKeyInput)) {
      // Set cookie for middleware validation
      document.cookie = `tokko_maintenance_access_key=${encodeURIComponent(accessKeyInput)}; path=/; max-age=86400`;
      setAccessKeyInput("");
      // Restore pointer events after successful access
      document.body.style.pointerEvents = "";
      // Reload to refresh with access
      window.location.reload();
    } else {
      setError("Kunci akses tidak valid.");
    }
  };

  // Format reopening time display
  const reopenText = () => {
    if (settings.openDate && settings.openTime) {
      return `Dibuka kembali pada ${settings.openDate} pukul ${settings.openTime}`;
    } else if (settings.closeDate && settings.closeTime) {
      return `Ditutup hingga ${settings.closeDate} pukul ${settings.closeTime}`;
    }
    return "Sedang dalam pemeliharaan.";
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div 
      className={styles.overlay} 
      onClick={handleBackdropClick} 
      onContextMenu={handleBackdropClick}
      onDrag={handleBackdropClick}
      onDragStart={handleBackdropClick}
      onDragEnd={handleBackdropClick}
      onDragOver={handleBackdropClick}
      onDrop={handleBackdropClick}
    >
      <div 
        className={styles.backdrop} 
        onClick={handleBackdropClick} 
        onContextMenu={handleBackdropClick}
      />
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h1 className={styles.title}>
          <FiLock aria-hidden="true" style={{ marginRight: "8px", verticalAlign: "middle" }} />
          Website Dalam Pemeliharaan
        </h1>
        <p className={styles.message}>{settings.message || "Website sedang dalam pemeliharaan. Mohon coba lagi nanti."}</p>
        
        <div className={styles.info}>
          <p className={styles.reopenInfo}>{reopenText()}</p>
        </div>

        {settings.accessKey ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="password"
              placeholder="Masukkan kunci akses"
              value={accessKeyInput}
              onChange={(e) => setAccessKeyInput(e.target.value)}
              className={styles.input}
              autoFocus
              onContextMenu={handleBackdropClick}
              onPaste={(e) => {
                // Allow paste in input
                e.stopPropagation();
              }}
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitButton}>
              Akses Website
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
