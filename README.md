# The Bly Team — Mortgage & Closing Calculator

A free, branded suite of real-estate calculators for The Bly Team (eXp Realty,
Houston & Gulf Coast): buyer payment/PITI + cash-to-close, seller net proceeds +
refinance, rent-vs-buy breakeven, and investor cash-flow/ROI.

Built in React. The original design came from Claude Design as an HTML/JS
prototype (see [`docs/HANDOFF.md`](docs/HANDOFF.md)); this repo compiles it into a
**clean, self-contained static site** you can drop onto any website — no build
server, no CDN dependency, no in-browser transpiler.

## Live build

The ready-to-ship site is in [`site/`](site/):

```
site/
  index.html          # the page
  vendor.js           # React + ReactDOM (bundled locally)
  app.js              # calculator engine + UI (JSX precompiled)
  assets/             # logo
```

Open `site/index.html` through any web server to run it. (It must be *served*
over http, not opened as a `file://` path.)

## Build from source

Source lives in [`project/app/`](project/app/) (`mortgage.js` is the calc engine;
the `.jsx` files are the UI). To rebuild `site/`:

```bash
npm install
npm run build
```

The build (`build.mjs`) precompiles the JSX with esbuild, bundles React locally,
and writes the static site to `site/`.

## Adding it to your website

Pick whichever fits your site:

1. **Drop-in folder** — copy `site/` into your site (e.g. `/tools/calculator/`)
   and link to it. Everything is relative, so it just works.
2. **Embed via iframe** — host `site/` somewhere and embed it on a page:
   ```html
   <iframe src="https://YOUR-DOMAIN/tools/calculator/"
           style="width:100%;height:100vh;border:0" title="Mortgage Calculator">
   </iframe>
   ```
3. **GitHub Pages** — enable Pages on this repo (serving `site/`) for a free
   hosted URL to link or iframe.

## Notes

- **Fonts** load from Google Fonts (Oswald, Playfair Display, Plus Jakarta Sans)
  and gracefully fall back to system fonts offline.
- **AI address estimator** (auto-fill tax rate + insurance from an address) needs
  a Claude API backend that isn't wired up here, so it degrades to manual entry.
  This can be connected later via a small serverless proxy.
