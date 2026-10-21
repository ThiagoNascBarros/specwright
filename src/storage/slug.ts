/** Lowercase ASCII slug of `text` ([a-z0-9-]), at most `max` characters; may be empty. */
export function slugify(text: string, max = 50): string {
  const full = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (full.length <= max) return full;
  // Cut at a word boundary when there is one, so slugs never end mid-word.
  const cut = full.slice(0, max + 1);
  const boundary = cut.lastIndexOf('-');
  return (boundary > 0 ? cut.slice(0, boundary) : full.slice(0, max)).replace(/-+$/g, '');
}

/** Local calendar date as YYYY-MM-DD. */
export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
