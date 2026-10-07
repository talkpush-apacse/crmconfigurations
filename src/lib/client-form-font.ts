import { Figtree } from "next/font/google";

/**
 * Type for the client form face (the checklist editor and the client view).
 * Loaded here, not in the root layout, so staff pages never download it.
 * Figtree is a variable font, so one file covers every weight.
 */
export const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});
