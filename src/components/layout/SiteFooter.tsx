import Image from "next/image";
import Link from "next/link";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Image
            src="/assets/logo.png"
            alt="Tokko Logo"
            width={42}
            height={42}
            className={styles.logo}
            unoptimized
          />
          <div>
            <h2>Tokko</h2>
            <p>Marketplace digital modern untuk layanan dan produk premium.</p>
          </div>
        </div>
        <nav className={styles.links} aria-label="Footer link">
          <Link href="/">Beranda</Link>
          <Link href="/troli">Troli</Link>
          <Link href="/profil">Profil</Link>
          <Link href="/admin">Admin</Link>
          <a href="https://wa.me/6281319865384" target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <a href="https://instagram.com/13bagas.exv" target="_blank" rel="noreferrer">
            Instagram
          </a>
        </nav>
      </div>
    </footer>
  );
}
