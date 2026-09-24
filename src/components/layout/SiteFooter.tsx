"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { FooterSocialLink } from "@/types/store";
import styles from "./SiteFooter.module.css";

const DEFAULT_FOOTER_LINKS: FooterSocialLink[] = [
  {
    id: "default-whatsapp",
    label: "WhatsApp",
    url: "https://wa.me/6285121579597?text=Halo%20Founder%20aku%20dari%20website%20Tokko%20%F0%9F%91%8B%F0%9F%8F%BB",
    isActive: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-instagram",
    label: "Instagram",
    url: "https://www.instagram.com/sixsevenrai/",
    isActive: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-telegram",
    label: "Saluran Telegram",
    url: "https://t.me/tokkomarketplace",
    isActive: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-whatsapp-channel",
    label: "Saluran Whatsapp",
    url: "https://whatsapp.com/channel/0029VbCXa1ADDmFMNzoE6b0k",
    isActive: true,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-founder",
    label: "Founder",
    url: "https://byrai-three.vercel.app",
    isActive: true,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
  },
];

export default function SiteFooter() {
  const pathname = usePathname();
  const [footerLinks, setFooterLinks] = useState<FooterSocialLink[]>(DEFAULT_FOOTER_LINKS);

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
        const normalizedLinks = (data.links || DEFAULT_FOOTER_LINKS)
          .filter((item) => item && item.isActive !== false && item.url?.trim())
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setFooterLinks(normalizedLinks.length ? normalizedLinks : DEFAULT_FOOTER_LINKS);
      })
      .catch(() => {
        if (isMounted) {
          setFooterLinks(DEFAULT_FOOTER_LINKS);
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
