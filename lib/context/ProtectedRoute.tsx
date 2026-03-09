'use client'
import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const {user, loading} = useAuth();
    const router = useRouter();

    useEffect( ()=> {
        //if client is not logged in, and trying to access a page
        if (!loading && !user ) {
            router.push('/login');
        }
    }, [user, loading, router]    ); 

    if (loading) {
        return (
            <div className="flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    return user ? <>{children}</> : null;
}

