'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAuth, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import {getApp} from "@/lib/firebase"; 

interface AuthContextType {
    user: User | null; // Complete user object or null if no one logged
    loading: boolean; // Is firebase still loading
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType| null> (null);

//auth through google settings
const googleProvider = new GoogleAuthProvider();

export function AuthProvider({children} : {children: ReactNode}) {

    const app = getApp();
    const auth = getAuth(app);
    
    //initialization
     const [user, setUser] = useState<User | null>(null);
     const [loading, setLoading] = useState<boolean>(true);
     
     //login function
     const loginWithGoogle = async () => {
        setLoading(true);
        try {
            //google popup handled by firebase
            const result = await signInWithPopup(auth, googleProvider);
            // temporary token firebase created
            const idToken = await result.user.getIdToken();
            const response = await fetch('/api/auth/callback', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (!response.ok) {
                await signOut(auth);
                throw new Error(data.error || "Failed to log in to Kajabi");
            }

            if (!response.ok) {
                await signOut(auth); // log out from firebase if kajabi login fails
                throw new Error("Failed to log in to Kajabi");
            }

            //if successful
            window.location.href = "/dashboard"; //redirect to dashboard

        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                return; // go to 'finally'
            }

            console.error("Failed to log in: ", error);
            throw error; //pass the error to who is using the function in order to not have a false sucess using it
        } finally {
            setLoading(false);
        }
     };

     //function to log out
     const logout = async () => {
        setLoading(true);
        try {
            await signOut(auth);
            //onAuthStateChanged sees it changed and automatically user = null
            await fetch('/api/auth/logout', {
                method: 'POST',
            });
            window.location.href = "/login"; 
        } catch (error){
            console.error("Error signing out: ", error);
        } finally {
            setLoading(false);
        }
     }

     //watch if anything happens with the log in
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
};