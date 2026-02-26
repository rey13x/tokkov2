import Link from "next/link";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <h2>Tokko</h2>
          <p>Marketplace digital modern untuk layanan dan produk premium.</p>
        </div>
        <nav className={styles.links} aria-label="Footer link">
          <Link href="/">Beranda</Link>
          <Link href="/troli">Troli</Link>
          <Link href="/profil">Profil</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </div>
    </footer>
  );
}

