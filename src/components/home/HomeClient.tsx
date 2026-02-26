"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import heroImage from "@/app/assets/Background.jpg";
import logoImage from "@/app/assets/Logo.png";
import {
  featuredProducts,
  formatRupiah,
  informationItems as fallbackInformationItems,
  products as fallbackProducts,
} from "@/data/products";
import { getCartCount } from "@/lib/cart";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreInformation, StoreProduct } from "@/types/store";
import styles from "./HomeClient.module.css";

type CategoryFilter = "Semua" | string;
type MenuLayer = "closed" | "main" | "products" | "services";

type HomeProduct = StoreProduct;
type HomeInformation = StoreInformation;

function mapFallbackProducts(): HomeProduct[] {
  return fallbackProducts.map((product) => ({
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    category: product.category,
    shortDescription: product.shortDescription,
    description: product.description,
    price: product.price,
    imageUrl: product.image.src,
    isActive: true,
  }));
}

function mapFallbackInformations(): HomeInformation[] {
  return fallbackInformationItems.map((item) => ({
    id: item.id,
    type: "update",
    title: item.title,
    body: item.description,
    imageUrl: item.image.src,
    pollOptions: [],
    createdAt: new Date().toISOString(),
  }));
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.7" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16.2 20 20.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 7h15M4.5 12h15M4.5 17h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HomeClient() {
  const rootRef = useRef<HTMLElement | null>(null);
  const introOverlayRef = useRef<HTMLDivElement | null>(null);
  const introSpinnerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const mainPanelRef = useRef<HTMLDivElement | null>(null);
  const productsPanelRef = useRef<HTMLDivElement | null>(null);
  const servicesPanelRef = useRef<HTMLDivElement | null>(null);
  const menuFabRef = useRef<HTMLButtonElement | null>(null);
  const previousLayerRef = useRef<MenuLayer>("closed");
  const router = useRouter();
  const { data: session } = useSession();

  const [query, setQuery] = useState("");
  const [showIntro, setShowIntro] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("Semua");
  const [menuLayer, setMenuLayer] = useState<MenuLayer>("closed");
  const [menuMounted, setMenuMounted] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [cartCount, setCartCount] = useState(0);
  const [products, setProducts] = useState<HomeProduct[]>(mapFallbackProducts);
  const [informations, setInformations] = useState<HomeInformation[]>(
    mapFallbackInformations,
  );

  const normalizedQuery = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const set = new Set(products.map((product) => product.category));
    return [...set];
  }, [products]);

  const productMenuItems = useMemo(
    () => categories.filter((category) => !category.toLowerCase().includes("jasa")).slice(0, 6),
    [categories],
  );
  const serviceMenuItems = useMemo(
    () => categories.filter((category) => category.toLowerCase().includes("jasa")).slice(0, 6),
    [categories],
  );

  const bestSellerProducts = (() => {
    const fallbackBest = featuredProducts.map((product) => product.slug);
    const dbBest = products.filter((product) => fallbackBest.includes(product.slug));

    if (dbBest.length > 0) {
      return dbBest.slice(0, 8);
    }

    return products.slice(0, 8);
  })();

  const collectionProducts = useMemo(() => {
    return products.filter((product) => {
      const matchCategory =
        activeCategory === "Semua" || product.category === activeCategory;
      const searchText =
        `${product.name} ${product.category} ${product.shortDescription}`.toLowerCase();
      const matchQuery = normalizedQuery.length === 0 || searchText.includes(normalizedQuery);
      return matchCategory && matchQuery;
    });
  }, [activeCategory, normalizedQuery, products]);

  function openMenu() {
    setTransitionDirection(1);
    setMenuMounted(true);
    setMenuLayer("main");
  }

  function closeMenu() {
    const overlay = overlayRef.current;
    if (!overlay) {
      setMenuLayer("closed");
      setMenuMounted(false);
      previousLayerRef.current = "closed";
      return;
    }

    gsap.to(overlay, {
      opacity: 0,
      duration: 0.42,
      ease: "power3.inOut",
      onComplete: () => {
        setMenuLayer("closed");
        setMenuMounted(false);
        previousLayerRef.current = "closed";
      },
    });
  }

  function moveMenu(nextLayer: Exclude<MenuLayer, "closed">, direction: 1 | -1) {
    setTransitionDirection(direction);
    setMenuLayer(nextLayer);
  }

  const focusSearch = () => {
    closeMenu();
    window.setTimeout(() => searchInputRef.current?.focus(), 110);
  };

  const chooseCategory = (category: string) => {
    setActiveCategory(category);
    closeMenu();
  };

  useEffect(() => {
    const syncState = () => {
      setCartCount(getCartCount());
    };

    syncState();

    const onFocus = () => syncState();
    const onStorage = () => syncState();

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchStoreData()
      .then((data) => {
        if (!mounted) {
          return;
        }
        if (data.products.length > 0) {
          setProducts(data.products);
        }
        if (data.informations.length > 0) {
          setInformations(data.informations);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showIntro) {
      return;
    }

    const spinner = introSpinnerRef.current;
    const intro = introOverlayRef.current;

    const spinnerTween = spinner
      ? gsap.to(spinner, {
          rotation: 360,
          duration: 1.35,
          repeat: -1,
          ease: "none",
        })
      : null;

    if (intro) {
      gsap.set(intro, { opacity: 1 });
    }

    const timer = window.setTimeout(() => {
      if (!intro) {
        setShowIntro(false);
        return;
      }

      gsap.to(intro, {
        opacity: 0,
        duration: 0.78,
        ease: "power3.inOut",
        onComplete: () => setShowIntro(false),
      });
    }, 3000);

    return () => {
      spinnerTween?.kill();
      window.clearTimeout(timer);
    };
  }, [showIntro]);

  useEffect(() => {
    if (showIntro) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-animate='hero']",
        { y: 38, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.09,
          ease: "back.out(1.55)",
        },
      );

      const sections = gsap.utils.toArray<HTMLElement>("[data-animate='section']");
      sections.forEach((section) => {
        gsap.fromTo(
          section,
          { y: 44, opacity: 0.12, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.84,
            ease: "back.out(1.2)",
            scrollTrigger: {
              trigger: section,
              start: "top 86%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });

      const cards = gsap.utils.toArray<HTMLElement>("[data-card='product']");
      cards.forEach((card, index) => {
        gsap.fromTo(
          card,
          { y: 26 + (index % 3) * 6, opacity: 0, rotateZ: index % 2 === 0 ? -1 : 1 },
          {
            y: 0,
            opacity: 1,
            rotateZ: 0,
            duration: 0.82,
            ease: "back.out(1.18)",
            scrollTrigger: {
              trigger: card,
              start: "top 92%",
              toggleActions: "play none none reverse",
            },
          },
        );
      });

      if (menuFabRef.current) {
        gsap.to(menuFabRef.current, {
          y: -6,
          duration: 1.1,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
    }, rootRef);

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      ctx.revert();
    };
  }, [showIntro, collectionProducts.length, bestSellerProducts.length]);

  useEffect(() => {
    if (!menuMounted) {
      return;
    }

    const overlay = overlayRef.current;
    if (overlay) {
      gsap.set(overlay, { opacity: 0 });
      gsap.to(overlay, {
        opacity: 1,
        duration: 0.48,
        ease: "power3.out",
      });
    }
  }, [menuMounted]);

  useEffect(() => {
    if (!menuMounted || menuLayer === "closed") {
      return;
    }

    const panelMap: Record<Exclude<MenuLayer, "closed">, HTMLDivElement | null> = {
      main: mainPanelRef.current,
      products: productsPanelRef.current,
      services: servicesPanelRef.current,
    };

    const incomingPanel = panelMap[menuLayer];
    const previousLayer = previousLayerRef.current;
    const previousPanel =
      previousLayer === "closed" ? null : panelMap[previousLayer as Exclude<MenuLayer, "closed">];

    if (previousPanel && previousPanel !== incomingPanel) {
      gsap.to(previousPanel, {
        x: transitionDirection > 0 ? -28 : 28,
        opacity: 0,
        duration: 0.32,
        ease: "power3.inOut",
        onComplete: () => {
          gsap.set(previousPanel, { display: "none" });
        },
      });
    }

    if (incomingPanel) {
      gsap.set(incomingPanel, { display: "flex" });
      gsap.fromTo(
        incomingPanel,
        {
          x: transitionDirection > 0 ? 34 : -34,
          opacity: 0,
        },
        {
          x: 0,
          opacity: 1,
          duration: 0.56,
          ease: "power3.out",
        },
      );
    }

    previousLayerRef.current = menuLayer;
  }, [menuLayer, menuMounted, transitionDirection]);

  useEffect(() => {
    if (!menuMounted) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [menuMounted]);

  const heroVars = {
    ["--hero-blur" as const]: menuMounted ? "6px" : "0px",
  } as CSSProperties;

  return (
    <main className={styles.page} ref={rootRef}>
      {showIntro ? (
        <div className={styles.introOverlay} ref={introOverlayRef}>
          <Image src={heroImage} alt="" fill className={styles.introBackdrop} sizes="100vw" priority />
          <div className={styles.introShade} />
          <div className={styles.introCenter}>
            <div className={styles.introRing}>
              <div className={styles.introSpinner} ref={introSpinnerRef} />
              <div className={styles.introLogoWrap}>
                <Image src={logoImage} alt="Tokko" className={styles.introLogo} priority />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className={styles.hero} style={heroVars} data-animate="hero">
        <Image
          src={heroImage}
          alt="Latar Tokko"
          fill
          priority
          className={styles.heroImage}
          sizes="100vw"
        />
        <div className={styles.heroShade} />

        <div className={styles.heroTop} data-animate="hero">
          <Image src={logoImage} alt="Tokko Logo" className={styles.logo} priority />
          <button
            type="button"
            className={styles.roundSearchButton}
            onClick={() => searchInputRef.current?.focus()}
            aria-label="Cari produk"
          >
            <SearchIcon />
          </button>
        </div>

        <div className={styles.heroBottom} data-animate="hero">
          <h1 className={styles.heroTitle}>Tokko</h1>
          <div className={styles.heroSearchWrap}>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={styles.heroSearchInput}
              type="search"
              placeholder="Tokko"
              aria-label="Cari produk dan layanan"
            />
          </div>
        </div>
      </section>

      <section className={styles.section} data-animate="section">
        <div className={styles.sectionHead}>
          <h2>Produk Terbaik</h2>
          <button
            type="button"
            className={styles.inlineAction}
            onClick={() => setActiveCategory("Semua")}
          >
            Liat Semua <span>{">"}</span>
          </button>
        </div>
        <div className={styles.productGrid}>
          {bestSellerProducts.map((product) => (
            <article key={product.id} className={styles.productShell} data-card="product">
              <Link href={`/produk/${product.slug}`} className={styles.productCard}>
                <div className={styles.productImageWrap}>
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className={styles.productImage}
                    sizes="(max-width: 760px) 44vw, (max-width: 1140px) 30vw, 20vw"
                    unoptimized
                  />
                </div>
                <div className={styles.floatingMeta}>
                  <div>
                    <p>{product.name}</p>
                    <span>{formatRupiah(product.price)}</span>
                  </div>
                  <i>{">"}</i>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} data-animate="section" id="informasi">
        <div className={styles.sectionHead}>
          <h2>Informasi</h2>
        </div>
        <div className={styles.infoList}>
          {informations.map((item) => (
            <article key={item.id} className={styles.infoCard}>
              <div className={styles.infoImageWrap}>
                <Image
                  src={item.imageUrl || "/assets/background.jpg"}
                  alt={item.title}
                  fill
                  className={styles.infoImage}
                  sizes="(max-width: 900px) 34vw, 180px"
                  unoptimized
                />
              </div>
              <div className={styles.infoBody}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <time>{new Date(item.createdAt).toLocaleDateString("id-ID")}</time>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} data-animate="section" id="produk">
        <div className={styles.sectionHead}>
          <h2>Our Collections</h2>
        </div>
        <div className={styles.categoryRow}>
          <button
            type="button"
            onClick={() => setActiveCategory("Semua")}
            className={`${styles.categoryChip} ${
              activeCategory === "Semua" ? styles.categoryChipActive : ""
            }`}
          >
            Semua
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`${styles.categoryChip} ${
                activeCategory === category ? styles.categoryChipActive : ""
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {collectionProducts.length > 0 ? (
          <div className={styles.productGrid}>
            {collectionProducts.map((product) => (
              <article key={`collection-${product.id}`} className={styles.productShell} data-card="product">
                <Link href={`/produk/${product.slug}`} className={styles.productCard}>
                  <div className={styles.productImageWrap}>
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className={styles.productImage}
                      sizes="(max-width: 760px) 44vw, (max-width: 1140px) 30vw, 20vw"
                      unoptimized
                    />
                  </div>
                  <div className={styles.floatingMeta}>
                    <div>
                      <p>{product.name}</p>
                      <span>{formatRupiah(product.price)}</span>
                    </div>
                    <i>{">"}</i>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>Produk tidak ditemukan untuk filter ini.</p>
        )}
      </section>

      <button type="button" className={styles.menuFab} onClick={openMenu} ref={menuFabRef}>
        <MenuIcon />
        Menu
      </button>

      {menuMounted ? (
        <aside className={styles.menuOverlay} ref={overlayRef} aria-modal="true" role="dialog">
          <Image src={heroImage} alt="" fill className={styles.menuBackdropImage} sizes="100vw" />
          <div className={styles.menuBackdropShade} />

          <div className={styles.menuPanels}>
            <section className={`${styles.menuPanel} ${styles.menuPanelMain}`} ref={mainPanelRef}>
              <div className={styles.menuTop}>
                <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} />
                <button type="button" onClick={focusSearch} className={styles.menuSearchButton}>
                  <SearchIcon />
                </button>
              </div>

              <nav className={styles.menuNav} aria-label="Menu utama">
                <button type="button" onClick={() => moveMenu("services", 1)}>
                  Semua Layanan
                  <span>{">"}</span>
                </button>
                <button type="button" onClick={() => moveMenu("products", 1)}>
                  Semua Produk
                  <span>{">"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    window.setTimeout(() => {
                      document.getElementById("informasi")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 110);
                  }}
                >
                  Panduan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      session?.user?.id ? "/profil" : "/auth?redirect=/profil",
                    )
                  }
                >
                  Akun
                </button>
                {session?.user?.role === "admin" ? (
                  <button type="button" onClick={() => router.push("/admin")}>
                    Admin
                  </button>
                ) : null}
                <button type="button" onClick={() => router.push("/troli")}>
                  Troli ({cartCount})
                </button>
              </nav>

              <div className={styles.menuFooterMain}>
                <button type="button" onClick={closeMenu} className={styles.menuActionButton}>
                  <span className={styles.menuActionIcon}>x</span>
                  Tutup
                </button>
              </div>
            </section>

            <section className={`${styles.menuPanel} ${styles.menuPanelSub}`} ref={productsPanelRef}>
              <div className={styles.menuTop}>
                <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} />
                <button type="button" onClick={focusSearch} className={styles.menuSearchButton}>
                  <SearchIcon />
                </button>
              </div>
              <p className={styles.menuLabel}>Semua Produk</p>
              <nav className={styles.menuNav} aria-label="Menu produk">
                {productMenuItems.map((item) => (
                  <button key={item} type="button" onClick={() => chooseCategory(item)}>
                    {item}
                    <span>{">"}</span>
                  </button>
                ))}
              </nav>

              <div className={styles.menuFooterDouble}>
                <button
                  type="button"
                  className={styles.menuActionButton}
                  onClick={() => moveMenu("main", -1)}
                >
                  <span className={styles.menuActionIcon}>{"<"}</span>
                  Kembali
                </button>
                <button type="button" className={styles.menuActionButton} onClick={closeMenu}>
                  <span className={styles.menuActionIcon}>x</span>
                  Tutup
                </button>
              </div>
            </section>

            <section className={`${styles.menuPanel} ${styles.menuPanelSub}`} ref={servicesPanelRef}>
              <div className={styles.menuTop}>
                <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} />
                <button type="button" onClick={focusSearch} className={styles.menuSearchButton}>
                  <SearchIcon />
                </button>
              </div>
              <p className={styles.menuLabel}>Semua Layanan</p>
              <nav className={styles.menuNav} aria-label="Menu layanan">
                {serviceMenuItems.map((item) => (
                  <button key={item} type="button" onClick={() => chooseCategory(item)}>
                    {item}
                    <span>{">"}</span>
                  </button>
                ))}
              </nav>

              <div className={styles.menuFooterDouble}>
                <button
                  type="button"
                  className={styles.menuActionButton}
                  onClick={() => moveMenu("main", -1)}
                >
                  <span className={styles.menuActionIcon}>{"<"}</span>
                  Kembali
                </button>
                <button type="button" className={styles.menuActionButton} onClick={closeMenu}>
                  <span className={styles.menuActionIcon}>x</span>
                  Tutup
                </button>
              </div>
            </section>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
