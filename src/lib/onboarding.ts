"use client";

export const ONBOARDING_BOOT_QUERY_KEY = "onboard";
const ONBOARDING_BOOT_REQUEST_KEY = "tokko_onboarding_boot_request";
const ONBOARDING_STATE_KEY = "tokko_onboarding_state";

export const ONBOARDING_STAGE = {
  HOME_PRODUCT: "home_product",
  PRODUCT_ADD_TO_CART: "product_add_to_cart",
  CART_CHECKOUT: "cart_checkout",
  STATUS_PAYMENT_OR_RECEIPT: "status_payment_or_receipt",
  STATUS_CANCEL_REASON: "status_cancel_reason",
  STATUS_CANCEL_SUBMIT: "status_cancel_submit",
  COMPLETED: "completed",
} as const;

export type OnboardingStage = (typeof ONBOARDING_STAGE)[keyof typeof ONBOARDING_STAGE];

type OnboardingState = {
  active: boolean;
  stage: OnboardingStage;
};

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  active: false,
  stage: ONBOARDING_STAGE.HOME_PRODUCT,
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function readStateFromStorage() {
  if (!canUseStorage()) {
    return DEFAULT_ONBOARDING_STATE;
  }

  try {
    const raw = window.sessionStorage.getItem(ONBOARDING_STATE_KEY);
    if (!raw) {
      return DEFAULT_ONBOARDING_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    const stage = parsed.stage;
    if (!stage || typeof stage !== "string") {
      return DEFAULT_ONBOARDING_STATE;
    }

    return {
      active: Boolean(parsed.active),
      stage: stage as OnboardingStage,
    };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

function writeStateToStorage(nextState: OnboardingState) {
  if (!canUseStorage()) {
    return;
  }

  window.sessionStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(nextState));
}

export function getOnboardingState() {
  return readStateFromStorage();
}

export function startOnboarding() {
  writeStateToStorage({
    active: true,
    stage: ONBOARDING_STAGE.HOME_PRODUCT,
  });
}

export function advanceOnboarding(nextStage: OnboardingStage) {
  const currentState = readStateFromStorage();
  if (!currentState.active) {
    return;
  }

  writeStateToStorage({
    active: true,
    stage: nextStage,
  });
}

export function completeOnboarding() {
  writeStateToStorage({
    active: false,
    stage: ONBOARDING_STAGE.COMPLETED,
  });
}

export function isOnboardingStageActive(stage: OnboardingStage) {
  const currentState = readStateFromStorage();
  return currentState.active && currentState.stage === stage;
}

export function requestOnboardingBoot() {
  if (!canUseStorage()) {
    return;
  }

  window.sessionStorage.setItem(ONBOARDING_BOOT_REQUEST_KEY, "1");
}

export function consumeOnboardingBootRequest() {
  if (!canUseStorage()) {
    return false;
  }

  const requested = window.sessionStorage.getItem(ONBOARDING_BOOT_REQUEST_KEY) === "1";
  window.sessionStorage.removeItem(ONBOARDING_BOOT_REQUEST_KEY);
  return requested;
}

export function clearOnboardingBootQuery() {
  if (typeof window === "undefined") {
    return;
  }

  const currentUrl = new URL(window.location.href);
  if (!currentUrl.searchParams.has(ONBOARDING_BOOT_QUERY_KEY)) {
    return;
  }

  currentUrl.searchParams.delete(ONBOARDING_BOOT_QUERY_KEY);
  const nextSearch = currentUrl.searchParams.toString();
  const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}
