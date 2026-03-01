"use client";

import { useSyncExternalStore } from "react";
import Joyride, { type CallBackProps, type Step } from "react-joyride";

type AppOnboardingJoyrideProps = {
  run: boolean;
  steps: Step[];
  onCallback?: (payload: CallBackProps) => void;
};

export default function AppOnboardingJoyride({
  run,
  steps,
  onCallback,
}: AppOnboardingJoyrideProps) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) {
    return null;
  }

  return (
    <Joyride
      run={run}
      steps={steps}
      callback={onCallback}
      disableCloseOnEsc
      disableOverlayClose
      hideCloseButton
      showSkipButton={false}
      scrollToFirstStep
      scrollDuration={460}
      spotlightClicks
      continuous
      styles={{
        options: {
          zIndex: 1400,
          overlayColor: "rgba(9, 13, 22, 0.72)",
          primaryColor: "#111827",
          textColor: "#111827",
          backgroundColor: "#ffffff",
          arrowColor: "#ffffff",
        },
        tooltip: {
          borderRadius: 14,
          padding: 0,
          animation: "onboardingZoom 0.22s ease-out",
        },
        tooltipContainer: {
          padding: "14px 16px",
          textAlign: "left",
        },
        buttonClose: {
          display: "none",
        },
        buttonSkip: {
          display: "none",
        },
        buttonBack: {
          display: "none",
        },
        buttonNext: {
          borderRadius: 10,
          fontSize: "0.84rem",
          padding: "8px 12px",
        },
        spotlight: {
          borderRadius: 14,
          boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.9)",
          transition: "all 0.24s ease",
        },
      }}
      locale={{
        back: "Kembali",
        close: "Tutup",
        last: "Selesai",
        next: "Oke",
        nextLabelWithProgress: "Lanjut ({step}/{steps})",
        skip: "Lewati",
      }}
    />
  );
}
