import React, { useEffect, useState } from "react";

export default function AdminPanel() {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [buttonText, setButtonText] = useState("Buka");
  const [enabled, setEnabled] = useState(true);
  const [showOnce, setShowOnce] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("adConfig");
      if (raw) {
        const parsed = JSON.parse(raw);
        setImageUrl(parsed.image || "");
        setLink(parsed.link || "");
        setButtonText(parsed.buttonText || "Buka");
        setEnabled(parsed.enabled !== false);
        setShowOnce(parsed.showOnce !== false);
      }
    } catch (e) {}
  }, []);

  const onSave = () => {
    const cfg = { image: imageUrl, link: link, buttonText, enabled, showOnce };
    try {
      localStorage.setItem("adConfig", JSON.stringify(cfg));
      // clear dismissed so admin can preview
      localStorage.removeItem("adDismissed");
      alert("Ad saved. It will show on next page load (or refresh).\nYou can also preview by refreshing the page.");
    } catch (e) {
      alert("Failed to save ad");
    }
  };

  const onClear = () => {
    localStorage.removeItem("adConfig");
    localStorage.removeItem("adDismissed");
    setImageUrl("");
    setLink("");
    alert("Ad cleared");
  };

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageUrl(ev.target.result);
    reader.readAsDataURL(f);
  };

  return (
    <>
      <button
        onClick={() => setOpen((s) => !s)}
        style={gearButtonStyle}
        aria-label="Open admin panel"
      >
        ⚙️
      </button>

      {open && (
        <div style={panelOverlayStyle} onClick={() => setOpen(false)}>
          <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
            <h3>Ad Admin</h3>
            <label style={labelStyle}>Image URL:</label>
            <input style={inputStyle} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... or upload below" />

            <label style={labelStyle}>Or Upload Image:</label>
            <input style={inputStyleFile} type="file" accept="image/*" onChange={handleFile} />

            <label style={labelStyle}>Link URL:</label>
            <input style={inputStyle} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />

            <label style={labelStyle}>Button Text:</label>
            <input style={inputStyle} value={buttonText} onChange={(e) => setButtonText(e.target.value)} />

            <label style={labelStyle}><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable Ad</label>
            <label style={labelStyle}><input type="checkbox" checked={showOnce} onChange={(e) => setShowOnce(e.target.checked)} /> Show only once (per device)</label>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={onSave} style={saveButtonStyle}>Save</button>
              <button onClick={onClear} style={clearButtonStyle}>Clear</button>
              <button onClick={() => setOpen(false)} style={closeButtonStyle}>Close</button>
            </div>

            {imageUrl && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}>Preview:</div>
                <img src={imageUrl} alt="preview" style={{ maxWidth: 300, borderRadius: 12 }} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const gearButtonStyle = {
  position: "fixed",
  right: 18,
  bottom: 18,
  zIndex: 10000,
  width: 48,
  height: 48,
  borderRadius: 12,
  border: "none",
  background: "white",
  cursor: "pointer",
  fontSize: 20,
};

const panelOverlayStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.5)",
  zIndex: 10001,
};

const panelStyle = {
  width: "min(92vw, 600px)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "white",
  padding: 20,
  borderRadius: 12,
};

const labelStyle = { display: "block", marginTop: 8, marginBottom: 6, fontSize: 13 };
const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" };
const inputStyleFile = { width: "100%" };
const saveButtonStyle = { background: "#0b79ff", color: "white", padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer" };
const clearButtonStyle = { background: "#eee", color: "#333", padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer" };
const closeButtonStyle = { background: "#f5f5f5", color: "#333", padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer" };
