import React, { useEffect, useState } from "react";

export default function AdPopup() {
  const [config, setConfig] = useState(null);
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("adConfig");
      const dismissed = localStorage.getItem("adDismissed");
      if (raw) {
        const parsed = JSON.parse(raw);
        setConfig(parsed);
        // respect enabled flag
        if (parsed.enabled === false) return;
        // if showOnce true, check dismissed flag
        if (parsed.showOnce === false) {
          setVisible(true);
        } else if (!dismissed) {
          setVisible(true);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setCanClose(false);
    setCountdown(5);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          setCanClose(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible || !config || !config.image) return null;

  const close = () => {
    setVisible(false);
    try {
      if (config && config.showOnce !== false) {
        localStorage.setItem("adDismissed", "1");
      }
    } catch (e) {}
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={closeAreaStyle}>
          {!canClose ? (
            <div style={countdownStyle}>{countdown}s</div>
          ) : (
            <button aria-label="Close ad" onClick={close} style={xButtonStyle}>
              ×
            </button>
          )}
        </div>

        <img src={config.image} alt="ad" style={imageStyle} />

        <div style={{ marginTop: 16 }}>
          {config.link ? (
            <a href={config.link} target="_blank" rel="noreferrer" style={linkButtonStyle}>
              {config.buttonText || "Buka"}
            </a>
          ) : (
            <div style={linkButtonStyleDisabled}>{config.buttonText || "Buka"}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.35)",
  backdropFilter: "blur(6px)",
  zIndex: 9999,
};

const modalStyle = {
  position: "relative",
  width: "min(90vw, 420px)",
  padding: 20,
  borderRadius: 12,
  background: "rgba(255,255,255,0.02)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const imageStyle = {
  width: "100%",
  height: "auto",
  borderRadius: 80,
  display: "block",
  objectFit: "cover",
};

const linkButtonStyle = {
  display: "inline-block",
  padding: "10px 18px",
  background: "white",
  color: "#111",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 600,
};

const linkButtonStyleDisabled = {
  ...linkButtonStyle,
  opacity: 0.6,
  pointerEvents: "none",
};

const closeAreaStyle = {
  position: "absolute",
  top: 8,
  right: 8,
};

const xButtonStyle = {
  background: "rgba(0,0,0,0.6)",
  color: "white",
  border: "none",
  width: 34,
  height: 34,
  borderRadius: "50%",
  fontSize: 18,
  cursor: "pointer",
};

const countdownStyle = {
  minWidth: 34,
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.45)",
  color: "white",
  borderRadius: 34,
  fontWeight: 700,
};
