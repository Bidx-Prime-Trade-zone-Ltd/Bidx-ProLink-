export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });

  const log = (stage, details = {}) => {
    // Never include request bodies, NINs, names, API keys, or provider payloads.
    console.info("[identro-nin]", JSON.stringify({ stage, ...details }));
  };

  log("request_received", { method: request.method });

  try {
    if (!env.BIDX_IDENTRO_PROLIINK_KEY) {
      log("secret_missing");
      return json({
        success: false,
        manual: true,
        message: "We could not complete your verification right now. Please continue with manual submission."
      });
    }

    log("secret_present");
    const body = await request.json();
    const nin = String(body.nin || "").replace(/\D/g, "");
    const legalName = String(body.legalName || "").trim();
    const consentReference = String(body.consentReference || "").trim();

    const validation = {
      ninValid: /^\d{11}$/.test(nin),
      legalNamePresent: Boolean(legalName),
      consentReferencePresent: Boolean(consentReference),
      consentCaptured: body.consentCaptured === true
    };

    if (!validation.ninValid || !validation.legalNamePresent ||
        !validation.consentReferencePresent || !validation.consentCaptured) {
      log("request_validation_failed", validation);
      return json({
        success: false,
        manual: true,
        message: "We could not complete your verification right now. Please continue with manual submission."
      });
    }

    log("upstream_fetch_started");
    let upstream;
    try {
      upstream = await fetch("https://api.identro.ng/api/v1/merchant-api/nin/verify", {
        method: "POST",
        headers: {
          "x-api-key": env.BIDX_IDENTRO_PROLIINK_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({ nin, consentCaptured: true, consentReference })
      });
    } catch (error) {
      log("upstream_network_error", {
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
      return json({
        success: false,
        manual: true,
        message: "We could not complete your verification right now. Please continue with manual submission."
      });
    }

    log("upstream_response", { status: upstream.status, ok: upstream.ok });
    if (!upstream.ok) {
      return json({
        success: false,
        manual: true,
        message: "We could not complete your verification right now. Please continue with manual submission."
      });
    }

    let result;
    try {
      result = await upstream.json();
    } catch (error) {
      log("upstream_json_parse_error", {
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
      return json({
        success: false,
        manual: true,
        message: "We could not complete your verification right now. Please continue with manual submission."
      });
    }

    const d = result?.data || {};
    if (result?.success !== true || !d.firstName || !d.lastName) {
      log("upstream_payload_unusable", {
        successFlag: result?.success === true,
        firstNamePresent: Boolean(d.firstName),
        lastNamePresent: Boolean(d.lastName)
      });
      return json({
        success: false,
        manual: true,
        message: "We could not complete your verification right now. Please continue with manual submission."
      });
    }

    const expectedName = legalName.toLocaleLowerCase("en").normalize("NFKD").replace(/[^a-z]/g, "");
    const returnedName = [d.firstName, d.middleName, d.lastName]
      .filter(Boolean)
      .join("")
      .toLocaleLowerCase("en")
      .normalize("NFKD")
      .replace(/[^a-z]/g, "");
    const nameMatches = expectedName === returnedName;

    if (!nameMatches) {
      log("legal_name_mismatch");
      return json({
        success: false,
        manual: true,
        message: "We could not complete your verification right now. Please continue with manual submission."
      });
    }

    const verifiedName = [d.firstName, d.middleName, d.lastName]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    log("verification_succeeded");
    return json({ success: true, legalName: verifiedName });
  } catch (error) {
    log("handler_exception", {
      errorName: error instanceof Error ? error.name : "UnknownError"
    });
    return json({
      success: false,
      manual: true,
      message: "We could not complete your verification right now. Please continue with manual submission."
    });
  }
}
