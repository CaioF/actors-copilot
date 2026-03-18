'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { Sparkles, FileText, Lock } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

export default function LoginPage() {
    const { loginWithGoogle, loading } = useAuth();
    const [errorMsg, setErrorMsg] = useState('');

    const handleLogin = async () => {
        setErrorMsg('');
        try {
            await loginWithGoogle();
        } catch (error: any) {
            // If the error is related to the user closing the pop-up or cancelling the login, just return silently
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                return; 
            }
            
            //string match the error message to show a user-friendly message on the frontend 
            setErrorMsg(error.message || 'Access denied. Please check your account.');
        }
      }


    return (
        <div className="min-h-screen w-full flex">
            
            {/* ========================================================= */}
            {/* LEFT PANEL: Branding & Features (Hidden on mobile)        */}
            {/* ========================================================= */}
            <div className="hidden md:flex md:w-1/2 bg-background flex-col justify-between p-12 lg:p-20">
                
                {/* Logo Container*/}
                <div>
                    {/* <Image src="/logo.png" alt="The Actors Copilot" width={120} height={120} /> */}
                    
                    {/* placeholder for brand logo */}
                    <div className="w-24 h-24 bg-card rounded-lg flex items-center justify-center text-card-foreground font-bold text-xs text-center p-2 border-2 border-primary">
                        THE ACTORS<br/>COPILOT
                    </div>
                </div>

                {/* Main Heading & Copy */}
                <div className="max-w-md my-auto">
                    <h1 className="text-4xl lg:text-5xl font-serif text-foreground leading-tight mb-6">
                        Your AI Partner<br />for Self-Taping
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Build your personal DNA, break down characters in minutes, and prepare with confidence.
                    </p>
                </div>

                {/* Feature Highlights List */}
                <div className="space-y-6 max-w-md">
                    <FeatureItem 
                        icon={<Sparkles className="w-5 h-5 text-foreground" />} 
                        title="Personal DNA" 
                        description="Build a living profile that personalizes every audition" 
                    />
                    <FeatureItem 
                        icon={<FileText className="w-5 h-5 text-foreground" />} 
                        title="Instant Breakdown" 
                        description="Upload sides and get character insights in minutes" 
                    />
                    <FeatureItem 
                        icon={<Lock className="w-5 h-5 text-foreground" />} 
                        title="Private by Default" 
                        description="Your data stays yours. Delete anytime" 
                    />
                </div>
            </div>

            {/* ========================================================= */}
            {/* RIGHT PANEL: Authentication Form                          */}
            {/* ========================================================= */}
            <div className="w-full md:w-1/2 bg-white flex items-center justify-center p-8">
                <div className="w-full max-w-sm space-y-8">
                    
                    {/* Form Header */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">Log in to continue</h2>
                        <p className="text-sm text-muted-foreground">Sign in with your Google account to continue</p>
                    </div>

                    {/* Primary Login Action (Secured via Firebase Auth Context) */}
                    <div className="pt-4">
                        <button 
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-3.5 px-4 flex items-center justify-center font-medium transition-colors disabled:opacity-70"
                        >
                            {loading ? (
                                <span className="animate-pulse">Connecting...</span>
                            ) : (
                                "Continue with Google"
                            )}
                        </button>
                        {errorMsg && (
                            <p className="text-destructive text-sm text-center mt-4 font-medium">
                                {errorMsg}
                            </p>
                        )}
                    </div>

                    {/* Visual Divider (Demo purposes indicator) */}
                    <div className="relative py-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-border"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="bg-white px-4 text-muted-foreground">For demo purposes</span>
                        </div>
                    </div>

                    {/* Secondary Action / Bypass (Demo purposes only) */}
                    <button 
                        type="button"
                        className="w-full bg-white border border-border hover:bg-muted/30 text-foreground rounded-full py-3.5 px-4 font-medium transition-colors"
                    >
                        Skip to Dashboard
                    </button>

                </div>
            </div>

        </div>
    );
}

// Helper component to render feature items and maintain DRY principles
function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="bg-muted p-2.5 rounded-full shrink-0">
                {icon}
            </div>
            <div>
                <h3 className="font-bold text-foreground text-sm">{title}</h3>
                <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
            </div>
        </div>
    );
}
