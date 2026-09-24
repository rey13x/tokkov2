export function shouldNotifyOrderCancellation(source?: string | null) {
  const normalized = (source ?? "user").trim().toLowerCase();
  return normalized !== "expired_qris_cleanup" && normalized !== "system_cleanup";
}
