# Dashboard, profile and navigation

## Entry and behavior

- `/dashboard` links to Personal DNA, Audition Breakdown and Scene Study; an unseen intro video can open a modal. Check first visit, dismiss, reload, and seen state in an isolated account. Sidebar (`components/app-sidebar.tsx`) links to dashboard, reader, chat, coach, auditions, profile, vault and settings. On mobile open/close menu, navigate and verify active item; desktop and mobile layouts differ.
- `/profile` edits professional information, photos, credits, training, links, skills and CV; save, reload, and inspect preview with synthetic data. Exercise validation and failed uploads. Publishing can make data public: use a disposable profile in an isolated environment and confirm `/actors/[slug]` behavior for published versus missing/unpublished profiles. Do not publish real personal information as a test. IMDb autofill invokes an external scraping/AI path and needs separate test configuration.
- `/settings` includes display name, plan/portal and account deletion. Test benign edits only with disposable data; do not delete an account in a smoke run. `/actors/[slug]/index.md` is a separate public representation to check when relevant.

## Boundaries and checks

Source: `app/(interior)/dashboard/page.tsx`, `app/(interior)/profile/page.tsx`, `components/profile/`, `app/actors/[slug]/`, `app/(interior)/settings/page.tsx`, `app/api/profile/`. Tests include `app/(interior)/dashboard/page.test.tsx`, `components/profile/profile-live-preview.test.tsx`, `lib/get-public-profile.test.ts`, `app/api/profile/autofill/route.test.ts`, `app/api/profile/display-name/route.test.ts` and `app/api/account/delete/route.test.ts`. A component preview test is not proof that a published profile is reachable.
