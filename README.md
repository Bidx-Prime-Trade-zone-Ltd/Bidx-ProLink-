# Bidx ProLink

Mobile-first professional services marketplace for Nigeria, built for electricians, plumbers, bricklayers, carpenters, painters, technicians and other skilled professionals.

## Development

- Vite + React
- `npm install`
- `npm run dev`
- `npm run build`

## Cloudflare Workers deployment

The production app is served by the `bidx-prolink` Worker. Build the Vite frontend first, then deploy the Worker with Wrangler:

```sh
npm run build
npx wrangler deploy
```

The Worker routes `POST /api/identro-nin` to the server-side Identro handler before static asset fallback. Other API paths return JSON 404 responses; non-API paths continue through the Vite build assets and SPA fallback.

### Required production secret

Set this in Cloudflare Dashboard → Workers & Pages → `bidx-prolink` → Settings → Variables and Secrets → Production:

- Name: `BIDX_IDENTRO_PROLIINK_KEY`
- Type: Secret
- Value: the live Identro merchant API key

Do not put the secret value in `wrangler.jsonc`, source control, frontend variables, or browser code. The Worker reads it only from `env.BIDX_IDENTRO_PROLIINK_KEY`.

The secret must be added separately in Cloudflare; this PR does not change production secrets or deploy the Worker.

## Product rules captured in the interface

- Nigeria-focused professional directory with location-aware discovery and manual city search.
- Two-column professional cards with portrait, trade, rating and location.
- Professional profiles with qualifications, skills, certificates, NIN verification status, CAC/business documents where applicable, and a work gallery.
- Email or Google sign-in entry points.
- Customer-to-professional contact and service request flow; agreement/invoice is for recording terms, while payment is handled outside the app.
- Internal administration is restricted to the designated administrator account and a separate passcode; never expose admin credentials in frontend code.

Company: BIDX PRIME TRADE ZONE LTD
Support: Support@bidxpro.online
Information: Info@bidxpro.online
