// Geist — the app's own typeface (SIL OFL 1.1), so the motion scenes and the
// screen recordings read as one product.
import { loadFont } from "@remotion/google-fonts/Geist";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
