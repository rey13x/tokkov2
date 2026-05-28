import Image from "next/image";
import Link from "next/link";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" aria-label="Beranda">
            <Image
              src="/assets/logo.png"
              alt="Tokko Logo"
              width={86}
              height={86}
              className={styles.logo}
              unoptimized
            />
          </Link>
          <div>
            <h2>
              Tokko
              <br />
              Marketplace
            </h2>
          </div>
        </div>
        <div className={styles.contactWrap}>
          <nav className={styles.links} aria-label="Footer link">
            <a href="https://wa.me/6285121579597?text=Halo%20Founder%20aku%20dari%20website%20Tokko%20%F0%9F%91%8B%F0%9F%8F%BB" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a href="https://www.instagram.com/sixsevenrai/" target="_blank" rel="noreferrer">
              Instagram
            </a>
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
