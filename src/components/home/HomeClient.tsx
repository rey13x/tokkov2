"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FiArrowLeft,
  FiChevronRight,
  FiMenu,
  FiX,
} from "react-icons/fi";
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
import VoiceWavePlayer from "@/components/media/VoiceWavePlayer";
import type { StoreInformation, StoreProduct, StoreTestimonial } from "@/types/store";
import styles from "./HomeClient.module.css";

type MenuLayer = "closed" | "main" | "products" | "services";

type HomeProduct = StoreProduct;
type HomeInformation = StoreInformation;
type HomeTestimonial = StoreTestimonial;

function mapFallbackProducts(): HomeProduct[] {
  return fallbackProducts
    .filter((product) => product.category === "App Premium")
    .map((product) => ({
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

function mapFallbackTestimonials(): HomeTestimonial[] {
  return [
    {
      id: "fallback-testi-1",
      name: "StrezKING User",
      message:
        "StrezKING memang sangat baik untuk mendapatkan tidur yang lebih baik. Saya coba 10 sachet dan terasa membantu.",
      rating: 5,
      audioUrl: "/assets/bagas.mp3",
      createdAt: new Date().toISOString(),
    },
  ];
}

export default function HomeClient() {
  const rootRef = useRef<HTMLElement | null>(null);
  const introOverlayRef = useRef<HTMLDivElement | null>(null);
  const introSpinnerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const mainPanelRef = useRef<HTMLDivElement | null>(null);
  const productsPanelRef = useRef<HTMLDivElement | null>(null);
  const servicesPanelRef = useRef<HTMLDivElement | null>(null);
  const menuFabRef = useRef<HTMLButtonElement | null>(null);
  const previousLayerRef = useRef<MenuLayer>("closed");
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [showIntro, setShowIntro] = useState(true);
  const [menuLayer, setMenuLayer] = useState<MenuLayer>("closed");
  const [menuMounted, setMenuMounted] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [cartCount, setCartCount] = useState(0);
  const [products, setProducts] = useState<HomeProduct[]>(mapFallbackProducts);
  const [informations, setInformations] = useState<HomeInformation[]>(
    mapFallbackInformations,
  );
  const [testimonials, setTestimonials] = useState<HomeTestimonial[]>(
    mapFallbackTestimonials,
  );
  const [bagasImageIndex, setBagasImageIndex] = useState(0);

  const bagasImageCandidates = [
    "/assets/Bagas.png",
    "/assets/Bagas.jpg",
    "/assets/Bagas.jpeg",
    "/assets/Bagas.webp",
    "/assets/bagas.png",
    "/assets/bagas.jpg",
    "/assets/logo.png",
  ];

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

  const isViewportLocked = showIntro || menuMounted;

  const activateMenu = () => {
    setTransitionDirection(1);
    setMenuMounted(true);
    setMenuLayer("main");
  };

  function openMenu() {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    window.requestAnimationFrame(activateMenu);
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

  const chooseCategory = (category: string) => {
    closeMenu();
    router.push(`/koleksi?category=${encodeURIComponent(category)}`);
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
        if (data.testimonials?.length > 0) {
          setTestimonials(data.testimonials);
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
        const audio = new Audio("/assets/buy.mp3");
        audio.volume = 0.82;
        audio.play().catch(() => {});
        setShowIntro(false);
        return;
      }

      gsap.to(intro, {
        opacity: 0,
        duration: 0.78,
        ease: "power3.inOut",
        onComplete: () => {
          const audio = new Audio("/assets/buy.mp3");
          audio.volume = 0.82;
          audio.play().catch(() => {});
          setShowIntro(false);
        },
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
  }, [showIntro, bestSellerProducts.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Selalu mulai dari paling atas saat refresh/load halaman.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shouldLock = isViewportLocked;
    const html = document.documentElement;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehaviorY;

    if (shouldLock) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      html.style.overflow = "hidden";
      html.style.overscrollBehaviorY = "none";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehaviorY = previousHtmlOverscroll;
    };
  }, [isViewportLocked]);

  useEffect(() => {
    if (!isViewportLocked) {
      return;
    }

    const keepAtTop = () => {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    window.addEventListener("scroll", keepAtTop, { passive: true });
    return () => window.removeEventListener("scroll", keepAtTop);
  }, [isViewportLocked]);

  useEffect(() => {
    if (!menuMounted) {
      return;
    }

    const overlay = overlayRef.current;
    if (overlay) {
      gsap.set(overlay, { opacity: 0 });
      gsap.to(overlay, {
        opacity: 1,
        duration: 0.36,
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
    if (previousLayer === menuLayer) {
      return;
    }

    if (!incomingPanel) {
      return;
    }

    const textNodes = incomingPanel.querySelectorAll<HTMLElement>("[data-menu-item]");
    gsap.fromTo(
      incomingPanel,
      { y: 18, opacity: 0.9 },
      {
        y: 0,
        opacity: 1,
        duration: 0.34,
        ease: "power2.out",
      },
    );
    if (textNodes.length > 0) {
      gsap.fromTo(
        textNodes,
        {
          opacity: 0,
          y: transitionDirection > 0 ? 24 : -20,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.52,
          stagger: 0.05,
          ease: "power2.out",
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
    <main className={`${styles.page} ${isViewportLocked ? styles.pageLocked : ""}`} ref={rootRef}>
      {showIntro ? (
        <div className={styles.introOverlay} ref={introOverlayRef}>
          <Image src={heroImage} alt="" fill className={styles.introBackdrop} sizes="100vw" priority />
          <div className={styles.introShade} />
          <div
            className={styles.introCenter}
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className={styles.introRing}>
              <div className={styles.introSpinner} ref={introSpinnerRef} />
              <div className={styles.introLogoWrap}>
                <Link href="/" aria-label="Beranda">
                  <Image src={logoImage} alt="Tokko" className={styles.introLogo} priority />
                </Link>
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
          <Link href="/" aria-label="Beranda">
            <Image src={logoImage} alt="Tokko Logo" className={styles.logo} priority />
          </Link>
        </div>

        <div className={styles.heroBottom} data-animate="hero">
          <h1 className={styles.heroTitle}>
            <span>Tokko</span>
            <span>Ramadhan</span>
          </h1>
          <div className={styles.heroSearchWrap}>
            <input
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
            onClick={() => router.push("/koleksi")}
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
                  <i>
                    <FiChevronRight />
                  </i>
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

      <section className={styles.section} data-animate="section">
        <div className={styles.bagasFeature}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bagasImageCandidates[bagasImageIndex]}
            alt="Bagas"
            className={styles.bagasImage}
            onError={() => {
              if (bagasImageIndex < bagasImageCandidates.length - 1) {
                setBagasImageIndex((prev) => prev + 1);
              }
            }}
          />
          <VoiceWavePlayer
            srcCandidates={["/assets/bagas.mp3", "/assets/Bagas.mp3", "/assets/buy.mp3"]}
            title="Voice Bagas"
          />
        </div>
      </section>

      <section className={styles.section} data-animate="section">
        <div className={styles.sectionHead}>
          <h2>Apa Kata Mereka?</h2>
        </div>
        <div className={styles.testimonialList}>
          {testimonials.map((item) => (
            <article key={item.id} className={styles.testimonialCard}>
              <p className={styles.testimonialStars}>{"★".repeat(Math.max(1, Math.min(5, item.rating)))}</p>
              <p className={styles.testimonialText}>{item.message}</p>
              <p className={styles.testimonialName}>{item.name}</p>
              <VoiceWavePlayer
                srcCandidates={[item.audioUrl, "/assets/bagas.mp3", "/assets/buy.mp3"]}
              />
            </article>
          ))}
        </div>
      </section>

      <button type="button" className={styles.menuFab} onClick={openMenu} ref={menuFabRef}>
        <FiMenu />
        Menu
      </button>

      {menuMounted ? (
        <aside className={styles.menuOverlay} ref={overlayRef} aria-modal="true" role="dialog">
          <Image src={heroImage} alt="" fill className={styles.menuBackdropImage} sizes="100vw" />
          <div className={styles.menuBackdropShade} />

          <div className={styles.menuPanels}>
            <section
              className={`${styles.menuPanel} ${styles.menuPanelMain} ${
                menuLayer === "main" ? styles.menuPanelActive : ""
              }`}
              ref={mainPanelRef}
            >
              <div className={styles.menuTop}>
                <Link href="/" aria-label="Beranda">
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} />
                </Link>
              </div>

              <nav className={styles.menuNav} aria-label="Menu utama">
                <button type="button" onClick={() => moveMenu("services", 1)} data-menu-item>
                  Semua Layanan
                  <span>
                    <FiChevronRight />
                  </span>
                </button>
                <button type="button" onClick={() => moveMenu("products", 1)} data-menu-item>
                  Semua Produk
                  <span>
                    <FiChevronRight />
                  </span>
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
                  data-menu-item
                >
                  Panduan
                </button>
                <button type="button" onClick={() => router.push("/troli")} data-menu-item>
                  Troli ({cartCount})
                </button>
              </nav>

              <div className={styles.menuFooterMain}>
                <button type="button" onClick={closeMenu} className={styles.menuActionButton}>
                  <span className={styles.menuActionIcon}>
                    <FiX />
                  </span>
                  Tutup
                </button>
              </div>
            </section>

            <section
              className={`${styles.menuPanel} ${styles.menuPanelSub} ${
                menuLayer === "products" ? styles.menuPanelActive : ""
              }`}
              ref={productsPanelRef}
            >
              <div className={styles.menuTop}>
                <Link href="/" aria-label="Beranda">
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} />
                </Link>
              </div>
              <p className={styles.menuLabel} data-menu-item>
                Semua Produk
              </p>
              <nav className={styles.menuNav} aria-label="Menu produk">
                {productMenuItems.map((item) => (
                  <button key={item} type="button" onClick={() => chooseCategory(item)} data-menu-item>
                    {item}
                    <span>
                      <FiChevronRight />
                    </span>
                  </button>
                ))}
              </nav>

              <div className={styles.menuFooterDouble}>
                <button
                  type="button"
                  className={styles.menuActionButton}
                  onClick={() => moveMenu("main", -1)}
                >
                  <span className={styles.menuActionIcon}>
                    <FiArrowLeft />
                  </span>
                  Kembali
                </button>
                <button type="button" className={styles.menuActionButton} onClick={closeMenu}>
                  <span className={styles.menuActionIcon}>
                    <FiX />
                  </span>
                  Tutup
                </button>
              </div>
            </section>

            <section
              className={`${styles.menuPanel} ${styles.menuPanelSub} ${
                menuLayer === "services" ? styles.menuPanelActive : ""
              }`}
              ref={servicesPanelRef}
            >
              <div className={styles.menuTop}>
                <Link href="/" aria-label="Beranda">
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} />
                </Link>
              </div>
              <p className={styles.menuLabel} data-menu-item>
                Semua Layanan
              </p>
              <nav className={styles.menuNav} aria-label="Menu layanan">
                {serviceMenuItems.map((item) => (
                  <button key={item} type="button" onClick={() => chooseCategory(item)} data-menu-item>
                    {item}
                    <span>
                      <FiChevronRight />
                    </span>
                  </button>
                ))}
              </nav>

              <div className={styles.menuFooterDouble}>
                <button
                  type="button"
                  className={styles.menuActionButton}
                  onClick={() => moveMenu("main", -1)}
                >
                  <span className={styles.menuActionIcon}>
                    <FiArrowLeft />
                  </span>
                  Kembali
                </button>
                <button type="button" className={styles.menuActionButton} onClick={closeMenu}>
                  <span className={styles.menuActionIcon}>
                    <FiX />
                  </span>
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
