"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiArrowLeft, FiChevronRight, FiMenu, FiUser, FiX } from "react-icons/fi";
import type { PortfolioItem, HomepageConfig } from "@/types/store";
import { formatRupiah } from "@/data/products";
import { getCartCount } from "@/lib/cart";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import styles from "./PortfolioClient.module.css";

type MenuLayer = "closed" | "main" | "services" | "supplier-premium";

const logoImage = "/assets/logo.png";

export default function PortfolioClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const menuFabRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const mainPanelRef = useRef<HTMLDivElement | null>(null);
  const servicesPanelRef = useRef<HTMLDivElement | null>(null);
  const supplierPremiumPanelRef = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [menuLayer, setMenuLayer] = useState<MenuLayer>("closed");
  const [menuMounted, setMenuMounted] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [profileImageSource, setProfileImageSource] = useState("");

  const profileLabel = (() => {
    const source =
      session?.user?.username ||
      session?.user?.name ||
      session?.user?.email ||
      "P";
    return source.trim().charAt(0).toUpperCase() || "P";
  })();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/portfolio");
        const data = await response.json();
        setPortfolioItems(data.portfolioItems || []);
        setConfig(data.homepageConfig || null);
      } catch (error) {
        console.error("Failed to load portfolio data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    setCartCount(getCartCount());
    if (sessionStatus === "authenticated") {
      try {
        const avatar = window.localStorage.getItem("tokko_profile_avatar") ?? "";
        setProfileImageSource(avatar);
      } catch {
        setProfileImageSource("");
      }
    }
  }, [sessionStatus]);

  const openMenu = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    setMenuMounted(true);
    setMenuLayer("main");
  };

  const closeMenu = () => {
    setMenuLayer("closed");
    setMenuMounted(false);
  };

  const moveMenu = (nextLayer: Exclude<MenuLayer, "closed">) => {
    setMenuLayer(nextLayer);
  };

  return (
    <main className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <Link href="/" aria-label="Beranda">
              <Image
                src={logoImage}
                alt="Tokko Logo"
                className={styles.logo}
                width={60}
                height={60}
                priority
              />
            </Link>
            {sessionStatus === "authenticated" ? (
              <button
                type="button"
                className={styles.profileShortcut}
                onClick={() => router.push("/profil")}
              >
                {profileImageSource ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileImageSource} alt="Profil" className={styles.profileImage} />
                ) : (
                  <span>{profileLabel}</span>
                )}
              </button>
            ) : (
              <button
                type="button"
                className={styles.profileShortcut}
                onClick={() => router.push("/auth")}
                aria-label="Login"
              >
                <FiUser />
              </button>
            )}
          </div>

          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>{config?.heroTitle || "Tokko"}</h1>
            <p className={styles.heroSubtitle}>{config?.heroSubtitle || "Your Digital Vision, Perfectly Realized."}</p>
            <div className={styles.ctaButtons}>
              <button
                type="button"
                className={styles.ctaButton}
                onClick={() => {
                  const element = document.getElementById("portfolio-section");
                  element?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                View Work
              </button>
              <button
                type="button"
                className={`${styles.ctaButton} ${styles.ctaButtonSecondary}`}
                onClick={() => router.push("/profil")}
              >
                Get In Touch
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      {config?.portfolioEnabled && portfolioItems.length > 0 && (
        <section className={styles.portfolioSection} id="portfolio-section">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2>{config?.portfolioSectionTitle || "Portfolio"}</h2>
            </div>
            <div className={styles.portfolioGrid}>
              {portfolioItems.map((item) => (
                <article key={item.id} className={styles.portfolioCard}>
                  <div className={styles.portfolioImageWrap}>
                    <FlexibleMedia
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className={styles.portfolioImage}
                      sizes="(max-width: 900px) 90vw, 45vw"
                      unoptimized
                    />
                  </div>
                  <div className={styles.portfolioBody}>
                    <span className={styles.portfolioCategory}>{item.category}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noreferrer" className={styles.portfolioLink}>
                        View Project <FiChevronRight />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Menu Button */}
      <button type="button" className={styles.menuFab} onClick={openMenu} ref={menuFabRef}>
        <FiMenu />
        Menu
      </button>

      {/* Mobile Menu */}
      {menuMounted && (
        <aside className={styles.menuOverlay} ref={overlayRef} aria-modal="true" role="dialog">
          <div className={styles.menuPanels}>
            {/* Main Menu */}
            <section
              className={`${styles.menuPanel} ${menuLayer === "main" ? styles.menuPanelActive : ""}`}
              ref={mainPanelRef}
            >
              <div className={styles.menuTop}>
                <Link href="/" aria-label="Beranda">
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} width={50} height={50} />
                </Link>
              </div>

              <nav className={styles.menuNav} aria-label="Menu utama">
                <button type="button" onClick={() => moveMenu("services")} data-menu-item>
                  Layanan
                  <span>
                    <FiChevronRight />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      sessionStatus === "authenticated" ? "/profil" : "/auth?redirect=/profil",
                    )
                  }
                  data-menu-item
                >
                  Profil
                </button>
              </nav>

              <div className={styles.menuFooter}>
                <button type="button" onClick={closeMenu} className={styles.menuCloseButton}>
                  <FiX />
                  Tutup
                </button>
              </div>
            </section>

            {/* Services Menu */}
            <section
              className={`${styles.menuPanel} ${menuLayer === "services" ? styles.menuPanelActive : ""}`}
              ref={servicesPanelRef}
            >
              <div className={styles.menuTop}>
                <Link href="/" aria-label="Beranda">
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} width={50} height={50} />
                </Link>
              </div>
              <p className={styles.menuLabel} data-menu-item>
                Layanan
              </p>
              <nav className={styles.menuNav} aria-label="Menu layanan">
                <button
                  type="button"
                  onClick={() => router.push("/book-spirit")}
                  data-menu-item
                >
                  Book Spirit
                  <span>
                    <FiChevronRight />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => moveMenu("supplier-premium")}
                  data-menu-item
                >
                  Supplier Premium
                  <span>
                    <FiChevronRight />
                  </span>
                </button>
              </nav>

              <div className={styles.menuFooterDouble}>
                <button
                  type="button"
                  className={styles.menuBackButton}
                  onClick={() => moveMenu("main")}
                >
                  <FiArrowLeft />
                  Kembali
                </button>
                <button type="button" className={styles.menuCloseButton} onClick={closeMenu}>
                  <FiX />
                  Tutup
                </button>
              </div>
            </section>

            {/* Supplier Premium Menu */}
            <section
              className={`${styles.menuPanel} ${menuLayer === "supplier-premium" ? styles.menuPanelActive : ""}`}
              ref={supplierPremiumPanelRef}
            >
              <div className={styles.menuTop}>
                <Link href="/" aria-label="Beranda">
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} width={50} height={50} />
                </Link>
              </div>
              <p className={styles.menuLabel} data-menu-item>
                Supplier Premium
              </p>
              <p className={styles.menuSubLabel} data-menu-item>
                App Premium
              </p>
              <nav className={styles.menuNav} aria-label="Menu app premium">
                <button
                  type="button"
                  onClick={() => router.push("/troli")}
                  data-menu-item
                >
                  Troli ({cartCount})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      sessionStatus === "authenticated"
                        ? "/status-pemesanan"
                        : "/auth?redirect=/status-pemesanan",
                    )
                  }
                  data-menu-item
                >
                  Status Pemesanan
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/koleksi")}
                  data-menu-item
                >
                  Lihat Semua Produk
                </button>
              </nav>

              <div className={styles.menuFooterDouble}>
                <button
                  type="button"
                  className={styles.menuBackButton}
                  onClick={() => moveMenu("services")}
                >
                  <FiArrowLeft />
                  Kembali
                </button>
                <button type="button" className={styles.menuCloseButton} onClick={closeMenu}>
                  <FiX />
                  Tutup
                </button>
              </div>
            </section>
          </div>
        </aside>
      )}
    </main>
  );
}
