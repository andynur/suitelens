const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#1f1f21';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Picks white or near-black text for a user-chosen `#rrggbb` background, whichever contrasts more. */
export function readableTextOn(background: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(background)) return LIGHT_TEXT;
  const bg = luminance(background);
  return contrast(bg, luminance(LIGHT_TEXT)) >= contrast(bg, luminance(DARK_TEXT))
    ? LIGHT_TEXT
    : DARK_TEXT;
}
