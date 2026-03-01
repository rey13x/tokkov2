"use client";

export const ONBOARDING_BOOT_QUERY_KEY = "onboard";
export const ONBOARDING_TUTORIAL_QUERY_KEY = "tutorial";
export const ONBOARDING_TUTORIAL_ORDER_ID = "tutorial-order-demo";
const ONBOARDING_BOOT_REQUEST_KEY = "tokko_onboarding_boot_request";
const ONBOARDING_STATE_KEY = "tokko_onboarding_state";

export const ONBOARDING_STAGE = {
  HOME_PRODUCT: "home_product",
  PRODUCT_ADD_TO_CART: "product_add_to_cart",
  CART_CHECKOUT: "cart_checkout",
  CART_RETURN_STATUS: "cart_return_status",
  STATUS_PAYMENT_OR_RECEIPT: "status_payment_or_receipt",
  STATUS_OPEN_PAYMENT: "status_open_payment",
  STATUS_CLOSE_PAYMENT: "status_close_payment",
  STATUS_OPEN_RECEIPT: "status_open_receipt",
  STATUS_RECEIPT_BACK_TO_CART: "status_receipt_back_to_cart",
  STATUS_CANCEL_REASON: "status_cancel_reason",
  STATUS_CANCEL_SUBMIT: "status_cancel_submit",
  STATUS_SUCCESS: "status_success",
  STATUS_FINISH: "status_finish",
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

export function isOnboardingActive() {
  return readStateFromStorage().active;
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
