"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { FooterSocialLink } from "@/types/store";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  const pathname = usePathname();
  const [footerLinks, setFooterLinks] = useState<FooterSocialLink[]>([]);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/footer-links", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load footer links");
        }
        const data = (await response.json()) as { links?: FooterSocialLink[] };
        if (!isMounted) {
          return;
        }
        const normalizedLinks = (data.links ?? [])
          .filter((item) => item && item.isActive !== false && item.url?.trim())
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setFooterLinks(normalizedLinks);
      })
      .catch(() => {
        if (isMounted) {
          setFooterLinks([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (pathname === "/paygate" || pathname.startsWith("/paygate/")) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" aria-label="Beranda">
            <video
              src="/assets/sobatpremium2.mp4"
              className={styles.logo}
              autoPlay
              loop
              muted
              playsInline
              aria-label="Sobat Premium"
            />
          </Link>
        </div>
        <div className={styles.contactWrap}>
          <nav className={styles.links} aria-label="Footer link">
            {footerLinks.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </nav>
          <nav className={styles.policyLinks} aria-label="Kebijakan dan sertifikasi">
            <Link href="/kebijakan-privasi-sertifikasi">
              Kebijakan Privasi & Sertifikasi Layanan
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
