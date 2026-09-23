export function withSobat(message: unknown): string {
  if (typeof message !== "string") {
    return message == null ? "" : String(message);
  }

  const trimmed = message.trim();
  if (!trimmed || /\bsobat\b/i.test(trimmed)) {
    return message;
  }

  return `${trimmed.replace(/[.!?]+$/, "")}, Sobat.`;
}
