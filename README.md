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

The private verification-document bucket and row-level security policies are provisioned by the migration `prolink_verification_document_storage`. The Admin review foundation is provisioned by `prolink_admin_foundation`. Admin decisions update the applicant's manual verification and professional onboarding statuses through `prolink_sync_manual_review_status`.

Do not place service-role keys, payment secrets or other private credentials in frontend code or source control.

## Product rules retained

- Existing account authentication and persistent sessions are preserved.
- The customer directory is populated only from real Supabase professional profiles whose personal details, work ID, competency certificate and professional profile have all been approved by Admin.
- Directory search matches professional name, trade, skills and country-aware location text; profiles display only approved professional information and supplied contact channels.
- Professionals can manage their Work Portfolio from the app menu: upload JPEG/PNG/WebP photos (8 MB maximum), add captions and remove their own photos. Portfolio images appear on the public professional profile after manual approval.
- Portfolio image objects are kept in a private Storage bucket and served to signed-in customers using short-lived signed URLs.
- Existing customer contact and service-request flows remain in place.
- Prolink remains separate from the BIDX Marketplace database.

Company: BIDX PRIME TRADE ZONE LTD
Support: Support@bidxpro.online
Information: Info@bidxpro.online

## Latest deployment trigger — 18 November 2026

The production branch includes the changes merged through pull requests #25 and #26: global professional registration and manual verification, the Supabase-backed approved-professional directory, and the private work-portfolio image gallery. This entry records the release contents; deployment status must be confirmed in the hosting dashboard.


## ProLink unified AI and Admin support

The dedicated floating **Chat Admin** surface is separate from customer-to-professional Messages. It uses the private `prolink_support_conversations` and `prolink_support_messages` tables and stores support attachments in the existing Worker R2 binding.

Before enabling the feature in production:

1. Apply `supabase/migrations/202611200001_prolink_unified_support_chat.sql` and `supabase/migrations/202611200002_prolink_support_read_receipts.sql` to the ProLink Supabase project.
2. Ensure the ProLink Cloudflare Worker has a Workers AI binding named `AI` (the Wrangler config declares this binding). The support assistant uses Workers AI text generation and image understanding.
3. Deploy the updated ProLink Worker and frontend assets.
4. Sign in to the app and test AI greeting, account/membership lookup, image/PDF upload, Admin handoff, Admin attendance, human reply, and resolution.

Human Admin handoff stays in the same support conversation. AI continues while an Admin request is pending and pauses only when Admin marks the conversation as attending. Customer-to-professional messages are not read by or exposed in this support inbox.
