/** @jest-environment jsdom */
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { signOut, onAuthStateChanged, getAuth, Auth, User } from 'firebase/auth';
import { logger } from '@/lib/logger';

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
        const { logout, loading, user } = useAuth();
        return (
            <div>
                <span data-testid="loading">{loading.toString()}</span>
                <span data-testid="user">{user ? 'has-user' : 'no-user'}</span>
                <button onClick={() => logout()} data-testid="logout-btn">Logout</button>
            </div>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
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

    describe('logout', () => {
        it('success: Firebase signOut + backend logout called', async () => {
            mockSignOut.mockResolvedValue(undefined);
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
                expect(mockSignOut).toHaveBeenCalled();
                expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
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
