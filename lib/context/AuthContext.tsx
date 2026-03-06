'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import {getApp} from "@/lib/firebase"; 

interface AuthContextType {
    user: User | null; // Complete user object or null if no one logged
    loading: boolean; // Is firebase still loading
    loginWithGoogle: () => Promise<void>
}

const AuthContext = createContext<AuthContextType| null> (null);

const app = getApp(); 
//auth through google settings
const googleProvider = new GoogleAuthProvider();
const auth = getAuth(getApp());

export function AuthProvider({children} : {children: ReactNode}) {

    //initialization
     const [user, setUser] = useState<User | null>(null);
     const [loading, setLoading] = useState<boolean>(true);

     //login function
     const loginWithGoogle = async () => {
        setLoading(true);
        try {
            //google popup handled by firebase
            const result = await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Failed to log in: ", error);
            throw error; //pass the error to who is using the function in order to not have a false sucess using it
        } finally {
            setLoading(false);
        }
     };

     //watch if anything happens with the log in
     useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [auth]);

    return (
        <AuthContext.Provider value={{ user, loading, loginWithGoogle }}>
            {children}
        </AuthContext.Provider>
    );

}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
};