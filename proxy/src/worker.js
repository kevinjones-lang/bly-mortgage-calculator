// Bly Team Mortgage Calculator — AI address-estimator proxy (Cloudflare Worker)
//
// Holds the Claude API key server-side and answers a single, narrow question:
// given a Texas property address, estimate the annual property-tax rate and a
// typical annual homeowners-insurance premium. The browser never sees the key.
//
// Security posture:
//  - The prompt is built HERE, from a single `address` field. Callers cannot
//    submit arbitrary prompts, so this can't be used as a free, open Claude API.
//  - CORS is locked to the origins in ALLOWED_ORIGINS (env var, comma-separated).
//  - Output is constrained with structured outputs, so the response is always
//    valid { taxRate, insurance, area } JSON.
//
// Setup: see ../README.md. Required secret: ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8"; // To cut cost on this simple lookup you can switch to "claude-haiku-4-5".

// Structured-outputs schema — guarantees a clean, parseable response.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    taxRate: { type: "number", description: "Annual property tax as a percent of market value (e.g. 2.15 for 2.15%)." },
    insurance: { type: "number", description: "Typical annual homeowners insurance premium in US dollars." },
    area: { type: "string", description: "County and state, e.g. 'Fort Bend County, TX'." },
  },
  required: ["taxRate", "insurance", "area"],
};

function corsHeaders(origin, allowed) {
  const ok = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }
    // Reject browsers from origins we don't recognize.
    if (allowed.length && !allowed.includes(origin)) {
      return json({ error: "forbidden_origin" }, 403, cors);
    }

    let address;
    try {
      const body = await request.json();
      address = String(body?.address || "").trim();
    } catch {
      return json({ error: "bad_json" }, 400, cors);
    }
    if (!address || address.length > 300) {
      return json({ error: "invalid_address" }, 400, cors);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "server_not_configured" }, 500, cors);
    }

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 512,
        // Simple, well-scoped extraction — low effort keeps it fast and cheap.
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: SCHEMA },
        },
        system:
          "You are a Texas real-estate cost estimator. Given a property address, estimate the annual " +
          "property tax RATE as a percent of market value (typical for that county/city, including ISD + " +
          "county + MUD where common) and a typical annual homeowners insurance premium in US dollars. " +
          "Account for Gulf Coast windstorm exposure near Galveston, Kemah, and Seabrook. Return your best " +
          "estimate even when the address is partial; never refuse.",
        messages: [{ role: "user", content: "Address: " + address }],
      });

      // With structured outputs the model emits a single JSON text block.
      const text = message.content.find((b) => b.type === "text")?.text || "{}";
      const data = JSON.parse(text);
      return json(
        {
          taxRate: typeof data.taxRate === "number" ? data.taxRate : null,
          insurance: typeof data.insurance === "number" ? data.insurance : null,
          area: typeof data.area === "string" ? data.area : "",
        },
        200,
        cors
      );
    } catch (e) {
      return json({ error: "estimate_failed", detail: String(e?.message || e) }, 502, cors);
    }
  },
};
