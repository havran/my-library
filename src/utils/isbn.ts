export function normalizeISBN(s: string): string {
  return s.replace(/[-\s]/g, "").toUpperCase();
}

export function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = s[i];
    const d = c === "X" ? 10 : Number(c);
    sum += (10 - i) * d;
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

export function isbn10To13(s: string): string | null {
  const x = normalizeISBN(s);
  if (x.length !== 10) return null;
  const base = "978" + x.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

export function isbn13To10(s: string): string | null {
  const x = normalizeISBN(s);
  if (x.length !== 13 || !x.startsWith("978")) return null;
  const base = x.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(base[i]);
  const mod = (11 - (sum % 11)) % 11;
  const check = mod === 10 ? "X" : String(mod);
  return base + check;
}

/** Return the other-format ISBN if possible (ISBN-10 ↔ ISBN-13 with 978 prefix), else null. */
export function alternateISBN(isbn: string): string | null {
  const x = normalizeISBN(isbn);
  if (x.length === 10) return isbn10To13(x);
  if (x.length === 13) return isbn13To10(x);
  return null;
}
