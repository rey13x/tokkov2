"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, RotateCcw, Trophy } from "lucide-react";
import type { PublicStoreStoryQuiz } from "@/types/store";
import styles from "./StoryQuiz.module.css";

type QuizPhase = "closed" | "splash" | "playing" | "result" | "timeup" | "exit" | "error";
type QuizResult = { score: number; total: number; passed: boolean; reward: string | null };
type AnswerFeedback = { questionId: string; optionIndex: number; isCorrect: boolean };

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function StoryQuiz({ storyId, quiz }: { storyId: string; quiz: PublicStoreStoryQuiz }) {
  const router = useRouter();
  const [phase, setPhase] = useState<QuizPhase>("closed");
  const [activeQuiz, setActiveQuiz] = useState(quiz);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(quiz.durationSeconds);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [focusNotice, setFocusNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const feedbackTimer = useRef<number | null>(null);
  const fullscreenEntered = useRef(false);

  useEffect(() => {
    if (phase !== "splash") {
      return;
    }

    let cancelled = false;
    const splashTimer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/story-reels/${encodeURIComponent(storyId)}/quiz`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start" }),
            cache: "no-store",
          });
          const data = await response.json() as {
            token?: string;
            expiresAt?: number;
            quiz?: PublicStoreStoryQuiz;
            message?: string;
          };
          if (!response.ok || !data.token || !data.expiresAt || !data.quiz) {
            throw new Error(data.message || "Quiz belum bisa dimulai. Coba lagi, Sobat.");
          }
          if (cancelled) {
            return;
          }

          setSessionToken(data.token);
          setExpiresAt(data.expiresAt);
          setActiveQuiz(data.quiz);
          setCurrentQuestionIndex(0);
          setSelectedOption(null);
          setAnswerFeedback(null);
          setRemainingSeconds(data.quiz.durationSeconds);
          setPhase("playing");
        } catch (error) {
          if (!cancelled) {
            setErrorMessage(error instanceof Error ? error.message : "Quiz gagal dimulai.");
            setPhase("error");
          }
        }
      })();
    }, 1450);

    return () => {
      cancelled = true;
      window.clearTimeout(splashTimer);
    };
  }, [phase, storyId]);

  useEffect(() => {
    if (phase !== "playing" || !expiresAt) {
      return;
    }

    const updateTimer = () => {
      const secondsLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(secondsLeft);
      if (secondsLeft === 0) {
        if (feedbackTimer.current !== null) {
          window.clearTimeout(feedbackTimer.current);
          feedbackTimer.current = null;
        }
        setPhase("timeup");
      }
    };
    updateTimer();
    const interval = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(interval);
  }, [expiresAt, phase]);

  useEffect(() => {
    if (phase !== "splash" && phase !== "playing") {
      return;
    }

    const currentUrl = window.location.href;
    const preserveQuizRoute = () => window.history.pushState({ storyQuizActive: true }, "", currentUrl);
    const onPopState = () => {
      preserveQuizRoute();
      setFocusNotice("Selesaikan quiz sebelum meninggalkan halaman ini.");
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    let pageWasHidden = false;
    const onVisibilityChange = () => {
      if (document.hidden) {
        pageWasHidden = true;
      } else if (pageWasHidden && phase === "playing") {
        pageWasHidden = false;
        setFocusNotice("Kamu kembali ke quiz. Waktu tetap berjalan, Sobat.");
      }
    };
    const onFullscreenChange = () => {
      if (fullscreenEntered.current && !document.fullscreenElement && phase === "playing") {
        setFocusNotice("Mode layar penuh tertutup. Waktu quiz tetap berjalan.");
      }
    };

    preserveQuizRoute();
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [phase]);

  const startQuiz = async () => {
    setErrorMessage("");
    setFocusNotice("");
    setResult(null);
    setSessionToken("");
    setAnswerFeedback(null);
    setSelectedOption(null);
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    fullscreenEntered.current = false;
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        fullscreenEntered.current = Boolean(document.fullscreenElement);
      } catch {
        setFocusNotice("Layar penuh tidak tersedia di perangkat ini. Waktu quiz tetap berjalan.");
      }
    }
    setPhase("splash");
  };

  const submitQuiz = async () => {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/story-reels/${encodeURIComponent(storyId)}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          token: sessionToken,
        }),
        cache: "no-store",
      });
      const data = await response.json() as QuizResult & { message?: string };
      if (response.status === 410) {
        setPhase("timeup");
        return;
      }
      if (!response.ok) {
        throw new Error(data.message || "Jawaban belum berhasil dikirim.");
      }
      setResult(data);
      setPhase("result");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Jawaban belum berhasil dikirim.");
      setPhase("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkAnswer = async () => {
    if (!currentQuestion || selectedOption === null || answerFeedback || isCheckingAnswer) {
      return;
    }

    setIsCheckingAnswer(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/story-reels/${encodeURIComponent(storyId)}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          token: sessionToken,
          questionId: currentQuestion.id,
          optionIndex: selectedOption,
        }),
        cache: "no-store",
      });
      const data = await response.json() as { isCorrect?: boolean; message?: string };
      if (response.status === 410) {
        setPhase("timeup");
        return;
      }
      if (!response.ok || typeof data.isCorrect !== "boolean") {
        throw new Error(data.message || "Jawaban belum berhasil diperiksa.");
      }

      const feedback = { questionId: currentQuestion.id, optionIndex: selectedOption, isCorrect: data.isCorrect };
      setAnswerFeedback(feedback);
      feedbackTimer.current = window.setTimeout(() => {
        feedbackTimer.current = null;
        if (currentQuestionIndex === activeQuiz.questions.length - 1) {
          void submitQuiz();
          return;
        }
        setCurrentQuestionIndex((index) => index + 1);
        setSelectedOption(null);
        setAnswerFeedback(null);
      }, 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Jawaban belum berhasil diperiksa.");
      setPhase("error");
    } finally {
      setIsCheckingAnswer(false);
    }
  };

  const exitToHome = async () => {
    setPhase("exit");
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen().catch(() => {});
    }
    window.setTimeout(() => router.push("/"), 700);
  };

  const currentQuestion = activeQuiz.questions[currentQuestionIndex];
  const isShowingCurrentFeedback = answerFeedback?.questionId === currentQuestion?.id;

  return (
    <>
      <button type="button" className={styles.joinButton} onClick={() => void startQuiz()}>
        {quiz.joinButtonText}
      </button>
      {phase !== "closed" ? (
        <div className={styles.quizOverlay} role="dialog" aria-modal="true" aria-labelledby="story-quiz-title">
          {phase === "splash" ? (
            <section className={`${styles.quizPanel} ${styles.splashPanel}`}>
              <div className={styles.splashMark} aria-hidden="true"><span /></div>
              <p className={styles.quizEyebrow}>SOBAT QUIZ</p>
              <h2 id="story-quiz-title">{activeQuiz.title}</h2>
              <p className={styles.splashReward}>{activeQuiz.reward}</p>
              <div className={styles.splashLoading} aria-label="Memuat quiz"><span /><span /><span /></div>
            </section>
          ) : null}

          {phase === "exit" ? (
            <section className={`${styles.quizPanel} ${styles.splashPanel}`}>
              <div className={styles.splashMark} aria-hidden="true"><span /></div>
              <p className={styles.quizEyebrow}>SELESAI BERMAIN</p>
              <h2 id="story-quiz-title">Kembali ke beranda</h2>
              <p className={styles.splashReward}>Sampai ketemu lagi, Sobat.</p>
              <div className={styles.splashLoading} aria-label="Kembali ke beranda"><span /><span /><span /></div>
            </section>
          ) : null}

          {phase === "playing" && currentQuestion ? (
            <section className={styles.quizPanel}>
              <header className={styles.quizHeader}>
                <div className={styles.quizBrand}><span className={styles.brandDot} /> SOBAT QUIZ</div>
                <div className={`${styles.timer} ${remainingSeconds <= 10 ? styles.timerUrgent : ""}`} aria-label={`Sisa waktu ${formatTime(remainingSeconds)}`}>
                  <Clock3 size={18} aria-hidden="true" />
                  <span>{formatTime(remainingSeconds)}</span>
                </div>
              </header>
              <div className={styles.progressTrack} aria-label={`Pertanyaan ${currentQuestionIndex + 1} dari ${activeQuiz.questions.length}`}>
                <span style={{ width: `${((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100}%` }} />
              </div>
              <div className={styles.questionMeta}>PERTANYAAN {String(currentQuestionIndex + 1).padStart(2, "0")} <span>/ {String(activeQuiz.questions.length).padStart(2, "0")}</span></div>
              <h2 className={styles.questionText}>{currentQuestion.prompt}</h2>
              <div className={styles.answerList} role="group" aria-label="Pilihan jawaban">
                {currentQuestion.options.map((option, optionIndex) => (
                  <button
                    type="button"
                    key={`${currentQuestion.id}-${optionIndex}`}
                    className={`${styles.answerOption} ${selectedOption === optionIndex ? styles.answerSelected : ""} ${isShowingCurrentFeedback && answerFeedback.optionIndex === optionIndex ? answerFeedback.isCorrect ? styles.answerCorrect : styles.answerIncorrect : ""}`}
                    aria-pressed={selectedOption === optionIndex}
                    disabled={Boolean(answerFeedback) || isCheckingAnswer}
                    onClick={() => setSelectedOption(optionIndex)}
                  >
                    <span className={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{option}</span>
                  </button>
                ))}
              </div>
              {isShowingCurrentFeedback ? (
                <p className={`${styles.answerFeedback} ${answerFeedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`} role="status">
                  {answerFeedback.isCorrect ? "Tepat, Sobat!" : "Belum tepat, Sobat."} Lanjut dalam 3 detik.
                </p>
              ) : null}
              {focusNotice ? <p className={styles.focusNotice} role="status">{focusNotice}</p> : null}
              <footer className={styles.quizFooter}>
                <span className={styles.quizFooterHint}>
                  {answerFeedback ? "Jawaban terkunci" : "Pilih satu jawaban"}
                </span>
                <button type="button" className={styles.nextButton} disabled={selectedOption === null || isCheckingAnswer || Boolean(answerFeedback) || isSubmitting} onClick={() => void checkAnswer()}>
                  {isCheckingAnswer ? "Memeriksa..." : answerFeedback ? "Lanjut sebentar..." : currentQuestionIndex === activeQuiz.questions.length - 1 ? "Kirim Jawaban" : "Lanjut"}
                </button>
              </footer>
            </section>
          ) : null}

          {phase === "timeup" ? (
            <section className={`${styles.quizPanel} ${styles.outcomePanel}`}>
              <div className={`${styles.outcomeMark} ${styles.timeupMark}`}><Clock3 size={30} aria-hidden="true" /></div>
              <p className={styles.quizEyebrow}>WAKTU SELESAI</p>
              <h2 id="story-quiz-title">Yahh waktu kamu habis sobat</h2>
              <div className={styles.outcomeActions}>
                <button type="button" className={styles.nextButton} onClick={() => void startQuiz()}><RotateCcw size={18} /> Ulang Quiz</button>
                <button type="button" className={styles.backQuestionButton} onClick={() => void exitToHome()}>Keluar</button>
              </div>
            </section>
          ) : null}

          {phase === "result" ? (
            <section className={`${styles.quizPanel} ${styles.outcomePanel} ${result?.passed ? styles.winnerPanel : ""}`}>
              <div className={`${styles.outcomeMark} ${result?.passed ? styles.winnerMark : styles.scoreMark}`}>
                {result?.passed ? <Trophy size={42} aria-hidden="true" /> : <Check size={36} aria-hidden="true" />}
                {result?.passed ? (
                  <>
                    <span className={styles.winnerSparkLeft} aria-hidden="true" />
                    <span className={styles.winnerSparkRight} aria-hidden="true" />
                  </>
                ) : null}
              </div>
              <p className={styles.quizEyebrow}>{result?.passed ? "QUIZ SELESAI" : "HASIL QUIZ"}</p>
              <h2 id="story-quiz-title">{result?.passed ? "Keren banget, Sobat!" : "Usaha bagus, Sobat!"}</h2>
              <p className={styles.scoreLine}>{result?.score} <span>/ {result?.total} jawaban benar</span></p>
              {result?.passed && result.reward ? <p className={styles.rewardCard}>{result.reward}</p> : null}
              <div className={styles.outcomeActions}>
                {!result?.passed ? <button type="button" className={styles.nextButton} onClick={() => void startQuiz()}><RotateCcw size={18} /> Ulang Quiz</button> : null}
                <button type="button" className={styles.backQuestionButton} onClick={() => void exitToHome()}>Ke Beranda</button>
              </div>
            </section>
          ) : null}

          {phase === "error" ? (
            <section className={styles.quizPanel}>
              <p className={styles.quizEyebrow}>SOBAT QUIZ</p>
              <h2 id="story-quiz-title">Belum berhasil, Sobat</h2>
              <p className={styles.errorMessage}>{errorMessage}</p>
              <div className={styles.outcomeActions}>
                <button type="button" className={styles.nextButton} onClick={() => void startQuiz()}><RotateCcw size={18} /> Coba Lagi</button>
                <button type="button" className={styles.backQuestionButton} onClick={() => void exitToHome()}>Ke Beranda</button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}