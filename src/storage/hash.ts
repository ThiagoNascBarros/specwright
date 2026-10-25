import { createHash } from 'node:crypto';

/** First 16 hex chars of the SHA-256 of `text`, ignoring the BOM and CRLF/CR line-ending differences. */
export function contentHash(text: string): string {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
