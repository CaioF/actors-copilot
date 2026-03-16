'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAuth, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import {getApp} from "@/lib/firebase"; 
import { useRouter } from 'next/router';

// 1. Define the shape of the user data we expect from Kajabi
export interface KajabiUser {
    id: string;
    email: string;
    name?: string;
    // We can add specific Kajabi data here later, like:
    // hasActiveSubscription: boolean; 
}

// 2. Define what our Auth Context will provide to the rest of the app
interface AuthContextType {
    user: KajabiUser | null; 
    loading: boolean; 
    loginWithKajabi: () => void; // Notice this is void now, not a Promise!
    logout: () => void;
}

// 3. Create the context
const AuthContext = createContext<AuthContextType | null>(null);

//auth through google settings
const googleProvider = new GoogleAuthProvider();

export function AuthProvider({children} : {children: ReactNode}) {

    const app = getApp();
    const auth = getAuth(app);
    
    //initialization
    const [user, setUser] = useState<KajabiUser | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const router = useRouter();

     // This useEffect runs exactly ONCE when the app opens.
    // Its job is to look into the browser's memory and ask: "Do we have a Kajabi token here?"
    useEffect(() => {
        const checkKajabiSession = async () => {
            try {
                // We ask our Next.js backend: "Who is logged in?"
                // The browser will AUTOMATICALLY send the HttpOnly cookie in this request!
                const response = await fetch('/api/auth/me');
                
                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user); // We know who they are!
                } else {
                    setUser(null); // No valid cookie
                }
            } catch (error) {
                console.error("Session check failed", error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkKajabiSession();
    }, []); // (run this only once when the component mounts)   

    const loginWithKajabi = () => {
        // We use environment variables so we don't hardcode sensitive keys
        // NEXT_PUBLIC variables are accessible in the browser
        const clientId = process.env.NEXT_PUBLIC_KAJABI_CLIENT_ID;
        const redirectUri = process.env.NEXT_PUBLIC_KAJABI_REDIRECT_URI; // Usually: http://localhost:3000/api/auth/callback
        const kajabiDomain = process.env.NEXT_PUBLIC_KAJABI_DOMAIN; // E.g., https://my-school.mykajabi.com

        if (!clientId || !redirectUri || !kajabiDomain) {
            console.error("Missing Kajabi environment variables!");
            return;
        }

        // Construct the OAuth 2.0 Authorization URL
        // We are asking Kajabi for a "code" that we will later exchange for a real access token
        const authUrl = `${kajabiDomain}/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;

        // Redirect the entire browser to Kajabi's login page
        window.location.href = authUrl;
    };

    const logout = () => {
        setLoading(true); // Put the app in a loading state while we clean up
        
        try {
            // Remove the access token from the browser's local storage
            localStorage.removeItem('kajabi_access_token');
            
            // Clear the user from our React state
            setUser(null);
            
            // Redirect them to our public login page
            router.push('/login');
        } catch (error) {
            console.error("Error signing out: ", error);
        } finally {
            setLoading(false); // Done loading
        }
    };
    

    return (
        <AuthContext.Provider value={{ user, loading, loginWithKajabi, logout }}>
            {children}
        </AuthContext.Provider>
    );

}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
};