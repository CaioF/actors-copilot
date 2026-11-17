# Dashboard, profile and navigation

## Entry and behavior

- `/dashboard` links to Personal DNA, Audition Breakdown and Scene Study; an unseen intro video can open a modal. Check first visit, dismiss, reload, and seen state in an isolated account. Sidebar (`components/app-sidebar.tsx`) links to dashboard, reader, chat, coach, auditions, profile, vault and settings. On mobile open/close menu, navigate and verify active item; desktop and mobile layouts differ.
- `/profile` edits professional information, photos, credits, training, links, skills and CV; save, reload, and inspect preview with synthetic data. Exercise validation and failed uploads. Publishing can make data public: use a disposable profile in an isolated environment and confirm `/actors/[slug]` behavior for published versus missing/unpublished profiles. Do not publish real personal information as a test. IMDb autofill invokes an external scraping/AI path and needs separate test configuration.
- `/settings` includes display name, plan/portal and account deletion. Test benign edits only with disposable data; do not delete an account in a smoke run. `/actors/[slug]/index.md` is a separate public representation to check when relevant.

## Boundaries and checks

Source: `app/(interior)/dashboard/page.tsx`, `app/(interior)/profile/page.tsx`, `components/profile/`, `app/actors/[slug]/`, `app/(interior)/settings/page.tsx`, `app/api/profile/`. Tests include `app/(interior)/dashboard/page.test.tsx`, `components/profile/profile-live-preview.test.tsx`, `lib/get-public-profile.test.ts`, `app/api/profile/autofill/route.test.ts`, `app/api/profile/display-name/route.test.ts` and `app/api/account/delete/route.test.ts`. A component preview test is not proof that a published profile is reachable.

## Practical interaction map

| Surface | How to drive it | Observable outcome and persistence |
| --- | --- | --- |
| Interior frame | Desktop sidebar links and Quick Actions; mobile header `Open menu`, then link or `Close menu`. Header has theme selector, Support, Settings and Profile. | Route changes, one matching sidebar link has `aria-current=page`; mobile navigation closes the menu. Support opens “Need Help?” modal. Use visible controls rather than sidebar CSS classes. |
| Dashboard | Open `/dashboard`; links lead to chat, brief and sides. `Capture a Memory` and `Upload Baseline` open separate interactions. | On an unseen account the intro modal can appear and the seen flag is persisted; dismiss and reload. The 2026-11-17 Economy browser showed My Self Tape Copilot, My Acting Copilot, three preparation cards and memory/baseline actions. |
| Profile editor | Open `/profile` with Business access; edit sections and inspect live preview. Name changes can generate a slug; Save, Publish, Unpublish and copied link appear in the header. | Profile is written to `actorProfiles/{uid}`. Check saving/error feedback and reload. A published slug is queried by `/actors/[slug]` and `/actors/[slug]/index.md`; published content is public. Business editor was not exercised in the recorded Economy run. |
| Settings | Open `/settings`; Profile, Subscription & Billing, Privacy & Data and Danger Zone are visible. Change display name and Save Changes calls `/api/profile/display-name`; email is disabled. Change photo uploads; Change password sends a reset email. | Use a disposable account. A display-name change affects Firebase identity and user-path migration, so reload and check existing DNA/auditions remain reachable. Do not use reset, upload, portal or deletion as read-only smoke checks. |
| Public profile | Open `/actors/<slug>` in a fresh context after publishing a synthetic profile. Check draft/unpublished and missing slug separately. | Public read is gated by published status; verify both HTML and `index.md` when affected. Never publish real personal data for a test. |

Profile sections include photos, basic and physical details, bio, agent, showreels, credits, training, external profiles, skills and CV. File uploads and IMDb autofill cross Storage or external scraping/AI boundaries. Inspect validation and preview, then reload; tests of form rendering alone do not verify upload or public exposure. For every mutation, note whether a test fixture remains and verify only that fixture.

### Profile form coverage

The following controls come from `components/profile/sections/`; verify against the deployed UI before automating. Business access and safe test data are prerequisites.

| Section | Inputs and meaningful checks |
| --- | --- |
| Photos | Headshot and additional PNG/JPEG/WebP inputs. Check add/remove, invalid type/size, preview, upload failure and saved URLs independently. |
| Basic Information | Full Name, playing age Min/Max, location and gender. Change name and inspect generated slug and preview; verify that an established custom slug is not unintentionally replaced. |
| Physical & Professional Details | Height with imperial/metric control, eye and hair, nationalities, permits, ethnicity and appearance. Test conversion, multi-value add/remove and reload. |
| About Me | Awards callout and bio; textarea has a 500-character limit in source. Test boundary and displayed preview. |
| Agent | Add/remove representation and edit name, email, phone, website and contact visibility. Test public visibility separately from editor state. |
| Showreels and Credits | Repeatable rows; reels have title/URL, credits title, role, year and production. Test add/remove/reorder where available, validation and reload. |
| Training, External Profiles, Skills & Accents | Repeatable training rows, external links and skill chips (`Add a skill and press Enter`). Verify that additions and removals persist without changing unrelated rows. |
| CV Upload | PDF input; verify invalid file, upload progress/error, replacement/removal and public visibility where applicable. |
| AI Autofill | IMDb URL input and import action invokes external scraping and AI. Use a suitable synthetic or authorized reference, inspect merge behavior and existing fields, and account for provider failures. |

The profile is autosaved as well as manually saved. Treat Publish/Unpublish and public slug retrieval as separate checkpoints; an editor preview does not prove public accessibility. Do not assume `actorProfiles/{uid}` and `users/{userPath}/profile/master` are the same document.
