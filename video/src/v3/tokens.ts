// v3 look: the team's pitch deck (HydroTwin_Pitch.pptx) — its palette, Georgia headings and the
// blurred retention-pond landscape — with motion in a product-film style.
export { W, H, FPS, sec } from "../tokens";

export const V = {
  forest: "#27391E",
  deep: "#15270D",
  cream: "#F5F1DD",
  sage: "#D8DDCB",
  sageLight: "#E5E8CF",
  gold: "#D7C478",
  // Status colours only ever mean status (the deck's muted set).
  green: "#397752",
  amber: "#A5751D",
  red: "#A44B3C",
  // The same three statuses, lifted to read on the dark landscape.
  greenLit: "#7DB38A",
  amberLit: "#E0AE4E",
  redLit: "#D9705F",
  // Frosted panels over the landscape.
  glass: "rgba(21, 39, 13, 0.58)",
  glassLine: "rgba(245, 241, 221, 0.16)",
};

export const SERIF = "Georgia, 'Times New Roman', serif";

// Type scale (1080p): display · title · heading · lead · label · small.
export const TY = { display: 120, title: 72, heading: 48, lead: 34, label: 26, small: 22 };

export const MARGIN = 120;
