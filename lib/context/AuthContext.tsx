'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAuth, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getApp } from "@/lib/firebase"; 

/**
 * Defines the shape of the authentication context state and its available methods.
 * @interface AuthContextType
 */
interface AuthContextType {
    user: User | null; // The authenticated Firebase user object, or null if unauthenticated.
    loading: boolean; // Indicates if the authentication state is currently being resolved.
    loginWithGoogle: () => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    signupWithEmail: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

// TODO: defining more specific error types for better error handling and user feedback in the UI, especially for common authentication issues like network errors, invalid credentials, or account conflicts.
interface FirebaseError {
  code: string;
  message: string;
}

/**
 * Type Guard to identify firebase errors
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
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
     
    /**
     * Initiates the Google OAuth login flow via Firebase pop-up.
     * Upon successful Firebase authentication, it securely exchanges the Firebase ID token
     * with the backend to validate Kajabi access and issue a secure HTTP-only session cookie.
     *
     * @throws {Error} Throws an error if backend validation fails to propagate UI feedback.
     * @returns {Promise<void>}
     */
    const loginWithGoogle = async () => {
        setLoading(true);
        // TODO: Implement a timeout mechanism for the backend verification request to prevent infinite loading states on slow networks.
        try {
            // Trigger Firebase Google sign-in pop-up
            const result = await signInWithPopup(auth, googleProvider);
            
            // Retrieve the short-lived Firebase ID token
            const idToken = await result.user.getIdToken();
            
            // Authenticate with the backend API to verify Kajabi purchases and set the JWT session
            const response = await fetch('/api/auth/callback', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                }
            }); 

            const data = await response.json();
            
            if (!response.ok) {
                // Revert Firebase auth state if the backend rejects the user
                await signOut(auth);
                throw new Error(data.error || "Failed to log in to Kajabi");
            }

            // Redirect to the protected dashboard upon successful session creation
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

            const message = error instanceof Error ? error.message : "An unexpected error occurred";
            console.error("Failed to log in: ", message);
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
                headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const data = await response.json();
                await signOut(auth);
                throw new Error(data.error || "Failed to establish secure session.");
            }
            window.location.href = "/dashboard"; 
        } catch (error: unknown) {
            if (isFirebaseError(error)) {
                if (error.code === 'auth/invalid-credential') {
                    throw new Error("Invalid credentials. If you originally signed up with Google, please use the Google button.", { cause: error });
                }
            }

            const message = error instanceof Error ? error.message : "Failed to log in with email";
            console.error("Login Error: ", message);
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
                headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const data = await response.json();
                await signOut(auth);
                throw new Error(data.error || "Failed to establish secure session.");
            }
            window.location.href = "/dashboard"; 
        } catch (error: unknown) {
            if (isFirebaseError(error)) {
                if (error.code === 'auth/email-already-in-use') {
                    throw new Error("This email is already registered. Try logging in with Google or your password instead.", { cause: error });
                }
            }
            const message = error instanceof Error ? error.message : "Failed to sign up with email";
            console.error("Signup Error: ", message);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Terminates the user's session by signing out of Firebase and requesting
     * the backend to destroy the secure HTTP-only session cookie.
     *
     * @returns {Promise<void>}
     */
    const logout = async () => {
        setLoading(true);
        // TODO: Add telemetry or analytics tracking here to monitor user session durations and logout events.
        try {
            await signOut(auth);
            // Note: Firebase's onAuthStateChanged listener will automatically detect this and update the local user state to null.
            
            // Invalidate the backend session cookie
            await fetch('/api/auth/logout', {
                method: 'POST',
            });
            
            window.location.href = "/login"; 
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Unknown logout error";
            console.error("Error signing out: ", message);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Subscribes to Firebase authentication state changes to keep the local React state synchronized.
     * Automatically cleans up the listener when the component unmounts.
     */
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, [auth]);

    return (
        <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, loginWithEmail, signupWithEmail }}>
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