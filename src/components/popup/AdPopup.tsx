"use client";

import { useEffect, useMemo, useState } from "react";

const AD_POPUP_STORAGE_KEY = "adConfig";
const DISMISS_STORAGE_KEY = "adDismissed";

interface AdConfig {
  image?: string;
  mediaUrl?: string;
  videoUrl?: string;
  url?: string;
  link?: string;
  buttonText?: string;
  enabled?: boolean;
  showOnce?: boolean;
}

function isVideoUrl(url: string) {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return [".mp4", ".webm", ".ogg", ".mov", ".m3u8"].some((ext) => normalized.includes(ext)) ||
    normalized.includes("youtube.com") ||
    normalized.includes("youtu.be") ||
    normalized.includes("vimeo.com");
}

function getVideoEmbedUrl(url: string) {
  if (!url) return url;
  const normalized = url.toLowerCase();
  if (normalized.includes("youtube.com/watch")) {
    const parsed = new URL(url);
    const videoId = parsed.searchParams.get("v");
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  }
  if (normalized.includes("youtu.be/")) {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\//, "");
    return `https://www.youtube.com/embed/${path}`;
  }
  return url;
}

const readAdConfig = () => {
  try {
    const raw = window.localStorage.getItem(AD_POPUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdConfig;
    return parsed;
  } catch {
    return null;
  }
};

export default function AdPopup() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    const applyConfig = () => {
      const parsed = readAdConfig();
      if (!parsed) {
        setConfig(null);
        setVisible(false);
        return;
      }

      const dismissed = window.localStorage.getItem(DISMISS_STORAGE_KEY);
      if (parsed.enabled === false) {
        setConfig(parsed);
        setVisible(false);
        return;
      }
      if (parsed.showOnce !== false && dismissed) {
        setConfig(parsed);
        setVisible(false);
        return;
      }

      const mediaUrl = parsed.image || parsed.mediaUrl || parsed.videoUrl || parsed.url || "";
      setConfig(parsed);
      setVisible(Boolean(mediaUrl));
    };

    applyConfig();
    window.addEventListener("ad-config-updated", applyConfig);
    window.addEventListener("storage", applyConfig);

    return () => {
      window.removeEventListener("ad-config-updated", applyConfig);
      window.removeEventListener("storage", applyConfig);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;

    setCanClose(false);
    setCountdown(5);
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setCanClose(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [visible]);

  const mediaUrl = config?.image || config?.mediaUrl || config?.videoUrl || config?.url || "";
  const isVideo = useMemo(() => isVideoUrl(mediaUrl), [mediaUrl]);
  const videoEmbedUrl = useMemo(() => getVideoEmbedUrl(mediaUrl), [mediaUrl]);

  if (!visible || !config || !mediaUrl) return null;

  const handleClose = () => {
    setVisible(false);
    try {
      if (config.showOnce !== false) {
        window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
      }
    } catch {}
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={closeAreaStyle}>
          {canClose ? (
            <button type="button" onClick={handleClose} style={closeButtonStyle} aria-label="Tutup iklan">
              ×
            </button>
          ) : (
            <div style={countdownStyle}>{countdown}s</div>
          )}
        </div>

        <div style={mediaWrapperStyle}>
          {isVideo ? (
            videoEmbedUrl.includes("youtube.com/embed/") || videoEmbedUrl.includes("player.vimeo.com") ? (
              <iframe
                src={videoEmbedUrl}
                title="Ad video"
                style={mediaFrameStyle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={mediaUrl}
                style={mediaFrameStyle}
                controls
                autoPlay
                muted
                loop
                playsInline
              />
            )
          ) : (
            <img src={mediaUrl} alt="Iklan" style={imageStyle} />
          )}
        </div>

        <div style={actionsStyle}>
          {config.link ? (
            <a href={config.link} target="_blank" rel="noreferrer" style={buttonStyle}>
              {config.buttonText || "Buka"}
            </a>
          ) : (
            <div style={buttonStyleDisabled}>{config.buttonText || "Buka"}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  background: "rgba(0,0,0,0.4)",
  backdropFilter: "blur(8px)",
};

const modalStyle: React.CSSProperties = {
  position: "relative",
  width: "min(92vw, 560px)",
  maxHeight: "90vh",
  overflow: "hidden",
  borderRadius: "24px",
  background: "rgba(255,255,255,0.95)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
  padding: "20px 18px 18px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const mediaWrapperStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  borderRadius: "20px",
  background: "#f5f5f5",
  maxHeight: "70vh",
};

const imageStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  maxHeight: "70vh",
  objectFit: "contain",
  borderRadius: "20px",
};

const mediaFrameStyle: React.CSSProperties = {
  width: "100%",
  height: "min(70vh, 420px)",
  border: 0,
  borderRadius: "20px",
  background: "#000",
};

const actionsStyle: React.CSSProperties = {
  marginTop: "16px",
  width: "100%",
  display: "flex",
  justifyContent: "center",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#111",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 700,
  minWidth: "140px",
};

const buttonStyleDisabled: React.CSSProperties = {
  ...buttonStyle,
  background: "#cfcfcf",
  color: "#666",
  pointerEvents: "none",
};

const closeAreaStyle: React.CSSProperties = {
  position: "absolute",
  top: "10px",
  right: "10px",
  zIndex: 1,
};

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  width: "34px",
  height: "34px",
  borderRadius: "999px",
  background: "rgba(0,0,0,0.7)",
  color: "#fff",
  cursor: "pointer",
  fontSize: "20px",
};

const countdownStyle: React.CSSProperties = {
  minWidth: "34px",
  minHeight: "34px",
  borderRadius: "999px",
  padding: "0 8px",
  background: "rgba(0,0,0,0.7)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  fontWeight: 700,
};
