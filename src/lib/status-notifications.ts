export const STATUS_NOTIFICATION_COUNT_KEY = "tokko_status_notification_count";
export const STATUS_NOTIFICATION_SNAPSHOT_KEY = "tokko_status_notification_snapshot";
export const STATUS_NOTIFICATION_EVENT = "tokko-status-notification-updated";

type OrderStatusSnapshot = Record<string, string>;

type StatusOrder = {
  id: string;
  status: string;
};

function emitStatusNotificationUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STATUS_NOTIFICATION_EVENT));
  }
}

export function readStatusNotificationCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  const count = Number(window.localStorage.getItem(STATUS_NOTIFICATION_COUNT_KEY) ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function clearStatusNotifications() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STATUS_NOTIFICATION_COUNT_KEY);
  emitStatusNotificationUpdate();
}

export function rememberOrderStatuses(orders: StatusOrder[], notify = true) {
  if (typeof window === "undefined") {
    return 0;
  }

  let previous: OrderStatusSnapshot = {};
  try {
    previous = JSON.parse(window.localStorage.getItem(STATUS_NOTIFICATION_SNAPSHOT_KEY) ?? "{}");
  } catch {
    previous = {};
  }

  const next: OrderStatusSnapshot = Object.fromEntries(
    orders.map((order) => [order.id, order.status]),
  );
  const changedCount = Object.entries(next).filter(
    ([id, status]) => previous[id] !== undefined && previous[id] !== status,
  ).length;

  window.localStorage.setItem(STATUS_NOTIFICATION_SNAPSHOT_KEY, JSON.stringify(next));

  if (notify && changedCount > 0) {
    const nextCount = readStatusNotificationCount() + changedCount;
    window.localStorage.setItem(STATUS_NOTIFICATION_COUNT_KEY, String(nextCount));
    emitStatusNotificationUpdate();
  }

  return changedCount;
}
