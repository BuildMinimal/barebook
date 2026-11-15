import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/**
 * Registers the bundled Inter WOFFs (OFL, see src/assets/fonts/LICENSE)
 * once per process. Path works in dev (cwd = repo root) and in the
 * standalone container (outputFileTracingIncludes copies src/assets/fonts).
 */
export function ensureFontsRegistered(): void {
  if (registered) return;

  const dir = path.join(process.cwd(), "src", "assets", "fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "inter-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(dir, "inter-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(dir, "inter-latin-700-normal.woff"), fontWeight: 700 },
    ],
  });
  // Wrap whole words only; hyphenation has no place on an invoice.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
