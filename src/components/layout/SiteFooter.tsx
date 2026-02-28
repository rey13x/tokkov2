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
              Ramadhan
            </h2>
          </div>
        </div>
        <div className={styles.contactWrap}>
          <nav className={styles.links} aria-label="Footer link">
            <a href="https://wa.me/6281319865384" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a href="https://instagram.com/layanan_tokko" target="_blank" rel="noreferrer">
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
