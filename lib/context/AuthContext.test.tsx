/** @jest-environment jsdom */
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';

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

const mockSignOut = require('firebase/auth').signOut;
const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
const mockGetAuth = require('firebase/auth').getAuth;

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

        mockGetAuth.mockReturnValue({});
        mockOnAuthStateChanged.mockImplementation((_auth: any, callback: (user: null) => void) => {
            callback(null);
            return jest.fn();
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

            getByTestId('logout-btn').click();

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

            getByTestId('logout-btn').click();

            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith('Error signing out: ', firebaseError);
                expect(getByTestId('loading').textContent).toBe('false');
            });
        });
    });
});
