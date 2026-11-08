export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
  try {
    if (!env.BIDX_IDENTRO_PROLIINK_KEY) return json({ success: false, manual: true, message: "We could not complete your verification right now. Please continue with manual submission." }, 200);
    const body = await request.json();
    const nin = String(body.nin || "").replace(/\D/g, "");
    const legalName = String(body.legalName || "").trim();
    const dateOfBirth = String(body.dateOfBirth || "").trim();
    const consentReference = String(body.consentReference || "").trim();
    if (!/^\d{11}$/.test(nin) || !legalName || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !consentReference || body.consentCaptured !== true) {
      return json({ success: false, manual: true, message: "We could not complete your verification right now. Please continue with manual submission." }, 200);
    }
    const upstream = await fetch("https://api.identro.ng/api/v1/merchant-api/nin/verify", {
      method: "POST",
      headers: { "x-api-key": env.BIDX_IDENTRO_PROLIINK_KEY, "content-type": "application/json" },
      body: JSON.stringify({ nin, consentCaptured: true, consentReference })
    });
    if (!upstream.ok) return json({ success: false, manual: true, message: "We could not complete your verification right now. Please continue with manual submission." }, 200);
    const result = await upstream.json();
    const d = result?.data || {};
    if (result?.success !== true || !d.firstName || !d.lastName || !d.dateOfBirth) {
      return json({ success: false, manual: true, message: "We could not complete your verification right now. Please continue with manual submission." }, 200);
    }
    const expectedName = legalName.toLocaleLowerCase("en").normalize("NFKD").replace(/[^a-z]/g, "");
    const returnedName = [d.firstName, d.middleName, d.lastName].filter(Boolean).join("").toLocaleLowerCase("en").normalize("NFKD").replace(/[^a-z]/g, "");
    const nameMatches = expectedName === returnedName;
    const dobMatches = dateOfBirth === d.dateOfBirth;
    if (!nameMatches || !dobMatches) return json({ success: false, manual: true, message: "We could not complete your verification right now. Please continue with manual submission." }, 200);
    return json({ success: true, verified: true, message: "Your identity details were verified." });
  } catch {
    return json({ success: false, manual: true, message: "We could not complete your verification right now. Please continue with manual submission." }, 200);
  }
}
