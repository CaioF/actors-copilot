'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAuth, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getApp } from "@/lib/firebase"; 
import { logger } from '@/lib/logger';
import type { SubscriptionTier, SubscriptionStatus } from '@/lib/billing';

/**
 * Extends the default Firebase User to include modern Stripe billing context attributes.
 */
export interface AppUser extends User {
    tier?: SubscriptionTier;
    subscriptionStatus?: SubscriptionStatus;
    stripeCustomerId?: string;
}

/**
 * Defines the shape of the authentication context state and its available methods.
 * @interface AuthContextType
 */
interface AuthContextType {
    user: AppUser | null; // The authenticated Firebase user object containing billing metadata, or null if unauthenticated.
    loading: boolean; // Indicates if the authentication state is currently being resolved.
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    signupWithEmail: (email: string, password: string) => Promise<void>;
    sendPasswordReset: (email: string) => Promise<void>;
    logout: () => Promise<void>;
}

interface FirebaseError {
  code: string;
  message: string;
}

/**
 * Type Guard to identify firebase errors.
 */
function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

/**
 * React Context for managing global authentication state.
 */
const AuthContext = createContext<AuthContextType | null>(null);

// Configure the Google OAuth provider for Firebase
const googleProvider = new GoogleAuthProvider();

/**
 * Provider component that wraps the application to supply authentication state.
 * Listens to Firebase auth state changes and exposes login/logout functionality.
 *
 * @param {Object} props - The component properties.
 * @param {ReactNode} props.children - Child components to be rendered within the provider.
 * @returns {JSX.Element} The authentication context provider.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const app = getApp();
    const auth = getAuth(app);
    
    // State initialization
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
     
    /**
     * Initiates the Google OAuth login flow via Firebase pop-up.
     * Upon successful Firebase authentication, it securely exchanges the Firebase ID token
     * with the backend to validate subscription state and issue a secure platform session cookie.
     *
     * @throws {Error} Throws an error if backend validation fails to propagate UI feedback.
     * @returns {Promise<void>}
     */
    const loginWithGoogle = async () => {
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            
            const response = await fetch('/api/auth/callback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ idToken })
            }); 

            const data = await response.json();
            
            if (!response.ok) {
                await signOut(auth);
                throw new Error(data.error || "Failed to establish platform billing session");
            }

            setUser(result.user as AppUser);
            window.location.href = "/dashboard"; 

        } catch (error: unknown) {
            if (isFirebaseError(error)) {
                if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                    return; 
                }
                if (error.code === 'auth/account-exists-with-different-credential') {
                    throw new Error("This email is already registered. Please log in using the Email/Password form.", { cause: error });
                }
            }

            logger.error({ err: error, msg: 'Failed to log in with Google OAuth' });
            throw error;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Logs in a user with email/password and establishes a secure server-side session.
     * @param {string} email - The user's email.
     * @param {string} password - The user's password.
     * @throws {Error} Throws if Firebase auth fails or the backend rejects the session.
     */
    const loginWithEmail = async (email: string, password: string) => {
        setLoading(true);
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await result.user.getIdToken();
            
            const response = await fetch('/api/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });

            const data = await response.json();
            
            if (!response.ok) {
                await signOut(auth);
                throw new Error(data.error || "Failed to establish platform billing session.");
            }

            setUser(result.user as AppUser);
            window.location.href = "/dashboard"; 
        } catch (error: unknown) {
            if (isFirebaseError(error)) {
                if (error.code === 'auth/invalid-credential') {
                    throw new Error("Invalid credentials. If you originally signed up with Google, please use the Google button.", { cause: error });
                }
            }

            logger.error({ err: error, msg: 'Login Error' });
            throw error;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Registers a user with email/password and establishes a secure server-side session.
     * @param {string} email - The user's email.
     * @param {string} password - The user's password.
     * @throws {Error} Throws if Firebase registration fails or the backend rejects the session.
     */
    const signupWithEmail = async (email: string, password: string) => {
        setLoading(true);
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const idToken = await result.user.getIdToken();
            
            const response = await fetch('/api/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });
            
            const data = await response.json();

            if (!response.ok) {
                await signOut(auth);
                throw new Error(data.error || "Failed to establish platform registration session.");
            }

            const userWithBilling: AppUser = Object.assign(result.user, { 
                tier: data.user?.tier || 'free',
                subscriptionStatus: data.user?.subscriptionStatus || 'canceled'
            });

            setUser(userWithBilling);
            window.location.href = "/dashboard"; 
        } catch (error: unknown) {
            if (isFirebaseError(error)) {
                if (error.code === 'auth/email-already-in-use') {
                    throw new Error("This email is already registered. Try logging in with Google or your password instead.", { cause: error });
                }
            }
            logger.error({ err: error, msg: 'Signup Error' });
            throw error;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Sends a Firebase password reset email to the provided address.
     * @param {string} email - The email address to send the reset link to.
     */
    const sendPasswordReset = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error: unknown) {
            if (isFirebaseError(error)) {
                if (error.code === 'auth/invalid-email') {
                    throw new Error("Please enter a valid email address.", { cause: error });
                }
                if (error.code === 'auth/user-not-found') {
                    return;
                }
            }
            logger.error({ err: error, msg: 'Password reset error' });
            throw error;
        }
    };

    /**
     * Terminates the user's session by signing out of Firebase and requesting
     * the backend to destroy active secure session tokens.
     *
     * @returns {Promise<void>}
     */
    const logout = async () => {
        setLoading(true);
        try {
            await signOut(auth);
            await fetch('/api/auth/logout', {
                method: 'POST',
            });
            window.location.href = "/login"; 
        } catch (error: unknown) {
            logger.error({ err: error, msg: 'Error signing out' });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Subscribes to Firebase authentication state changes to keep the local React state synchronized.
     * Hydrates user entitlement structures with properties returned from the secure token engine.
     */
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                try {
                    const response = await fetch('/api/auth/callback', { method: 'GET' });
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // CORRIGIDO: Asserção de tipo sênior para alinhar as strings da API com as tipagens estritas do domínio
                        const userWithBilling: AppUser = Object.assign(currentUser, { 
                            tier: data.tier as SubscriptionTier,
                            subscriptionStatus: data.subscriptionStatus as SubscriptionStatus,
                            stripeCustomerId: data.stripeCustomerId as string | undefined
                        });
                        setUser(userWithBilling);
                    } else {
                        logger.error({ 
                            err: new Error(`HTTP ${response.status}: ${response.statusText}`), 
                            msg: "[AuthContext] Failed sync inside entitlement route handler context." 
                        });
                        
                        const fallbackUser: AppUser = Object.assign(currentUser, { tier: 'free' as SubscriptionTier, subscriptionStatus: 'canceled' as SubscriptionStatus });
                        setUser(fallbackUser);
                    }
                } catch (err) {
                    logger.error({ err, msg: "[AuthContext] Fatal runtime crash during subscription metadata synchronization" });
                    const fallbackUser: AppUser = Object.assign(currentUser, { tier: 'free' as SubscriptionTier, subscriptionStatus: 'canceled' as SubscriptionStatus });
                    setUser(fallbackUser);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [auth]);

    return (
        <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, loginWithEmail, signupWithEmail, sendPasswordReset }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Custom hook to safely consume the authentication context.
 *
 * @throws {Error} Throws an error if used outside of an AuthProvider component tree.
 * @returns {AuthContextType} The current authentication state and methods.
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside an AuthProvider");
    return context;
};