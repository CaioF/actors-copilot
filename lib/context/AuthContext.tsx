'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAuth, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getApp } from "@/lib/firebase"; 

/**
 * Defines the shape of the authentication context state and its available methods.
 * @interface AuthContextType
 */
interface AuthContextType {
    user: User | null; // The authenticated Firebase user object, or null if unauthenticated.
    loading: boolean; // Indicates if the authentication state is currently being resolved.
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
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

        } catch (error: any) {
            // Gracefully handle user-initiated pop-up closure without throwing an application error
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                return; 
            }

            console.error("Failed to log in: ", error);
            // Propagate the error to the calling component to ensure accurate UI feedback
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
        } catch (error) {
            console.error("Error signing out: ", error);
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
        <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
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