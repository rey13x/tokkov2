"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";
import FlexibleMedia from "@/components/media/FlexibleMedia";
import { fetchStoreData } from "@/lib/store-client";
import type { StoreInformation } from "@/types/store";
import styles from "./[id]/InformasiDetailClient.module.css";

type Props = {
  id: string;
};

export default function InformasiDetailClient({ id }: Props) {
  const router = useRouter();
  const [information, setInformation] = useState<StoreInformation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollSelections, setPollSelections] = useState<Record<string, string>>({});
  const [activePollVoteId, setActivePollVoteId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchStoreData();
        const found = data.informations?.find((info) => info.id === id);
        if (found) {
          setInformation(found);
        }
      } catch (error) {
        console.error("Failed to fetch information:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handlePollVote = async (optionIndex: number) => {
    if (!information || activePollVoteId) {
      return;
    }

    try {
      setActivePollVoteId(information.id);
      const response = await fetch(`/api/admin/informations/${information.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollVotes: {
            ...information.pollVotes,
            [optionIndex]: (information.pollVotes[optionIndex] || 0) + 1,
          },
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setInformation(updated);
        setPollSelections({ ...pollSelections, [information.id]: String(optionIndex) });
      }
    } catch (error) {
      console.error("Failed to vote:", error);
    } finally {
      setActivePollVoteId(null);
    }
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingContainer}>
          <p>Tunggu sebentar yaa..</p>
        </div>
      </main>
    );
  }

  if (!information) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => router.back()}
            aria-label="Kembali"
          >
            <FiArrowLeft />
          </button>
          <h1>Informasi</h1>
          <div className={styles.headerPlaceholder} />
        </header>
        <div className={styles.emptyState}>
          <p>Informasi tidak ditemukan</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.back()}
          aria-label="Kembali"
        >
          <FiArrowLeft />
        </button>
        <h1>Informasi</h1>
        <div className={styles.headerPlaceholder} />
      </header>

      <article className={styles.detailContainer}>
        <div className={styles.imageWrap}>
          <FlexibleMedia
            src={information.imageUrl}
            alt={information.title}
            fill
            className={styles.detailImage}
            sizes="(max-width: 600px) 100vw, 600px"
            unoptimized
          />
        </div>

        <div className={styles.content}>
          <h2 className={styles.title}>{information.title}</h2>
          <p className={styles.body}>{information.body}</p>

          {information.type === "poll" && information.pollOptions.length > 0 ? (
            <div className={styles.pollSection}>
              <div className={styles.pollOptions}>
                {information.pollOptions.map((option, index) => {
                  const votes = information.pollVotes[index] || 0;
                  const totalVotes = Object.values(information.pollVotes).reduce(
                    (sum, v) => sum + v,
                    0,
                  );
                  const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                  const isSelected = pollSelections[information.id] === String(index);

                  return (
                    <button
                      key={index}
                      className={`${styles.pollOption} ${isSelected ? styles.pollOptionSelected : ""}`}
                      onClick={() => handlePollVote(index)}
                      disabled={activePollVoteId !== null}
                    >
                      <div className={styles.pollOptionContent}>
                        <span className={styles.pollLabel}>{option}</span>
                        <span className={styles.pollVotes}>{votes} suara</span>
                      </div>
                      <div className={styles.pollBar}>
                        <div
                          className={styles.pollBarFill}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className={styles.pollTotal}>
                Total suara: {Object.values(information.pollVotes).reduce((sum, v) => sum + v, 0)}
              </p>
            </div>
          ) : null}
        </div>
      </article>
    </main>
  );
}
