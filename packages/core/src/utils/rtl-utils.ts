/**
 * RTL and Hebrew text utilities.
 *
 * CutSense fully supports Hebrew, Arabic, and mixed-direction content.
 * These utilities handle bidi detection, text direction, and wrapping.
 */

const RTL_CHAR_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\uFB50-\uFDFF\uFE70-\uFEFF]/;
const HEBREW_REGEX = /[\u0590-\u05FF]/;
const ARABIC_REGEX = /[\u0600-\u06FF]/;

const RTL_LANGUAGES = new Set([
  'he', 'ar', 'fa', 'ur', 'yi', 'iw',
  'heb', 'ara', 'fas', 'urd', 'yid',
]);

export function isRTLLanguage(langCode: string): boolean {
  const normalized = langCode.toLowerCase().split('-')[0]!;
  return RTL_LANGUAGES.has(normalized);
}

export function detectTextDirection(text: string): 'ltr' | 'rtl' {
  let rtlCount = 0;
  let ltrCount = 0;

  for (const char of text) {
    if (RTL_CHAR_REGEX.test(char)) {
      rtlCount++;
    } else if (/[a-zA-Z]/.test(char)) {
      ltrCount++;
    }
  }

  return rtlCount > ltrCount ? 'rtl' : 'ltr';
}

export function containsHebrew(text: string): boolean {
  return HEBREW_REGEX.test(text);
}

export function containsArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

export function containsRTL(text: string): boolean {
  return RTL_CHAR_REGEX.test(text);
}

export function isMixedDirection(text: string): boolean {
  return containsRTL(text) && /[a-zA-Z]/.test(text);
}

export function wrapBidi(text: string, direction: 'ltr' | 'rtl'): string {
  if (direction === 'rtl') {
    return `\u202B${text}\u202C`;
  }
  return `\u202A${text}\u202C`;
}

export function getTextDirection(text: string, defaultDirection: 'ltr' | 'rtl' = 'ltr'): 'ltr' | 'rtl' {
  if (!text.trim()) return defaultDirection;
  return detectTextDirection(text);
}
