# Internal administration and affiliates

This is an operator surface, separate from member accounts. Only the signed-out form was observed in production on 2026-11-17; authenticated details below are source-derived. Do not inspect real member data or record payouts as test fixtures unless the current task authorizes that scope.

## Admin sign-in and members

Open `/admin-dashboard`: signed out shows “Admin access”, Username, Password and Log in. `/api/admin/login` creates a separate `admin_session`; member `platform_session` does not grant admin access. `proxy.ts` permits the dashboard and login endpoint but returns 401 for protected admin API calls with missing or invalid admin sessions. Test invalid credentials, expiry, logout and member-only isolation with dedicated operator fixtures. Do not paste credentials into committed scripts or logs.

The dashboard reads a member reporting projection and renders member tables with Name, Email, Referred by and Status. Test loading, empty/error states, search/filter/pagination if present in the current UI, and reconcile displayed status with the source records before diagnosing drift. The reporting projection is not the Stripe entitlement authority. Source: `app/admin-dashboard/page.tsx`, `admin-login-form.tsx`, `admin-members-table.tsx`, `app/api/admin/members/route.ts`, `lib/admin-dashboard/`. Existing tests: `__tests__/integration/admin-dashboard-flow.test.tsx`, `app/admin-dashboard/page.test.tsx`, `app/admin-dashboard/admin-members-table.test.tsx`, `app/api/admin/{login,logout,members}/route.test.ts`.

## Affiliates

`/admin-dashboard/affiliates` contains an Affiliates table (Affiliate, Referred, Collected, Commission, Paid, Pending), create form with code and name, and a “Record a transfer” form and Transfers history. Create, attribution and payout recording mutate administrative or financial records; exercise against isolated disposable fixtures only, respecting the task's authorization. Check duplicate/invalid codes, attribution, amounts and reconciliation at the appropriate boundary; a recorded transfer is not itself proof that funds moved. Source: `affiliates/affiliates-panel.tsx`, `app/api/admin/{affiliates,affiliate-payouts}/`, `lib/admin-dashboard/affiliates.ts`, `affiliate-attribution.ts`; tests: `app/admin-dashboard/affiliates/affiliates-panel.test.tsx`, `lib/admin-dashboard/affiliates.test.ts`, `lib/admin-dashboard/affiliate-attribution.test.ts`.
