"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function ApiCodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.codeWindow}>
      <div className={styles.codeBar}>
        <span className={styles.dotRed} />
        <span className={styles.dotYellow} />
        <span className={styles.dotGreen} />
        <span className={styles.codeLanguage}>{language}</span>
        <button type="button" onClick={copyCode}>{copied ? "Tersalin" : "Salin"}</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}
