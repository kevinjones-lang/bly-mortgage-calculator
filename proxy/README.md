# AI Address-Estimator Proxy (Cloudflare Worker)

The calculator's "estimate from address" feature asks Claude for a property's
typical tax rate and insurance cost. Claude needs an API key, and a public web
page **can't safely hold one** — so this small Cloudflare Worker holds the key
server-side. The page sends only the address; the Worker calls Claude and
returns `{ taxRate, insurance, area }`.

The Worker builds the prompt itself and only accepts an `address`, so it can't
be abused as a free, general-purpose Claude endpoint, and CORS is locked to your
site's origin.

## What you'll need

- A **Cloudflare account** (free) — https://dash.cloudflare.com/sign-up
- An **Anthropic (Claude) API key** — see below
- Node.js installed (you already have it)

## Step 1 — Create a Claude API key

1. Go to https://console.anthropic.com and sign in (or sign up).
2. Add a payment method / credits under **Billing** (the estimator is cheap —
   each lookup is a fraction of a cent).
3. Open **API keys** → **Create Key**, name it (e.g. "Bly calculator"), and copy
   the key (starts with `sk-ant-...`). You won't be able to see it again, so
   paste it somewhere safe for the next step.

## Step 2 — Deploy the Worker

From this `proxy/` folder:

```bash
cd proxy
npm install
npx wrangler login          # opens a browser to authorize Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY
#   ↑ paste your sk-ant-... key when prompted (stored encrypted, never in code)
npx wrangler deploy
```

`wrangler deploy` prints your Worker URL, e.g.
`https://bly-mortgage-estimator.<your-subdomain>.workers.dev`. Copy it.

## Step 3 — Point the calculator at the Worker

Rebuild the site with the Worker URL baked in, from the repo root:

```bash
BLY_AI_ENDPOINT="https://bly-mortgage-estimator.<your-subdomain>.workers.dev" npm run build
```

Then publish the updated `site/` (e.g. push it to the `gh-pages` branch — see the
root README). The "Estimate" button on the Buyers tab will now auto-fill tax and
insurance from an address. Without this step, that button gracefully tells the
user to enter values manually — everything else works regardless.

## Notes

- **Allowed origins:** `wrangler.toml` lists which sites may call the Worker.
  Add your live website's origin (e.g. `https://thebly.team`) to
  `ALLOWED_ORIGINS` there and redeploy once the calculator is embedded.
- **Model / cost:** Defaults to `claude-opus-4-8`. For a simple lookup you can
  switch `MODEL` in `src/worker.js` to `claude-haiku-4-5` to cut cost further.
- **Abuse protection:** the origin lock stops other websites' browsers from
  using your key. For stronger protection against direct (non-browser) calls,
  add a Cloudflare Rate Limiting rule or a Turnstile check in front of the
  Worker.
