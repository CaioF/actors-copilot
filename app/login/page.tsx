'use client'

import { useAuth } from "@/lib/context/AuthContext"; 
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
    const {loginWithGoogle, user, loading} = useAuth();
    const router = useRouter(); 
    
    useEffect(() => {
    if (user && !loading) {
        router.push('/dashboard'); // if already logged
    }
    }, [user, loading]);

    const handleLogin = async ()=> {
        try {
            await loginWithGoogle();

            //if log in sucessfull
            router.push('dashboard');
        } catch (error) {
            console.error("Fail to redirect: ", error);
        }

    }

    return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1>The Actor's Copilot</h1>
      <button 
        onClick={handleLogin}
        disabled={loading}
        className="px-4 py-2 bg-orange-500 text-white rounded"
      >
        {loading ? 'Logging in...' : 'Log in with Google'} 
      </button>
    </div>
  );

}