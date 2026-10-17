// Builds Coin Ledger three ways from src/:
//   www/index.html         the Android app (fonts bundled, works offline)
//   site/index.html        the same app for a browser on your computer (GitHub Pages)
//   dist/coin-ledger.html  the claude.ai artifact version
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(root, "src", f), "utf8");
const strip = (js) => js.replace(/\nif \(typeof module !== "undefined"\) module\.exports = \w+;\n?/, "\n");

// Firebase settings come from the FIREBASE_CONFIG repository secret: the config object from the
// Firebase console, pasted either as JSON or as the `const firebaseConfig = { ... };` snippet.
function firebaseConfig() {
  const raw = (process.env.FIREBASE_CONFIG || "").trim();
  if (!raw) return null;
  try { const j = JSON.parse(raw); if (j && j.apiKey) return j; } catch (e) { /* try the snippet form */ }
  const out = {};
  for (const m of raw.matchAll(/["']?(\w+)["']?\s*:\s*["']([^"']*)["']/g)) out[m[1]] = m[2];
  return out.apiKey ? out : null;
}
const firebase = firebaseConfig();
const version = process.env.APP_VERSION || "dev";
if (!firebase) console.warn("FIREBASE_CONFIG isn't set, so the app will say it isn't connected to Firebase yet.");

const store = buildSync({
  entryPoints: [join(root, "src", "store.js")], bundle: true, write: false, format: "iife",
  minify: true, target: ["es2020"], legalComments: "none", logLevel: "warning"
}).outputFiles[0].text;
// The app also needs Capacitor's small runtime to talk to the phone (label reading, sharing files, back button).
const capacitorRuntime = readFileSync(join(root, "node_modules", "@capacitor", "core", "dist", "capacitor.js"), "utf8")
  .replace(/\n\/\/# sourceMappingURL=.*$/m, "");

const css = src("style.css"), appCss = src("app.css");
const core = src("core.js"), labelparse = strip(src("labelparse.js")), reader = src("reader.js");
const script = (code) => `<script>\n${code.replace(/<\/script/gi, "<\\/script")}\n</script>`;

const fonts = [
  ["bricolage-grotesque", "bricolage-grotesque-latin-600-normal.woff2", "Bricolage Grotesque", 600],
  ["bricolage-grotesque", "bricolage-grotesque-latin-700-normal.woff2", "Bricolage Grotesque", 700],
  ["instrument-sans", "instrument-sans-latin-400-normal.woff2", "Instrument Sans", 400],
  ["instrument-sans", "instrument-sans-latin-500-normal.woff2", "Instrument Sans", 500],
  ["instrument-sans", "instrument-sans-latin-600-normal.woff2", "Instrument Sans", 600],
  ["jetbrains-mono", "jetbrains-mono-latin-400-normal.woff2", "JetBrains Mono", 400],
  ["jetbrains-mono", "jetbrains-mono-latin-500-normal.woff2", "JetBrains Mono", 500]
];
const faces = fonts.map(([, file, family, weight]) =>
  `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(fonts/${file}) format("woff2")}`).join("\n");
function copyFonts(dir) {
  mkdirSync(join(root, dir, "fonts"), { recursive: true });
  for (const [pkg, file] of fonts) copyFileSync(join(root, "node_modules", "@fontsource", pkg, "files", file), join(root, dir, "fonts", file));
}
const reset = ":root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}" +
  "body{margin:0}img{max-width:100%}[hidden]{display:none!important}";

function appPage(native) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1D6B63">
<title>Coin Ledger</title>
<style>${reset}</style>
<style>
${faces}
</style>
<style>
${css}
${appCss}</style>
</head><body>
${src("body-app.html")}
${script(`window.LEDGER_CONFIG = ${JSON.stringify({ firebase, version })};`)}
${native ? script(capacitorRuntime) : ""}
${script(store)}
${script(labelparse)}
${script(reader)}
${script(src("platform-app.js"))}
${script(core)}
</body></html>
`;
}

// --- the Android app
copyFonts("www");
const appHtml = appPage(true);
writeFileSync(join(root, "www", "index.html"), appHtml);

// --- the same app in a browser
copyFonts("site");
const siteHtml = appPage(false);
writeFileSync(join(root, "site", "index.html"), siteHtml);
writeFileSync(join(root, "site", ".nojekyll"), "");

// --- the claude.ai artifact: page content only; the artifact host adds the document skeleton
const artifactHtml = `<title>Coin Ledger</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${css}</style>

${src("body-artifact.html")}
${script(src("platform-artifact.js"))}
${script(core)}
`;
mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist", "coin-ledger.html"), artifactHtml);

console.log(`built www/index.html (${appHtml.length} bytes), site/index.html (${siteHtml.length} bytes) and dist/coin-ledger.html (${artifactHtml.length} bytes), version ${version}`);
