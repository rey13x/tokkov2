"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

type NumberTickerProps = {
  value: number;
  startValue?: number;
  delay?: number;
  decimalPlaces?: number;
  locale?: string;
  className?: string;
  onComplete?: () => void;
  reverse?: boolean;
  once?: boolean;
};

export default function NumberTicker({
  value,
  startValue = 0,
  delay = 0,
  decimalPlaces = 0,
  locale = "id-ID",
  className,
  onComplete,
  reverse = false,
  once = false,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const completedTargetRef = useRef<number | null>(null);
  const phaseRef = useRef<"reverse" | "up">(reverse ? "reverse" : "up");
  const isInView = useInView(ref, { once, margin: "0px" });
  const motionValue = useMotionValue(reverse ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 58,
    stiffness: 85,
  });

  useEffect(() => {
    if (!isInView) {
      return undefined;
    }

    phaseRef.current = reverse ? "reverse" : "up";
    completedTargetRef.current = null;
    const downTimer = window.setTimeout(() => {
      if (reverse) {
        motionValue.set(startValue);
      }
    }, delay * 1000 + (reverse ? 180 : 0));
    const upTimer = window.setTimeout(() => {
      phaseRef.current = "up";
      motionValue.set(value);
    }, delay * 1000 + (reverse ? 900 : 0));

    return () => {
      window.clearTimeout(downTimer);
      window.clearTimeout(upTimer);
    };
  }, [delay, isInView, motionValue, reverse, startValue, value]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      if (!ref.current) {
        return;
      }

      const rounded = Number(latest.toFixed(decimalPlaces));
      ref.current.textContent = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(rounded);

      if (
        isInView &&
        phaseRef.current === "up" &&
        value > startValue &&
        Math.abs(latest - value) < 0.5 &&
        completedTargetRef.current !== value
      ) {
        completedTargetRef.current = value;
        onComplete?.();
      }
    });
  }, [decimalPlaces, isInView, locale, onComplete, springValue, startValue, value]);

  return (
    <span ref={ref} className={className}>
      {new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(reverse ? value : startValue)}
    </span>
  );
}