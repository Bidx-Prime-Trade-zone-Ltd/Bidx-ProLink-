function json(body, status = 200, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cacheControl }
  });
}

async function geography(request, ctx) {
  const url = new URL(request.url);
  const iso3 = (url.searchParams.get("country") || "").toUpperCase();
  const level = Number(url.searchParams.get("level"));
  if (!/^[A-Z]{3}$/.test(iso3) || !Number.isInteger(level) || level < 1 || level > 5) {
    return json({ error: "A valid ISO-3 country code and administrative level (1–5) are required." }, 400);
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://prolink-geo-cache.invalid/${iso3}/ADM${level}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const metadataResponse = await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM${level}/`, {
      headers: { accept: "application/json" }
    });
    if (metadataResponse.status === 404) return json({ country: iso3, level, areas: [], available: false }, 200, "public, max-age=21600");
    if (!metadataResponse.ok) return json({ error: "Geographical data provider is temporarily unavailable." }, 502);
    const metadata = await metadataResponse.json();
    const dataUrl = metadata.simplifiedGeometryGeoJSON || metadata.gjDownloadURL;
    if (!dataUrl) return json({ country: iso3, level, areas: [], available: false }, 200, "public, max-age=21600");

    const boundaryResponse = await fetch(dataUrl, { headers: { accept: "application/geo+json, application/json" } });
    if (!boundaryResponse.ok) return json({ error: "Administrative boundary data could not be loaded." }, 502);
    const geo = await boundaryResponse.json();
    const areas = (geo.features || []).map(feature => {
      const p = feature.properties || {};
      const name = p.shapeName || p.NAME_1 || p.NAME_2 || p.name || p.NAME || p.admin || p.NAME_EN;
      const id = p.shapeID || p.shapeISO || p.GID_1 || p.GID_2 || p.id || name;
      return name ? { id: String(id || name), name: String(name) } : null;
    }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

    const response = json({
      country: iso3,
      countryName: metadata.boundaryName || iso3,
      level,
      levelName: metadata.boundaryCanonical || `Administrative level ${level}`,
      source: "geoBoundaries",
      license: metadata.boundaryLicense || "See source metadata",
      attribution: "Administrative boundary data from geoBoundaries. Check each layer's licence before redistribution.",
      available: areas.length > 0,
      areas
    }, 200, "public, max-age=21600");
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    console.error("[prolink-geography] lookup_failed", { country: iso3, level, name: error?.name || "Error" });
    return json({ error: "Geographical data is temporarily unavailable. Enter the area manually." }, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/geography" && request.method === "GET") return geography(request, ctx);

    // National identity lookups are retired. Prolink now uses manual document review.
    if (url.pathname === "/api/identro-nin") {
      return json({ success: false, retired: true, message: "National identity lookup is not used by Prolink." }, 410);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  }
};
