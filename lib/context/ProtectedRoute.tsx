'use client'
import { Loader2, Clapperboard } from "lucide-react";
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
        // O fixed inset-0 z-50 garante que vai cobrir a tela TODA e ficar no meio exato
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F0E8DC]">
            
            {/* Efeito visual "AI Thinking / DNA Scanning" */}
            <div className="relative flex items-center justify-center mb-8">
                {/* Anel externo pulsante (Efeito radar) */}
                <div className="absolute w-24 h-24 border-2 border-[#E8721A] rounded-full animate-ping opacity-20"></div>
                
                {/* Anel intermediário respirando */}
                <div className="absolute w-20 h-20 border-4 border-[#E8721A]/30 rounded-full animate-pulse"></div>
                
                {/* Círculo central com o ícone */}
                <div className="relative z-10 bg-[#3D4A3C] p-4 rounded-full shadow-2xl">
                    <Clapperboard className="w-8 h-8 text-[#E8721A]" />
                </div>
            </div>

            {/* Tipografia Premium */}
            <h1 className="font-serif text-3xl text-[#2C3328] mb-3 tracking-wide">
                The Actors Copilot
            </h1>
            
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            
            <p className="text-[#6B6B6B] text-sm uppercase tracking-[0.2em] mt-4 font-medium animate-pulse">
                Preparing your studio...
            </p>
        </div>
    );
}

    return user ? <>{children}</> : null;
}