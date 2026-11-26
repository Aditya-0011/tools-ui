export class FetchError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(
    message: string,
    status: number,
    retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}
