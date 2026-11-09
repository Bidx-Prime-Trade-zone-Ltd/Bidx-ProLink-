import { onRequestPost as verifyIdentroNin } from "../functions/api/identro-nin.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Safe route check: confirms the deployed Worker is receiving this path
    // without sending any NIN data or contacting Identro.
    if (url.pathname === "/api/identro-nin" && request.method === "GET") {
      console.info("[worker-router] identro_nin_health_check");
      return new Response(JSON.stringify({ ok: true, route: "identro-nin" }), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" }
      });
    }

    // Route API requests through the Worker before static SPA asset handling.
    if (url.pathname === "/api/identro-nin") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({
          success: false,
          message: "Method not allowed."
        }), {
          status: 405,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            "allow": "POST"
          }
        });
      }

      console.info("[worker-router] identro_nin_route_matched");
      return verifyIdentroNin({ request, env, ctx });
    }

    // Do not let unknown API paths fall through to the SPA's index.html.
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
