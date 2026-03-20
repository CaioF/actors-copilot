'use client'
import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client-side wrapper component for protecting private routes.
 * While the Next.js Edge Middleware handles robust server-side security and token validation, 
 * this component ensures a seamless client-side user experience by preventing unauthorized 
 * content flashing and handling graceful redirects based on the local Firebase auth state.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The protected UI components to render if authenticated.
 * @returns {JSX.Element | null} The requested UI, a loading state, or null during redirection.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    /**
     * Monitors the authentication state and triggers a client-side redirect to the login page
     * if the user is determined to be unauthenticated after the initial loading phase completes.
     */
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]); 

    // TODO: Replace this basic text with a proper UI Skeleton component or a branded loading spinner to improve perceived performance during initial auth checks.
    if (loading) {
        return (
            <div className="flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    return user ? <>{children}</> : null;
}