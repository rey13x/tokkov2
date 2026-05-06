"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiChevronRight, FiUser } from "react-icons/fi";
import { FaInstagram, FaWhatsapp, FaLinkedin } from "react-icons/fa";
import type { PortfolioItem, HomepageConfig } from "@/types/store";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import styles from "./PortfolioClient.module.css";

const logoImage = "/assets/logo.png";

export default function PortfolioClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [isLoading, setIsLoading] = useState(true);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [profileImageSource, setProfileImageSource] = useState("");
  const [activeFeatureKey, setActiveFeatureKey] = useState<string | null>(null);

  const featureItems = [
    { key: "Founder", title: "Tokko, Bisnis Teman Sukses, & Gadev" },
    { key: "Supplier", title: "App Premium" },
    { key: "Bussiness", title: "Tokko, Bisnis Teman Sukses & Book Spirit" },
    { key: "Design Graphics", title: "95%" },
    { key: "Animation", title: "80%" },
    { key: "System Automation", title: "85%" },
    { key: "Web/App Development", title: "95%" },
  ];

  const profileLabel = (() => {
    const source =
      session?.user?.username ||
      session?.user?.name ||
      session?.user?.email ||
      "P";
    return source.trim().charAt(0).toUpperCase() || "P";
  })();

  const heroSocialLinks = [
    {
      key: "instagram",
      href: "https://www.instagram.com/sixsevenrai/",
      label: "Instagram",
      tooltip: "@sixsevenrai",
      icon: FaInstagram,
    },
    {
      key: "whatsapp",
      href: "https://wa.me/6285121579597?text=Halo%20Founder%20aku%20dari%20website%20Tokko%20%F0%9F%91%8B%F0%9F%8F%BB",
      label: "WhatsApp",
      tooltip: "+62",
      icon: FaWhatsapp,
    },
    {
      key: "linkedin",
      href: "https://www.linkedin.com/in/raihaanbagastiampratama/",
      label: "LinkedIn",
      tooltip: "@raihaanbp",
      icon: FaLinkedin,
    },
  ];

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
    if (sessionStatus === "authenticated") {
      try {
        const avatar = window.localStorage.getItem("tokko_profile_avatar") ?? "";
        setProfileImageSource(avatar);
      } catch {
        setProfileImageSource("");
      }
    }
  }, [sessionStatus]);

  return (
    <main className={styles.page}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <Link href="/" aria-label="Beranda">
              <Image
                src={logoImage}
                alt="Raihaan Bp Logo"
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

          <div className={styles.heroBanner}>
            <Image
              src="/assets/bagas.jpg"
              alt="Banner Raihaan Bp"
              fill
              className={styles.heroBannerImage}
              priority
            />
          </div>

          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>Raihaan Bp</h1>
            <div className={styles.heroFeatureList}>
              {featureItems.map((feature) => (
                <button
                  key={feature.key}
                  type="button"
                  className={`${styles.featureItem} ${
                    activeFeatureKey === feature.key ? styles.featureItemActive : ""
                  }`}
                  onClick={() => setActiveFeatureKey(feature.key)}
                  onMouseEnter={() => setActiveFeatureKey(feature.key)}
                  onMouseLeave={() => setActiveFeatureKey(null)}
                >
                  {feature.key}
                  {activeFeatureKey === feature.key ? (
                    <span className={styles.featureTooltip}>{feature.title}</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className={styles.heroSocialsMask}>
              <div className={styles.heroSocials}>
                {[...heroSocialLinks, ...heroSocialLinks, ...heroSocialLinks, ...heroSocialLinks].map((social, index) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={`${social.key}-${index}`}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={social.label}
                      className={styles.socialIcon}
                    >
                      <Icon />
                    </a>
                  );
                })}
              </div>
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
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.portfolioImageLink}
                    >
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
                    </a>
                  ) : (
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
                  )}

                  <div className={styles.portfolioBody}>
                    <span className={styles.portfolioCategory}>{item.category}</span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noreferrer" className={styles.portfolioLink}>
                        Baca Selengkapnya <FiChevronRight />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

    </main>
  );
}

