/** @jest-environment jsdom */
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { signOut, onAuthStateChanged, getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, Auth, User } from 'firebase/auth';
import { logger } from '@/lib/logger';
import { redirectTo } from '@/lib/navigate';

jest.mock('@/lib/navigate', () => ({ redirectTo: jest.fn() }));

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

if (typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  window.PointerEvent = PointerEvent as any;
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  window.HTMLElement.prototype.hasPointerCapture = jest.fn();
  window.HTMLElement.prototype.releasePointerCapture = jest.fn();
}

jest.mock('@/lib/logger', () => {
  const mockLog = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };
  return {
    logger: mockLog,
    createChildLogger: jest.fn().mockReturnValue(mockLog),
  };
});

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
}));

jest.mock('@/lib/firebase', () => ({
    getApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: jest.fn(),
    signInWithPopup: jest.fn(),
    onAuthStateChanged: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
}));

global.fetch = jest.fn();

const mockSignOut = jest.mocked(signOut);
const mockOnAuthStateChanged = jest.mocked(onAuthStateChanged);
const mockGetAuth = jest.mocked(getAuth);

describe('AuthContext', () => {
    let consoleErrorSpy: jest.SpyInstance;

    const TestComponent = () => {
        const { logout, loginWithEmail, signupWithEmail, loading, user } = useAuth();
        return (
            <div>
                <span data-testid="loading">{loading.toString()}</span>
                <span data-testid="user">{user ? 'has-user' : 'no-user'}</span>
                <button onClick={() => signupWithEmail('actor@example.test', 'password')} data-testid="signup-btn">Create Account</button>
                <button onClick={() => logout()} data-testid="logout-btn">Logout</button>
                <button onClick={() => loginWithEmail('member@example.com', 'password')} data-testid="login-btn">Login</button>
            </div>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        sessionStorage.clear();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockGetAuth.mockReturnValue({} as Auth);
        mockOnAuthStateChanged.mockImplementation((_auth, nextOrObserver) => {
        if (typeof nextOrObserver === 'function') {
            nextOrObserver(null);
        } else if (nextOrObserver && typeof nextOrObserver === 'object' && 'next' in nextOrObserver) {
            nextOrObserver.next?.(null);
        }
        return () => {}; 
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it.each([false, true])('consumes a trial intent before checkout and sends a failed request to manual recovery (network=%s)', async (networkFailure) => {
        const user = { getIdToken: jest.fn().mockResolvedValue('token') } as unknown as User;
        mockGetAuth.mockReturnValue({ currentUser: user } as Auth);
        jest.mocked(signInWithEmailAndPassword).mockResolvedValue({ user } as never);
        sessionStorage.setItem('trial_intent', '14d');
        sessionStorage.setItem('trial_tier', 'economy');
        (global.fetch as jest.Mock).mockImplementation(async (path: string) => {
            if (path === '/api/auth/callback') return { ok: true, json: async () => ({}) };
            expect(sessionStorage.getItem('trial_intent')).toBeNull();
            if (networkFailure) throw new Error('offline');
            return { ok: false, json: async () => ({ error: 'Checkout failed' }) };
        });
        const { getByTestId } = render(<AuthProvider><TestComponent /></AuthProvider>);
        await waitFor(() => expect(getByTestId('loading').textContent).toBe('false'));
        await act(async () => { fireEvent.click(getByTestId('login-btn')); });
        expect(redirectTo).toHaveBeenCalledWith('/start-trial');
        expect((global.fetch as jest.Mock).mock.calls.filter(([path]) => path === '/api/billing/checkout')).toHaveLength(1);
        expect(sessionStorage.getItem('trial_intent')).toBeNull();
    });

    it('waits for the platform session before routing a fresh signup to its trial', async () => {
        const user = { getIdToken: jest.fn().mockResolvedValue('token') } as unknown as User;
        jest.mocked(createUserWithEmailAndPassword).mockResolvedValue({ user } as never);
        let finishExchange!: (value: Response) => void;
        (global.fetch as jest.Mock).mockImplementation(() => new Promise(resolve => { finishExchange = resolve; }));
        const { getByTestId } = render(<AuthProvider><TestComponent /></AuthProvider>);
        await waitFor(() => expect(getByTestId('loading').textContent).toBe('false'));
        fireEvent.click(getByTestId('signup-btn'));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/callback', expect.objectContaining({ method: 'POST' })));
        const observer = mockOnAuthStateChanged.mock.calls[0][1];
        if (typeof observer !== 'function') throw Error('Missing Firebase observer');
        await act(async () => { await observer(user); });
        expect(getByTestId('loading').textContent).toBe('true');
        expect(getByTestId('user').textContent).toBe('no-user');
        expect(redirectTo).not.toHaveBeenCalled();
        await act(async () => {
            finishExchange({ ok: true, json: async () => ({ user: { tier: 'free' } }) } as Response);
        });
        expect(redirectTo).toHaveBeenCalledWith('/start-trial');
        expect(getByTestId('user').textContent).toBe('has-user');
    });

    describe('logout', () => {
        it('success: Firebase signOut + backend logout called', async () => {
            mockSignOut.mockResolvedValue(undefined);
            (global.fetch as jest.Mock).mockResolvedValue({ 
                ok: true, 
                json: async () => ({}) 
            });

            const { getByTestId } = render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(getByTestId('loading').textContent).toBe('false');
            });

            await act(async () => {
                fireEvent.click(getByTestId('logout-btn'));
            });

            await waitFor(() => {
                expect(mockSignOut).toHaveBeenCalled();
                // Correção do Timeout: Permite que o fetch passe caso existam Headers no request original
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/auth/logout', 
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('Firebase error: Error logged, still sets loading=false', async () => {
            const firebaseError = new Error('Firebase sign out failed');
            mockSignOut.mockRejectedValue(firebaseError);
            (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

            const { getByTestId } = render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(getByTestId('loading').textContent).toBe('false');
            });

            await act(async () => {
                fireEvent.click(getByTestId('logout-btn'));
            });

            await waitFor(() => {
                expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ 
                    msg: expect.stringContaining('Error signing out') 
                })
                );
                expect(getByTestId('loading').textContent).toBe('false');
            });
        });
    });
});
