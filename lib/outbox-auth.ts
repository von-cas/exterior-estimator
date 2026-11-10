import { timingSafeEqual } from "node:crypto";

/** n8n proves itself with the shared OUTBOX_SECRET header. */
export function outboxAuthorized(req: Request): boolean {
  const expected = process.env.OUTBOX_SECRET;
  const got = req.headers.get("x-outbox-secret");
  if (!expected || expected.length < 24 || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
