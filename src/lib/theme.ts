/*
 * Pink & coastal: seashell-pink paper, flamingo pink as the hero color,
 * sea-glass teal as the second voice, deep-sea navy for text, and
 * soft sorbet accents (peach, lilac, seafoam, sunshine).
 *
 * One source of truth: Tailwind reads this through tailwind.config.ts
 * (so `bg-primary`, `text-sea` and friends work), and components import
 * it when they need a raw color, e.g. for map pins or confetti.
 */
const navy = "oklch(0.31 0.06 250)";
const shell = "oklch(0.997 0.004 30)";

export const palette = {
  background: "oklch(0.982 0.013 25)", // seashell
  foreground: navy, // deep-sea navy
  card: shell,
  "card-foreground": navy,
  popover: shell,
  "popover-foreground": navy,
  primary: "oklch(0.63 0.19 358)", // flamingo pink
  "primary-strong": "oklch(0.5 0.18 358)", // raspberry (text-safe)
  "primary-foreground": "oklch(0.995 0.004 30)",
  "primary-soft": "oklch(0.935 0.045 355)", // blush
  secondary: "oklch(0.955 0.022 70)", // warm sand
  "secondary-foreground": navy,
  sea: "oklch(0.6 0.11 215)", // sea glass
  "sea-strong": "oklch(0.47 0.1 225)",
  "sea-soft": "oklch(0.93 0.045 205)", // shallow water
  peach: "oklch(0.93 0.05 45)",
  lilac: "oklch(0.925 0.045 310)",
  mint: "oklch(0.935 0.055 175)", // seafoam
  butter: "oklch(0.955 0.075 95)", // sunshine
  muted: "oklch(0.955 0.02 60)",
  "muted-foreground": "oklch(0.5 0.045 250)",
  accent: "oklch(0.935 0.045 355)",
  "accent-foreground": navy,
  destructive: "oklch(0.56 0.19 25)",
  "destructive-foreground": "oklch(0.99 0 0)",
  border: "oklch(0.9 0.03 10)",
  input: "oklch(0.89 0.03 10)",
  ring: "oklch(0.63 0.19 358)",
  overlay: "oklch(0.22 0.05 250)",
  "on-photo": "oklch(0.995 0.004 30)",
  "chart-1": "oklch(0.63 0.19 358)",
  "chart-2": "oklch(0.6 0.11 215)",
  "chart-3": "oklch(0.42 0.07 250)",
  "chart-4": "oklch(0.82 0.12 85)",
  "chart-5": "oklch(0.7 0.1 310)",
  "chart-6": "oklch(0.75 0.09 170)",
} as const;

export type PaletteColor = keyof typeof palette;

export const fonts = {
  sans: '"Nunito", ui-sans-serif, system-ui, sans-serif',
  display: '"Fraunces", Georgia, serif',
  script: '"Caveat", cursive',
};

export const shadows = {
  soft: "0 8px 22px -12px oklch(0.45 0.12 355 / 0.3)",
  lift: "0 20px 44px -18px oklch(0.31 0.06 250 / 0.38)",
};

/** Rounded corners, all based on a soft 1.1rem. */
export const radii = {
  sm: "calc(1.1rem - 4px)",
  md: "calc(1.1rem - 2px)",
  lg: "1.1rem",
  xl: "calc(1.1rem + 4px)",
  "2xl": "calc(1.1rem + 8px)",
  "3xl": "calc(1.1rem + 14px)",
};
