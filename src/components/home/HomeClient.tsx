"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FiArrowLeft,
  FiChevronRight,
  FiMenu,
  FiX,
} from "react-icons/fi";
import bagasPhoto from "@/app/assets/Bagas.jpg";
import logoImage from "@/app/assets/Logo.png";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { formatRupiah } from "@/data/products";
import { getCartCount } from "@/lib/cart";
import { fetchStoreData } from "@/lib/store-client";
import VoiceWavePlayer from "@/components/media/VoiceWavePlayer";
import type {
  StoreInformation,
  StoreMarqueeItem,
  StoreProduct,
  StoreTestimonial,
} from "@/types/store";
import styles from "./HomeClient.module.css";

type MenuLayer = "closed" | "main" | "products";

type HomeProduct = StoreProduct;
type HomeInformation = StoreInformation;
type HomeTestimonial = StoreTestimonial;
type HomeMarquee = StoreMarqueeItem;
const MARQUEE_LOOP_COUNT = 4;
const POLL_VOTE_STORAGE_KEY = "tokko_poll_votes";
const PROFILE_AVATAR_STORAGE_KEY = "tokko_profile_avatar";
const ACCESS_LOG_THROTTLE_KEY = "tokko_last_access_log";
const INTRO_MIN_DURATION_MS = 3000;
const INTRO_MAX_WAIT_MS = 12000;
const heroImage = "/assets/ramadhan.jpg";

function getTestimonialMediaSrc(item: HomeTestimonial) {
  return item.name.trim().toLowerCase() === "founder" ? bagasPhoto.src : item.mediaUrl;
}

export default function HomeClient() {
  const rootRef = useRef<HTMLElement | null>(null);
  const introOverlayRef = useRef<HTMLDivElement | null>(null);
  const introSpinnerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const mainPanelRef = useRef<HTMLDivElement | null>(null);
  const productsPanelRef = useRef<HTMLDivElement | null>(null);
  const menuFabRef = useRef<HTMLButtonElement | null>(null);
  const testimonialViewportRef = useRef<HTMLDivElement | null>(null);
  const testimonialDragStartRef = useRef(0);
  const testimonialStartScrollRef = useRef(0);
  const previousLayerRef = useRef<MenuLayer>("closed");
  const introClosingRef = useRef(false);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [showIntro, setShowIntro] = useState(true);
  const [storeDataReady, setStoreDataReady] = useState(false);
  const [introMinimumElapsed, setIntroMinimumElapsed] = useState(false);
  const [introForceClose, setIntroForceClose] = useState(false);
  const [menuLayer, setMenuLayer] = useState<MenuLayer>("closed");
  const [menuMounted, setMenuMounted] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [cartCount, setCartCount] = useState(0);
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [informations, setInformations] = useState<HomeInformation[]>([]);
  const [testimonials, setTestimonials] = useState<HomeTestimonial[]>([]);
  const [marquees, setMarquees] = useState<HomeMarquee[]>([]);
  const [isTestimonialDragging, setIsTestimonialDragging] = useState(false);
  const [pollSelections, setPollSelections] = useState<Record<string, string>>({});
  const [activePollVoteId, setActivePollVoteId] = useState<string | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");

  const categories = useMemo(() => {
    const set = new Set(products.map((product) => product.category));
    return [...set];
  }, [products]);

  const productMenuItems = useMemo(() => categories.slice(0, 10), [categories]);

  const bestSellerProducts = products.slice(0, 8);
  const shouldAutoSlideTestimonials = testimonials.length > 1;
  const activeMarquees = useMemo(() => {
    return marquees
      .filter((item) => item.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [marquees]);
  const testimonialCarouselItems = useMemo(
    () =>
      shouldAutoSlideTestimonials
        ? [...testimonials, ...testimonials, ...testimonials]
        : testimonials,
    [testimonials, shouldAutoSlideTestimonials],
  );
  const isViewportLocked = showIntro || menuMounted;
  const profileImageSource =
    sessionStatus === "authenticated"
      ? profileAvatarPreview || session?.user?.image || ""
      : "";

  const profileLabel = (() => {
    const source =
      session?.user?.username ||
      session?.user?.name ||
      session?.user?.email ||
      "P";
    return source.trim().charAt(0).toUpperCase() || "P";
  })();

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

  const onTestimonialPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = testimonialViewportRef.current;
    if (!viewport) {
      return;
    }
    setIsTestimonialDragging(true);
    testimonialDragStartRef.current = event.clientX;
    testimonialStartScrollRef.current = viewport.scrollLeft;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onTestimonialPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isTestimonialDragging) {
      return;
    }
    const viewport = testimonialViewportRef.current;
    if (!viewport) {
      return;
    }
    const diff = event.clientX - testimonialDragStartRef.current;
    viewport.scrollLeft = testimonialStartScrollRef.current - diff;
  };

  const onTestimonialPointerUp = () => {
    const viewport = testimonialViewportRef.current;
    if (viewport && shouldAutoSlideTestimonials) {
      const segment = viewport.scrollWidth / 3;
      if (viewport.scrollLeft < segment * 0.5) {
        viewport.scrollLeft += segment;
      } else if (viewport.scrollLeft > segment * 2.5) {
        viewport.scrollLeft -= segment;
      }
    }
    setIsTestimonialDragging(false);
  };

  useEffect(() => {
    const syncState = () => {
      setCartCount(getCartCount());
      if (sessionStatus !== "authenticated") {
        setProfileAvatarPreview("");
        return;
      }
      try {
        const avatar = window.localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY) ?? "";
        setProfileAvatarPreview(avatar);
      } catch {
        setProfileAvatarPreview("");
      }
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
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || typeof window === "undefined") {
      return;
    }

    const nowMs = Date.now();
    const throttleMs = 5 * 60 * 1000;
    const lastLoggedRaw = window.localStorage.getItem(ACCESS_LOG_THROTTLE_KEY) ?? "";
    const lastLogged = Number(lastLoggedRaw || 0);
    if (Number.isFinite(lastLogged) && nowMs - lastLogged < throttleMs) {
      return;
    }

    window.localStorage.setItem(ACCESS_LOG_THROTTLE_KEY, String(nowMs));
    fetch("/api/activity/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, [sessionStatus]);

  useEffect(() => {
    let mounted = true;
    const forceCloseTimer = window.setTimeout(() => {
      if (!mounted) {
        return;
      }
      setIntroForceClose(true);
    }, INTRO_MAX_WAIT_MS);

    fetchStoreData()
      .then((data) => {
        if (!mounted) {
          return;
        }
        setProducts(data.products ?? []);
        setInformations(data.informations ?? []);
        setTestimonials(data.testimonials ?? []);
        setMarquees(data.marquees ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!mounted) {
          return;
        }
        setStoreDataReady(true);
      });

    return () => {
      mounted = false;
      window.clearTimeout(forceCloseTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(POLL_VOTE_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, string>;
      setPollSelections(parsed);
    } catch {}
  }, []);

  const onVotePoll = async (informationId: string, option: string) => {
    if (pollSelections[informationId]) {
      return;
    }

    setActivePollVoteId(informationId);
    try {
      const response = await fetch(`/api/informations/${informationId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ option }),
      });
      const payload = (await response.json()) as {
        message?: string;
        information?: HomeInformation;
      };
      if (!response.ok || !payload.information) {
        return;
      }

      setInformations((current) =>
        current.map((item) =>
          item.id === informationId ? payload.information ?? item : item,
        ),
      );
      setPollSelections((current) => {
        const next = {
          ...current,
          [informationId]: option,
        };
        try {
          window.localStorage.setItem(POLL_VOTE_STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch {
    } finally {
      setActivePollVoteId(null);
    }
  };

  useEffect(() => {
    const viewport = testimonialViewportRef.current;
    if (!viewport) {
      return;
    }
    if (shouldAutoSlideTestimonials) {
      viewport.scrollLeft = viewport.scrollWidth / 3;
      return;
    }
    viewport.scrollLeft = 0;
  }, [testimonialCarouselItems.length, shouldAutoSlideTestimonials]);

  useEffect(() => {
    if (!shouldAutoSlideTestimonials) {
      return;
    }

    let frameId = 0;
    const tick = () => {
      const viewport = testimonialViewportRef.current;
      if (viewport && !isTestimonialDragging) {
        viewport.scrollLeft += 0.35;
        const segment = viewport.scrollWidth / 3;
        if (viewport.scrollLeft >= segment * 2) {
          viewport.scrollLeft = segment + (viewport.scrollLeft - segment * 2);
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [shouldAutoSlideTestimonials, isTestimonialDragging, testimonialCarouselItems.length]);

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

    return () => {
      spinnerTween?.kill();
    };
  }, [showIntro]);

  useEffect(() => {
    if (!showIntro) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIntroMinimumElapsed(true);
    }, INTRO_MIN_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showIntro]);

  useEffect(() => {
    if (!showIntro || introClosingRef.current) {
      return;
    }

    if (!introForceClose && !introMinimumElapsed) {
      return;
    }

    introClosingRef.current = true;
    const intro = introOverlayRef.current;
    const closeIntro = () => {
      const audio = new Audio("/assets/buy.mp3");
      audio.volume = 0.82;
      audio.play().catch(() => {});
      setShowIntro(false);
    };

    if (!intro) {
      closeIntro();
      return;
    }

    gsap.to(intro, {
      opacity: 0,
      duration: 0.78,
      ease: "power3.inOut",
      onComplete: closeIntro,
    });
  }, [showIntro, introForceClose, introMinimumElapsed, storeDataReady]);

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
          {sessionStatus === "authenticated" ? (
            <button
              type="button"
              className={styles.profileShortcut}
              onClick={() => router.push("/profil")}
            >
              {profileImageSource ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageSource} alt="Profil" className={styles.profileShortcutImage} />
              ) : (
                <span>{profileLabel}</span>
              )}
            </button>
          ) : null}
        </div>

        <div className={styles.heroBottom} data-animate="hero">
          <h1 className={styles.heroTitle}>
            <span>Tokko</span>
            <span></span>
          </h1>
          <div className={styles.heroSearchWrap}>
            <button
              type="button"
              className={styles.heroSearchButton}
              onClick={() => router.push("/koleksi")}
            >
              Liat Semua
            </button>
          </div>
        </div>
      </section>

      {!storeDataReady ? <div className={styles.storeLoadingBadge}>Tunggu sebentar yaa..</div> : null}

      {bestSellerProducts.length > 0 ? (
      <section className={styles.section} data-animate="section">
        <div className={styles.sectionHead}>
          <h2>Produk Baru</h2>
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
                  <FlexibleMedia
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
      ) : null}

      {informations.length > 0 ? (
      <section className={styles.section} data-animate="section" id="informasi">
        <div className={styles.sectionHead}>
          <h2>Informasi</h2>
        </div>
        <div className={styles.infoList}>
          {informations.map((item) => (
            <article key={item.id} className={styles.infoCard}>
              <div className={styles.infoImageWrap}>
                <FlexibleMedia
                  src={item.imageUrl}
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
                {item.type === "poll" && item.pollOptions.length > 0 ? (
                  <div className={styles.pollCard}>
                    {item.pollOptions.map((option) => {
                      const totalVotes = item.pollOptions.reduce(
                        (total, currentOption) => total + (item.pollVotes[currentOption] ?? 0),
                        0,
                      );
                      const votes = item.pollVotes[option] ?? 0;
                      const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                      const isSelected = pollSelections[item.id] === option;
                      const hasVoted = Boolean(pollSelections[item.id]);
                      return (
                        <button
                          key={`${item.id}-${option}`}
                          type="button"
                          className={`${styles.pollOptionButton} ${isSelected ? styles.pollOptionButtonActive : ""}`}
                          onClick={() => onVotePoll(item.id, option)}
                          disabled={hasVoted || activePollVoteId === item.id}
                        >
                          <span>{option}</span>
                          <strong>{votes} suara</strong>
                          <i style={{ width: `${percent}%` }} />
                        </button>
                      );
                    })}
                    <p className={styles.pollMeta}>
                      Total suara:{" "}
                      {item.pollOptions.reduce(
                        (total, option) => total + (item.pollVotes[option] ?? 0),
                        0,
                      )}
                      {pollSelections[item.id] ? " - Vote kamu sudah tersimpan" : ""}
                    </p>
                  </div>
                ) : null}
                <time>{new Date(item.createdAt).toLocaleDateString("id-ID")}</time>
              </div>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {testimonials.length > 0 || activeMarquees.length > 0 ? (
      <section className={styles.section} data-animate="section">
        <div className={styles.partnerHeader}>
          <h2>Apa Kata Mereka?</h2>
        </div>
        <div
          className={styles.partnerCarousel}
          ref={testimonialViewportRef}
          onPointerDown={onTestimonialPointerDown}
          onPointerMove={onTestimonialPointerMove}
          onPointerUp={onTestimonialPointerUp}
          onPointerCancel={onTestimonialPointerUp}
          style={{ cursor: isTestimonialDragging ? "grabbing" : "grab" }}
        >
          {testimonials.length > 0 ? (
            <div className={styles.partnerTrack}>
              {testimonialCarouselItems.map((item, index) => (
                <article key={`${item.id}-${index}`} className={styles.partnerCard}>
                  <div className={styles.partnerTop}>
                    <div className={styles.partnerPhoto}>
                      <FlexibleMedia
                        src={getTestimonialMediaSrc(item)}
                        alt={item.name}
                        fill
                        className={styles.bagasImage}
                        sizes="(max-width: 820px) 72vw, 220px"
                      />
                    </div>
                    <div className={styles.partnerMeta}>
                      <span className={styles.bagasPill}>
                        {"\u2605".repeat(Math.max(1, Math.min(5, item.rating)))}
                      </span>
                      <span className={styles.bagasPill}>
                        {item.roleLabel || item.country || "Indonesia"}
                      </span>
                    </div>
                  </div>
                  <h3 className={styles.bagasName}>{item.name}</h3>
                  <p className={styles.testimonialText}>{item.message}</p>
                  <VoiceWavePlayer
                    srcCandidates={[item.audioUrl, "/assets/notif.mp3", "/assets/Notif.mp3", "/assets/buy.mp3"]}
                  />
                </article>
              ))}
            </div>
          ) : null}
        </div>

        {activeMarquees.length > 0 ? (
          <div className={styles.logoMarquee}>
            <div
              className={styles.logoTrack}
              style={{ ["--logo-count" as const]: activeMarquees.length } as CSSProperties}
            >
              {Array.from({ length: MARQUEE_LOOP_COUNT }).map((_, loopIndex) => (
                <div
                  key={`logo-segment-${loopIndex}`}
                  className={styles.logoSegment}
                  aria-hidden={loopIndex > 0}
                >
                  {activeMarquees.map((item, logoIndex) => (
                    <div key={`${item.id}-${loopIndex}-${logoIndex}`} className={styles.logoGlyph}>
                      <FlexibleMedia
                        src={item.imageUrl}
                        alt={item.label}
                        fill
                        className={styles.logoImage}
                        sizes="58px"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

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
                <button type="button" onClick={() => moveMenu("products", 1)} data-menu-item>
                  Semua Layanan
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
                <button type="button" onClick={() => router.push("/troli")} data-menu-item>
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
                Semua Layanan
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

          </div>
        </aside>
      ) : null}
    </main>
  );
}
