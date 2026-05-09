'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { Sparkles, FileText, Lock } from 'lucide-react';
import { useState, ReactNode } from 'react';
import Link from "next/link";
import Image from "next/image"

interface FirebaseError {
  code: string;
  message: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

export default function LoginPage() {
    const { loginWithGoogle, loginWithEmail, signupWithEmail, loading } = useAuth();

    const [errorMsg, setErrorMsg] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        setErrorMsg('');
        try {
            await loginWithGoogle();
        } catch (error: unknown) { 
            if (isFirebaseError(error)) {
                if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                    return; 
                }
                setErrorMsg(error.message);
            } else {
                const message = error instanceof Error ? error.message : 'Access denied. Please try again later.';
                setErrorMsg(message);
            }
        }
    }

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        
        if (!email || !password) {
            setErrorMsg('Please enter both email and password.');
            return;
        }

        try {
            // Passo 1: Tenta fazer o Login primeiro
            await loginWithEmail(email, password);
        } catch (error: any) {
            // Puxa o código de erro original do Firebase que foi passado via 'cause' no AuthContext
            const errorCode = error.cause?.code || error.code;

            if (errorCode === 'auth/invalid-credential') {
                // Passo 2: O login falhou com credencial inválida. A conta pode não existir. Vamos tentar criar!
                try {
                    await signupWithEmail(email, password);
                } catch (signupError: any) {
                    const signupErrorCode = signupError.cause?.code || signupError.code;

                    if (signupErrorCode === 'auth/email-already-in-use') {
                        // Se falhou ao criar porque o e-mail JÁ EXISTE, então o erro original de fato era SENHA INCORRETA.
                        setErrorMsg('Invalid email or password.');
                    } else if (signupErrorCode === 'auth/weak-password') {
                        setErrorMsg('Password should be at least 6 characters.');
                    } else {
                        setErrorMsg(signupError.message || 'An error occurred during authentication.');
                    }
                }
            } else {
                // Cai aqui se for outro erro de login (ex: falha de rede, conta desativada)
                setErrorMsg(error.message || 'Connection failed.');
            }
        }
    }

    return (
        <div className="min-h-screen w-full flex">
            
            {/* ========================================================= */}
            {/* LEFT PANEL: Branding & Features (Hidden on mobile)        */}
            {/* ========================================================= */}
            <div className="hidden md:flex md:w-1/2 bg-background flex-col justify-between p-12 lg:p-20">
                
                <div className="flex items-center justify-left px-5 pt-6 ">
                    <Link href="/dashboard" className="block transition-transform hover:scale-105">
                    <Image 
                        src="/logo.png" 
                        alt="The Actors Copilot" 
                        width={150} 
                        height={150} 
                        className="object-contain"
                        priority 
                    />
                    </Link>
                </div>

                <div className="max-w-md my-auto">
                    <h1 className="text-4xl lg:text-5xl font-title text-foreground leading-tight mb-6">
                        Your AI Partner<br />for Self-Taping
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Build your Personal DNA, Breakdown Characters in minutes, and prepare with confidence.
                    </p>
                </div>

                <div className="space-y-6 max-w-md">
                    <FeatureItem 
                        icon={<Sparkles className="w-5 h-5 text-foreground" />} 
                        title="Personal DNA" 
                        description="Build a living profile that personalises every audition" 
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
                    
                    {/* Mobile Logo (Hidden on desktop) */}
                    <div className="flex justify-center md:hidden pb-2">
                        <Image 
                            src="/logo.png" 
                            alt="The Actors Copilot" 
                            width={120} 
                            height={120} 
                            className="object-contain"
                            priority 
                        />
                    </div>
                    
                    <form onSubmit={handleEmailAuth} className="space-y-4 pt-4">
                        <div>
                            <label className="text-m font-medium text-foreground mb-1 block"> Email</label> 
                            <p className="text-sm text-muted-foreground" >Type in the same email you used in Kajabi</p>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-gray-50 border border-gray-200 text-black rounded-lg px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-m font-medium text-foreground mb-1 block">Password</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-gray-50 border border-gray-200 text-black rounded-lg px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                required
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white rounded-full py-3.5 px-4 flex items-center justify-center font-medium transition-colors disabled:opacity-70 mt-2"
                        >
                            {loading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                "Continue"
                            )}
                        </button>
                    </form>

                    <div className="relative flex items-center py-4">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm">or</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <div>
                        <button 
                            type="button"
                            onClick={handleLogin}
                            disabled={loading}
                            className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-foreground rounded-full py-3.5 px-4 flex items-center justify-center font-medium transition-colors disabled:opacity-70"
                        >
                            Continue with Google
                        </button>
                    </div>

                    {errorMsg && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <p className="text-destructive text-sm text-center font-medium">
                            {errorMsg}
                        </p>

                        {errorMsg.includes("You don't have the required 'The Actor's Copilot' offer") && (
                            <div className="flex flex-col gap-2">
                                <a 
                                    href="https://theactorscopilot.com/#pricing"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full bg-[#cf5b02] hover:bg-[#E8721A]/90 text-white text-center rounded-full py-3 text-sm font-bold transition-colors shadow-sm"
                                >
                                    Buy Premium Plan
                                </a>
                                
                                <a 
                                    href="mailto:support@theactorscopilot.com" 
                                    className="w-full border border-gray-200 hover:bg-gray-50 text-muted-foreground text-center rounded-full py-3 text-sm font-medium transition-colors"
                                >
                                    Contact Support
                                </a>
                            </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}

function FeatureItem({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
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