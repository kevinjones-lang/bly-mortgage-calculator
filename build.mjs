// Build a clean, self-contained static site from the Claude Design prototype.
// - Pre-compiles JSX with esbuild (no in-browser Babel)
// - Bundles React/ReactDOM locally (no CDN dependency)
// - Emits site/index.html + site/app.js + site/vendor.js + site/assets/
import esbuild from "esbuild";
import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(root, "project");
const APP = path.join(PROJ, "app");
const OUT = path.join(root, "site");
const NM = path.join(root, "node_modules");

// Same order the prototype loads them in. mortgage.js is plain JS; the rest are JSX.
const JS_FILES = ["mortgage.js"];
const JSX_FILES = [
  "tweaks-panel.jsx",
  "charts.jsx",
  "shared.jsx",
  "tools.jsx",
  "gooddeal-results.jsx",
  "gooddeal.jsx",
  "app.jsx",
];

// Keep whitespace/syntax minification but NOT identifier renaming — the files
// share global scope (classic scripts), so top-level names must be preserved.
const minify = { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false };

async function compile(file, loader) {
  const code = await readFile(path.join(APP, file), "utf8");
  const res = await esbuild.transform(code, {
    loader,
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    target: "es2018",
    ...minify,
  });
  return `/* ${file} */\n${res.code}`;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, "assets"), { recursive: true });

  // 1) Vendor bundle: React + ReactDOM production UMD builds (define globals).
  const react = await readFile(path.join(NM, "react/umd/react.production.min.js"), "utf8");
  const reactDom = await readFile(path.join(NM, "react-dom/umd/react-dom.production.min.js"), "utf8");
  await writeFile(path.join(OUT, "vendor.js"), react + "\n" + reactDom);

  // 2) App bundle: engine + compiled components, in load order.
  const parts = [];
  for (const f of JS_FILES) parts.push(await compile(f, "js"));
  for (const f of JSX_FILES) parts.push(await compile(f, "jsx"));
  await writeFile(path.join(OUT, "app.js"), parts.join("\n\n"));

  // 3) index.html: reuse the prototype's head/CSS + body shell, drop the
  //    CDN/Babel script tags, point at our local vendor.js + app.js.
  let html = await readFile(path.join(PROJ, "Calculator App.html"), "utf8");
  const head = html.slice(0, html.indexOf("</head>"));
  // Strip design-tool artifacts from the head.
  const cleanHead = head
    .replace(/<meta name="ext-resource-dependency"[^>]*>\s*/g, "")
    .replace(/<template id="__bundler_thumbnail">[\s\S]*?<\/template>\s*/g, "");
  html =
    cleanHead +
    `</head>
<body data-theme="data" style="font-size: 24px">
  <div id="root"></div>
  <script src="vendor.js"></script>
  <script src="app.js"></script>
</body>
</html>
`;
  await writeFile(path.join(OUT, "index.html"), html);

  // 4) Assets the app references at runtime.
  await copyFile(
    path.join(PROJ, "assets/bly-logo-white.png"),
    path.join(OUT, "assets/bly-logo-white.png")
  );

  console.log("Built site/ ->", JSX_FILES.length + JS_FILES.length, "modules compiled");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
