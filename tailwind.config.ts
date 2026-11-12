import { fonts, palette, radii, shadows } from "./src/lib/theme";

/** The app's theme lives in src/lib/theme.ts; this hands it to Tailwind. */
export default {
  theme: {
    extend: {
      colors: palette,
      fontFamily: fonts,
      borderRadius: radii,
      boxShadow: shadows,
    },
  },
};
