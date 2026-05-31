"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { CallBackProps, Step } from "react-joyride";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FiArrowLeft,
  FiChevronRight,
  FiMenu,
  FiUser,
  FiX,
} from "react-icons/fi";
import bagasPhoto from "@/app/assets/Bagas.jpg";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import ProductCard from "@/components/home/ProductCard";
import { formatRupiah } from "@/data/products";
import { HERO_BACKGROUND_URLS, CAROUSEL_PHOTOS_ONLY, ANIMATION_DURATION_MS, getPhotoDuration } from "@/data/hero-backgrounds";
import { getCartCount } from "@/lib/cart";
import AppOnboardingJoyride from "@/components/onboarding/AppOnboardingJoyride";
import {
  ONBOARDING_BOOT_QUERY_KEY,
  ONBOARDING_STAGE,
  advanceOnboarding,
  clearOnboardingBootQuery,
  consumeOnboardingBootRequest,
  isOnboardingStageActive,
  requestOnboardingBoot,
  startOnboarding,
} from "@/lib/onboarding";
import { fetchStoreData } from "@/lib/store-client";
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
const POLL_VOTE_STORAGE_KEY = "tokko_poll_votes";
const PROFILE_AVATAR_STORAGE_KEY = "tokko_profile_avatar";
const ACCESS_LOG_THROTTLE_KEY = "tokko_last_access_log";
const logoImage = "/assets/logov2.svg";

function getTestimonialMediaSrc(item: HomeTestimonial) {
  return item.name.trim().toLowerCase() === "founder" ? bagasPhoto.src : item.mediaUrl;
}

export default function HomeClient() {
  const rootRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const mainPanelRef = useRef<HTMLDivElement | null>(null);
  const productsPanelRef = useRef<HTMLDivElement | null>(null);
  const menuFabRef = useRef<HTMLButtonElement | null>(null);
  const informationViewportRef = useRef<HTMLDivElement | null>(null);
  const logoViewportRef = useRef<HTMLDivElement | null>(null);
  const testimonialViewportRef = useRef<HTMLDivElement | null>(null);
  const testimonialDragStartRef = useRef(0);
  const testimonialStartScrollRef = useRef(0);
  const previousLayerRef = useRef<MenuLayer>("closed");
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [storeDataReady, setStoreDataReady] = useState(false);
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
  const [isHomeTutorialRunning, setIsHomeTutorialRunning] = useState(false);
  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0);
  const heroImage = HERO_BACKGROUND_URLS[currentBackgroundIndex] || "/assets/backgroundv2.png";

  const categories = useMemo(() => {
    const set = new Set(products.map((product) => product.category));
    return [...set];
  }, [products]);

  const productMenuItems = useMemo(() => categories.slice(0, 10), [categories]);

  const bestSellerProducts = products.slice(0, 8);
  const shouldAutoSlideInformations = informations.length > 1;
  const informationCarouselItems = useMemo(
    () =>
      shouldAutoSlideInformations
        ? [...informations, ...informations, ...informations]
        : informations,
    [informations, shouldAutoSlideInformations],
  );
  const homeTutorialSteps = useMemo<Step[]>(
    () => [
      {
        target: "[data-onboarding='home-product-card']",
        content: "Pilih produk yang ingin kamu beli.",
        placement: "bottom",
        disableBeacon: true,
        hideFooter: true,
      },
    ],
    [],
  );
  const shouldAutoSlideTestimonials = testimonials.length > 1;
  const activeMarquees = useMemo(() => {
    return marquees;
  }, [marquees]);
  // Enable marquee animation for any number of active logos (creates infinite loop with proper spacing)
  const shouldAutoSlideMarquees = activeMarquees.length > 0;
  // Perbanyak pengulangan agar track panjang dan tidak ada area kosong
  const marqueeCarouselItems = useMemo(
    () =>
      shouldAutoSlideMarquees && activeMarquees.length > 0
        ? [
            ...activeMarquees,
            ...activeMarquees,
            ...activeMarquees,
            ...activeMarquees,
            ...activeMarquees,
          ]
        : activeMarquees,
    [activeMarquees, shouldAutoSlideMarquees],
  );
  const testimonialCarouselItems = useMemo(
    () =>
      shouldAutoSlideTestimonials
        ? [...testimonials, ...testimonials, ...testimonials]
        : testimonials,
    [testimonials, shouldAutoSlideTestimonials],
  );
  const isViewportLocked = menuMounted;
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

  const onStartOrderGuide = () => {
    if (typeof window === "undefined") {
      return;
    }

    requestOnboardingBoot();
    startOnboarding();

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set(ONBOARDING_BOOT_QUERY_KEY, "1");
    window.location.assign(`${currentUrl.pathname}?${currentUrl.searchParams.toString()}`);
  };

  const onHomeTutorialCallback = (payload: CallBackProps) => {
    if (payload.type === "error:target_not_found") {
      setIsHomeTutorialRunning(false);
    }
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

  // Preload semua hero background images untuk smooth transition tanpa loading delay
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    HERO_BACKGROUND_URLS.forEach((url) => {
      const img = new (window.Image as any)();
      img.src = url;
    });
  }, []);

  // Background carousel effect - random dengan durasi berbeda per foto
  useEffect(() => {
    if (CAROUSEL_PHOTOS_ONLY.length === 0) {
      return;
    }

    // Ambil foto carousel yang bukan foto awal
    const carouselPhotos = CAROUSEL_PHOTOS_ONLY;
    let timeoutId: NodeJS.Timeout;

    const scheduleNextCarousel = () => {
      // Pilih random foto dari carousel
      const randomIndex = Math.floor(Math.random() * carouselPhotos.length);
      const nextPhotoUrl = carouselPhotos[randomIndex];
      const nextPhotoIndex = HERO_BACKGROUND_URLS.indexOf(nextPhotoUrl);

      // Set foto baru
      setCurrentBackgroundIndex(nextPhotoIndex >= 0 ? nextPhotoIndex : 1);

      // Ambil durasi untuk foto ini dan schedule foto berikutnya
      const pauseDuration = getPhotoDuration(nextPhotoUrl);
      timeoutId = setTimeout(scheduleNextCarousel, pauseDuration);
    };

    // Mulai carousel setelah loading awal
    timeoutId = setTimeout(scheduleNextCarousel, getPhotoDuration(HERO_BACKGROUND_URLS[0]));

    return () => clearTimeout(timeoutId);
  }, []);

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
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get(ONBOARDING_BOOT_QUERY_KEY) === "1";
    const fromStorage = consumeOnboardingBootRequest();
    if (!fromQuery && !fromStorage) {
      return;
    }

    startOnboarding();
    clearOnboardingBootQuery();
  }, []);

  useEffect(() => {
    let mounted = true;

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
    const viewport = informationViewportRef.current;
    if (!viewport) {
      return;
    }

    if (shouldAutoSlideInformations) {
      viewport.scrollLeft = viewport.scrollWidth / 3;
      return;
    }

    viewport.scrollLeft = 0;
  }, [informationCarouselItems.length, shouldAutoSlideInformations]);

  useEffect(() => {
    if (!shouldAutoSlideInformations) {
      return;
    }

    let frameId = 0;
    const tick = () => {
      const viewport = informationViewportRef.current;
      if (viewport) {
        viewport.scrollLeft += 0.24;
        const segment = viewport.scrollWidth / 3;
        if (viewport.scrollLeft >= segment * 2) {
          viewport.scrollLeft = segment + (viewport.scrollLeft - segment * 2);
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [shouldAutoSlideInformations, informationCarouselItems.length]);

  useEffect(() => {
    const viewport = logoViewportRef.current;
    if (!viewport) {
      return;
    }
    if (shouldAutoSlideMarquees) {
      viewport.scrollLeft = viewport.scrollWidth / 3;
      return;
    }
    viewport.scrollLeft = 0;
  }, [marqueeCarouselItems.length, shouldAutoSlideMarquees]);

  useEffect(() => {
    if (!shouldAutoSlideMarquees) {
      return;
    }

    let frameId = 0;
    const tick = () => {
      const viewport = logoViewportRef.current;
      if (viewport) {
        viewport.scrollLeft += 0.28;
        const segment = viewport.scrollWidth / 3;
        if (viewport.scrollLeft >= segment * 2) {
          viewport.scrollLeft = segment + (viewport.scrollLeft - segment * 2);
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [shouldAutoSlideMarquees, marqueeCarouselItems.length]);

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
  }, [bestSellerProducts.length]);

  useEffect(() => {
    const shouldRun =
      storeDataReady &&
      !menuMounted &&
      bestSellerProducts.length > 0 &&
      isOnboardingStageActive(ONBOARDING_STAGE.HOME_PRODUCT);

    setIsHomeTutorialRunning(shouldRun);

    if (!shouldRun) {
      return;
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>("[data-onboarding='home-product-card']");
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 160);

    return () => window.clearTimeout(timer);
  }, [storeDataReady, menuMounted, bestSellerProducts.length]);

  const renderInformationCard = (item: HomeInformation, key: string) => (
    <article key={key} className={styles.infoCard}>
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
  );

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
      <section className={styles.hero} style={heroVars} data-animate="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={heroImage}
          src={heroImage}
          alt="Latar Tokko"
          className={styles.heroImage}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
        />
        <div className={styles.heroShade} />

        <div className={styles.heroTop} data-animate="hero">
          <Link href="/" aria-label="Beranda" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Image src={logoImage} alt="Tokko Logo" className={styles.logo} width={86} height={86} priority />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              Semua Layanan
            </button>
          </div>
        </div>
      </section>

      {!storeDataReady ? <div className={styles.storeLoadingBadge} style={{ textAlign: 'center' }}>Pastikan Internet kamu Stabil...</div> : null}

      <AppOnboardingJoyride
        run={isHomeTutorialRunning}
        steps={homeTutorialSteps}
        onCallback={onHomeTutorialCallback}
      />

      {bestSellerProducts.length > 0 ? (
      <section className={styles.section} data-animate="section">
        <div className={styles.sectionHead}>
          <h2>Produk Baru</h2>
          <button
            type="button"
            className={styles.inlineAction}
            onClick={() => router.push("/koleksi")}
          >
            Semua Layanan <span>{">"}</span>
          </button>
        </div>
        <div className={styles.productGrid}>
          {bestSellerProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              onboardingStage={index === 0 ? "home-product-card" : undefined}
              onClick={() => {
                if (isOnboardingStageActive(ONBOARDING_STAGE.HOME_PRODUCT)) {
                  advanceOnboarding(ONBOARDING_STAGE.PRODUCT_ADD_TO_CART);
                }
              }}
            />
          ))}
        </div>
      </section>
      ) : null}

      {informations.length > 0 ? (
      <section className={styles.section} data-animate="section" id="book-spirit">
        <div className={styles.sectionHead}>
          <h2>Informasi</h2>
        </div>
        {shouldAutoSlideInformations ? (
          <div className={styles.infoCarousel} ref={informationViewportRef}>
            <div className={styles.infoTrack}>
              {informationCarouselItems.map((item, index) =>
                renderInformationCard(item, `${item.id}-${index}`),
              )}
            </div>
          </div>
        ) : (
          <div className={styles.infoList}>
            {informations.map((item) => renderInformationCard(item, item.id))}
          </div>
        )}
      </section>
      ) : null}

      {testimonials.length > 0 || activeMarquees.length > 0 ? (
      <section className={styles.section} data-animate="section">
        <div className={styles.partnerHeader}>
          <h2>Bekerja sama dengan</h2>
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
                  </div>
                  <h3 className={styles.bagasName}>{item.name}</h3>
                  <p className={styles.testimonialText}>{item.message}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        {activeMarquees.length > 0 ? (
          <div className={styles.logoMarquee} ref={logoViewportRef}>
            <div className={styles.logoTrack}>
              {marqueeCarouselItems.map((item, index) => (
                <div key={`${item.id}-${index}`} className={styles.logoGlyph}>
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
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} width={60} height={60} />
                </Link>
              </div>

              <nav className={styles.menuNav} aria-label="Menu utama">
                <button type="button" onClick={() => moveMenu("products", 1)} data-menu-item>
                  Semua Layanan
                  <span>
                    <FiChevronRight />
                  </span>
                </button>
                <button type="button" onClick={() => router.push("/book-spirit")} data-menu-item>
                  Testimoni
                  <span>
                    <FiChevronRight />
                  </span>
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
                  <Image src={logoImage} alt="Tokko Logo" className={styles.menuLogo} width={60} height={60} />
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
