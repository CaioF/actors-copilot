# Actors Copilot feature map

Behavior-level index for deciding what to exercise. Source inventory: `8ab8fe2afde8591b88c983ecbac0432e8933d249`, 2026-11-17. Unless explicitly marked observed below, entries are **source-derived**, not evidence of a successful end-to-end run. Source and tests can change; inspect current files.

- [Access and billing](access-billing.md): login, recovery, tiers, checkout, settings and admin.
- [DNA and coach](dna-coach.md): Personal DNA, vault, chat and acting coach.
- [Auditions and reader](auditions-reader.md): brief, sides, enrichment, saved auditions and rehearsal.
- [Profile and navigation](profile-navigation.md): dashboard, sidebar, actor profile, public profile and settings.
- [Administration and affiliates](admin.md): separate operator access, members and payout records.
- [Cross-feature journeys](journeys.md): persistence and integration checks across surfaces.
- [Routes and data](routes-data.md): page inventory, API families and boundaries.

## Current evidence and gaps

The following is a point-in-time guide to recorded production checks on 2026-11-17, not a guarantee about the current deployment. Account-based checks used real platform sessions seeded through Firebase and the app callback in isolated headless Chrome; they do not establish that normal login works. See each linked map for exact browser, test data, outcomes and limitations.

| Area | Observed in production | Important gaps |
| --- | --- | --- |
| [Access and billing](access-billing.md) | Signed-out login controls; logout and dashboard redirect; selected Free/Economy route gates; plan/currency display controls. | Normal login showed an intermittent failure; Business entitlement, checkout completion, Stripe portal and webhook transitions remain unverified in browser. |
| [Auditions and Reader](auditions-reader.md) | Brief and sides wizard validation, synthetic generation/save/reload, brief→sides enrichment, linked Reader, tracker search and cancellation, selected rehearsal controls. | Reverse enrichment, actual deletion, PDF browser extraction, microphone, audio playback and full rehearsal progression remain unverified. |
| [DNA and coach](dna-coach.md) | Synthetic chat exchange persisted after reload; chat help and baseline cancellation; empty and populated vault navigation and filtering. | Baseline short-text error is misleading; successful baseline upload, extraction quality, multi-section exclusion and Business coaching remain unverified. |
| [Profile and navigation](profile-navigation.md) | Desktop header and theme, one mobile menu route, settings unsaved draft, missing public HTML/Markdown. | Business editor, actual profile save, publication, known unpublished slug and full mobile accessibility remain unverified. |
| [Administration](admin.md) | Signed-out admin login form rendered. | Authenticated administrative operations, affiliate and payout flows were not exercised. |

## Evidence recorded during initial mapping

On the preceding feature-branch checkout `b68a6ce08b998006d58a0da8b8dfd05a9b455573` (no content diff against mapped main), local Next dev on 2026-11-17: `/login` rendered sign-in controls; navigating signed out to `/dashboard` returned to `/login`; selecting Create Account displayed the trial sign-up form. No form was submitted. Focused Jest command in [verification](../verification.md) passed 5 suites / 54 tests. At that initial local checkpoint, authenticated, Stripe, AI, media and authenticated admin journeys had not been browser-tested; later production observations are summarized above.

On 2026-11-17, the production origin `https://app.theactorscopilot.com` rendered sign-in and registration modes at `/login`, and an independent admin login form at `/admin-dashboard`. The deployed commit was not established. A real-session-seeded Economy browser inspection and one synthetic brief generation/save/reload are documented in the relevant feature maps. No account was created and admin login was not submitted. Session seeding does not prove normal sign-in.

## Entry convention

Each feature file identifies entry points, user-visible checks, source/test pointers and external dependencies or caveats. On each run choose the variants affected by the change, including error and persistence paths; log what was actually exercised. Consult [verification](../verification.md) for isolation and evidence rules.
