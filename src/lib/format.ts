export function relativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

/** Saffir-Simpson category for a sustained wind speed. */
export function hurricaneCategory(windMph: number | undefined): string {
  if (!windMph) return "?";
  if (windMph >= 157) return "5";
  if (windMph >= 130) return "4";
  if (windMph >= 111) return "3";
  if (windMph >= 96) return "2";
  if (windMph >= 74) return "1";
  return "TS";
}
