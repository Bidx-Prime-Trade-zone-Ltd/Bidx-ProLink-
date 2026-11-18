# Pedes Prolink

Global professional and skilled-worker discovery platform, launching registration in selected English-language markets first and expanding to additional languages and countries in phases.

## Development

- Vite + React
- Supabase Auth and private Storage
- Cloudflare Worker and static assets
- `npm install`
- `npm run dev`
- `npm run build`

## Global registration and locations

- New accounts select a supported initial launch country during registration.
- Country is stored with the account profile; there is no country-switching or country-browsing control.
- Administrative area suggestions are loaded by country from geoBoundaries (ADM1–ADM4 where data is available).
- District, city, local area, postal code and street address remain editable so users can enter local names not covered by boundary datasets.
- geoBoundaries attribution and each layer's licence must be respected. The app uses the dataset for names/suggestions, not identity checks.

## Manual professional verification

- National identity number lookup and automated government identity verification are not used.
- Applicants submit personal/contact details and a current work ID, staff ID or professional ID card.
- Applicants must submit at least one relevant skills document, such as a competency certificate, trade-test certificate, apprenticeship certificate or professional qualification.
- Documents are stored in the private `prolink-verification-documents` bucket and reviewed manually by the authorised Prolink Admin.
- The bucket accepts PDF, JPEG, PNG and WebP files up to 10 MB. Admin document previews use short-lived signed URLs.
- No national ID card is mandatory.

## Cloudflare Worker

The `bidx-prolink` Worker serves the Vite build and exposes `GET /api/geography?country=ISO3&level=1..5`. The endpoint caches geoBoundaries administrative-area suggestions. National identity lookup routes return HTTP 410 and are retired.

Build and deploy:

```sh
npm run build
npx wrangler deploy
```

## Supabase

Project: `ljttcncfcetgdqfmtdhm` (Bidx ProLink).

The private verification-document bucket and row-level security policies are provisioned by the migration `prolink_verification_document_storage`. The Admin review foundation is provisioned by `prolink_admin_foundation`.

Do not place service-role keys, payment secrets or other private credentials in frontend code or source control.

## Product rules retained

- Existing account authentication and persistent sessions are preserved.
- Professional profiles retain skills, experience, and portfolio/work-gallery areas.
- Existing customer contact and service-request flows remain in place.
- Prolink remains separate from the BIDX Marketplace database.

Company: BIDX PRIME TRADE ZONE LTD
Support: Support@bidxpro.online
Information: Info@bidxpro.online
