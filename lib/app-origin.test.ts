import { isAllowedAppHost, isSameAppOrigin, resolveAppUrl } from './app-origin';

describe('checkout origin helpers', () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_APP_URL = 'https://app.theactorscopilot.com';
    });

    describe('isAllowedAppHost', () => {
        it('accepts the production and preview hosts of this project', () => {
            expect(isAllowedAppHost('app.theactorscopilot.com')).toBe(true);
            expect(isAllowedAppHost('actors-copilot.vercel.app')).toBe(true);
            expect(isAllowedAppHost('v0-self-tape-copilot.vercel.app')).toBe(true);
            expect(isAllowedAppHost('actors-copilot-abc123-caiofs-projects.vercel.app')).toBe(true);
            expect(isAllowedAppHost('actors-copilot-git-main-caiofs-projects.vercel.app')).toBe(true);
        });

        it('rejects foreign hosts', () => {
            expect(isAllowedAppHost('evil.example.com')).toBe(false);
            expect(isAllowedAppHost('another-project.vercel.app')).toBe(false);
            expect(isAllowedAppHost('app.theactorscopilot.com.evil.test')).toBe(false);
            expect(isAllowedAppHost('')).toBe(false);
        });
    });

    describe('resolveAppUrl', () => {
        it('uses the forwarded host when it belongs to this project', () => {
            const headers = new Headers({
                'x-forwarded-host': 'app.theactorscopilot.com',
                'x-forwarded-proto': 'https',
            });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });

        it('keeps a local host out of the allow list and falls back', () => {
            const headers = new Headers({ host: 'localhost:3000' });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });

        it('falls back to the configured app URL for a foreign host', () => {
            const headers = new Headers({
                'x-forwarded-host': 'evil.example.com',
                'x-forwarded-proto': 'https',
            });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });

        it('falls back to the configured app URL when no host is present', () => {
            expect(resolveAppUrl(new Headers())).toBe('https://app.theactorscopilot.com');
        });

        it('takes the first host of a proxied chain', () => {
            const headers = new Headers({
                'x-forwarded-host': 'app.theactorscopilot.com, internal.proxy.local',
                'x-forwarded-proto': 'https, http',
            });

            expect(resolveAppUrl(headers)).toBe('https://app.theactorscopilot.com');
        });

        it('returns the origin of the request for every alias of the project', () => {
            for (const host of [
                'app.theactorscopilot.com',
                'actors-copilot.vercel.app',
                'v0-self-tape-copilot.vercel.app',
            ]) {
                const headers = new Headers({ 'x-forwarded-host': host, 'x-forwarded-proto': 'https' });
                expect(resolveAppUrl(headers)).toBe(`https://${host}`);
            }
        });
    });

    describe('isSameAppOrigin', () => {
        it('compares by host and ignores the path', () => {
            expect(
                isSameAppOrigin(
                    'https://app.theactorscopilot.com/api/billing/success?session_id=cs_1',
                    'https://app.theactorscopilot.com',
                ),
            ).toBe(true);
        });

        it('detects a different host', () => {
            expect(
                isSameAppOrigin(
                    'https://actors-copilot.vercel.app/api/billing/success',
                    'https://app.theactorscopilot.com',
                ),
            ).toBe(false);
        });

        it('treats an unparsable URL as a different origin', () => {
            expect(isSameAppOrigin('not-a-url', 'https://app.theactorscopilot.com')).toBe(false);
        });
    });
});
