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
        <nav className={styles.links} aria-label="Footer link">
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
