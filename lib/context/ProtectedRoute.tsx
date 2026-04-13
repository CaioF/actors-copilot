'use client'
import { Clapperboard } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLoadingText } from "@/hooks/use-loading-text";

/**
 * Client-side wrapper component for protecting private routes.
 * While the Next.js Edge Middleware handles robust server-side security and token validation,
 * this component ensures a seamless client-side user experience by preventing unauthorized
 * content flashing and handling graceful redirects based on the local Firebase auth state.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const loadingText = useLoadingText("ui");

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F0E8DC]">

            <div className="relative flex items-center justify-center mb-8">
                <div className="absolute w-24 h-24 border-2 border-[#E8721A] rounded-full animate-ping opacity-20"></div>
                <div className="absolute w-20 h-20 border-4 border-[#E8721A]/30 rounded-full animate-pulse"></div>
                <div className="relative z-10 bg-[#3D4A3C] p-4 rounded-full shadow-2xl">
                    <Clapperboard className="w-8 h-8 text-[#E8721A]" />
                </div>
            </div>

            <h1 className="font-title text-3xl text-[#2C3328] mb-3 tracking-wide">
                The Actors Copilot
            </h1>

            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>

            <p className="text-[#6B6B6B] text-sm uppercase tracking-[0.2em] mt-4 font-medium h-5 transition-opacity duration-300">
                {loadingText}
            </p>
        </div>
    );
}

    return user ? <>{children}</> : null;
}
