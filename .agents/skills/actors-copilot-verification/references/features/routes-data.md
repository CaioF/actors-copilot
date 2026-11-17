# Route and data inventory

Inventory against repository tree `8ab8fe2afde8591b88c983ecbac0432e8933d249`; compare the active checkout before relying on it. This is source-derived. A route existing does not establish that every tier can reach it or that its external dependencies work.

| Route | Surface and important relationship | Map |
| --- | --- | --- |
| `/`, `/login` | Entry and email/Google authentication, trial intent | [Access](access-billing.md) |
| `/start-trial`, `/upgrade` | Recovery interstitial and plan selection | [Access](access-billing.md) |
| `/dashboard` | Authenticated hub, intro, links to creation workflows | [Navigation](profile-navigation.md) |
| `/chat`, `/personal-dna`, `/dna-vault` | DNA conversation, entry and extracted material | [DNA](dna-coach.md) |
| `/auditions`, `/auditions/new/brief`, `/auditions/new/sides`, `/auditions/[id]` | Tracker, two wizards, detail, enrichment | [Auditions](auditions-reader.md) |
| `/reader-copilot`, `/reader-copilot/[id]` | Standalone and audition-linked rehearsal | [Reader](auditions-reader.md) |
| `/acting-coach` | Coaching sessions; accepts audition context | [Coach](dna-coach.md) |
| `/profile`, `/actors/[slug]`, `/actors/[slug]/index.md` | Editor, published HTML and markdown | [Profile](profile-navigation.md) |
| `/settings` | Identity, billing portal and destructive account controls | [Navigation](profile-navigation.md) |
| `/admin-dashboard`, `/admin-dashboard/affiliates` | Separate operator login, reporting and affiliates | [Access](access-billing.md) |

`proxy.ts` is not a wildcard over the route group. Its matcher covers dashboard, chat, auditions, personal-dna, settings, profile, acting-coach, admin and billing success; inspect it and `lib/context/ProtectedRoute.tsx` together for current gating. The layout's client guard and the server proxy protect different boundaries. Do not infer that all routes use the same proxy logic.

## Service boundaries

| API family | Responsibility | Useful verification boundary |
| --- | --- | --- |
| `/api/auth/callback`, `/api/auth/logout` | Firebase token exchange, platform session hydration/logout | Compare Firebase identity, callback response, cookie and protected navigation separately. |
| `/api/billing/{checkout,recovery,portal,currencies,affiliate,success,cancelled}`, `/api/create-portal-session` | Plan acquisition, recovery, portal and redirects | Stripe mode, customer reuse, currency/price, origin and async webhook; checkout is not entitlement. |
| `/api/webhooks/stripe` | Verify event and project Stripe subscription into billing state | Event signature, retries, status transitions and readback; do not manually grant entitlement. |
| `/api/dna/{chat,baseline,synthesize,transcribe/chat,transcribe/history}` | Conversation, extraction, synthesis and audio | Track message, extraction and profile as separate results; test synthetic text and audio. |
| `/api/auditions/{analyzeBrief,analyzeSides}` | Casting brief and sides analysis | Validate generation, failures, enrichment and saved audition separately. |
| `/api/actor-copilot/{parse-script,tts}` | Scene parsing and partner speech | Parsed character/line structure, audio permissions/playback and error paths. |
| `/api/coach/{chat,updateDna}` | Coach response and DNA update | Session identity, citations/context, persistence and external model boundary. |
| `/api/profile/{autofill,display-name}`, `/api/account/delete` | Profile imports, identity update and account deletion | Profile/identity paths can differ; destructive deletion and external scraping require targeted test scope. |
| `/api/admin/*` | Separate admin session, members, affiliates and payouts | Unauthorized 401 and authorized role with disposable fixtures; never treat member login as admin. |

Cross-feature checks and explicit skips are in [journeys](journeys.md); executable browser setup is in [browser automation](../browser-automation.md).
