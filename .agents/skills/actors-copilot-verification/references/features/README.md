# Actors Copilot feature map

Behavior-level index for deciding what to exercise. Source inventory: `8ab8fe2afde8591b88c983ecbac0432e8933d249`, 2026-11-17. Unless explicitly marked observed below, entries are **source-derived**, not evidence of a successful end-to-end run. Source and tests can change; inspect current files.

- [Access and billing](access-billing.md): login, recovery, tiers, checkout, settings and admin.
- [DNA and coach](dna-coach.md): Personal DNA, vault, chat and acting coach.
- [Auditions and reader](auditions-reader.md): brief, sides, enrichment, saved auditions and rehearsal.
- [Profile and navigation](profile-navigation.md): dashboard, sidebar, actor profile, public profile and settings.
- [Cross-feature journeys](journeys.md): persistence and integration checks across surfaces.

## Evidence recorded during initial mapping

On the preceding feature-branch checkout `b68a6ce08b998006d58a0da8b8dfd05a9b455573` (no content diff against mapped main), local Next dev on 2026-11-17: `/login` rendered sign-in controls; navigating signed out to `/dashboard` returned to `/login`; selecting Create Account displayed the trial sign-up form. No form was submitted. Focused Jest command in [verification](../verification.md) passed 5 suites / 54 tests. These are point-in-time observations, not a full regression or production certification. Authenticated, Stripe, AI, media and admin journeys were not browser-tested because isolated service fixtures were not established.

## Entry convention

Each feature file identifies entry points, user-visible checks, source/test pointers and external dependencies or caveats. On each run choose the variants affected by the change, including error and persistence paths; log what was actually exercised. Consult [verification](../verification.md) for isolation and evidence rules.
