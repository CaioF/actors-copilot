'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { Sparkles, FileText, Lock } from 'lucide-react';
import { useState, ReactNode } from 'react';
import Link from "next/link";
import Image from "next/image"

/**
 * Main authentication page component.
 * Renders the login interface alongside app features and manages 
 * the Google login flow utilizing the AuthContext.
 *
 * @returns {JSX.Element} The rendered login page component.
 */
export default function LoginPage() {
    const { loginWithGoogle, loginWithEmail, signupWithEmail, loading } = useAuth();

    const [errorMsg, setErrorMsg] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    /**
     * Initiates the Google login flow and handles UI error state.
     * Silently ignores errors caused by the user intentionally closing the OAuth pop-up.
     * @returns {Promise<void>}
     */
    const handleLogin = async () => {
        setErrorMsg('');
        try {
            await loginWithGoogle();
        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                return; 
            }
            
            setErrorMsg(error.message || 'Access denied. Please check your account.');
        }
    }

    /**
     * Handles form submission for Email/Password Authentication.
     * Determines whether to execute login or signup based on component state,
     * and maps Firebase error codes to user-friendly messages.
     * * @param {React.FormEvent} e - The form submission event.
     */
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault(); // Impede a página de recarregar
        setErrorMsg('');
        
        if (!email || !password) {
            setErrorMsg('Please enter both email and password.');
            return;
        }

        try {
            if (isSignUp) {
                await signupWithEmail(email, password);
            } else {
                await loginWithEmail(email, password);
            }
        } catch (error: any) {
            // Traduzindo os erros feios do Firebase para o usuário final
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                setErrorMsg('Invalid email or password.');
            } else if (error.code === 'auth/email-already-in-use') {
                setErrorMsg('This email is already in use. Please log in.');
            } else if (error.code === 'auth/weak-password') {
                setErrorMsg('Password should be at least 6 characters.');
            } else {
                setErrorMsg(error.message || 'An error occurred. Please try again.');
            }
        }
    }

    return (
        <div className="min-h-screen w-full flex">
            
            {/* ========================================================= */}
            {/* LEFT PANEL: Branding & Features (Hidden on mobile)        */}
            {/* ========================================================= */}
            <div className="hidden md:flex md:w-1/2 bg-background flex-col justify-between p-12 lg:p-20">
                
                {/* Logo Container*/}
                {/* Logo */}
                <div className="flex items-center justify-left px-5 pt-6 ">
                    {/* We wrap the image in a Link so clicking the logo goes home. 
                        Added a slight hover scale effect for interactivity */}
                    <Link href="/dashboard" className="block transition-transform hover:scale-105">
                    <Image 
                        src="/logo.png" 
                        alt="The Actors Copilot" 
                        width={150} 
                        height={150} 
                        className="object-contain" // Ensures the image doesn't stretch or distort
                        priority // Tells Next.js to load this immediately since it's above the fold
                    />
                    </Link>
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
                    {/* 👇 O NOVO FORMULÁRIO DE E-MAIL/SENHA */}
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
                            ) : isSignUp ? (
                                "Create Account"
                            ) : (
                                "Log In"
                            )}
                        </button>
                    </form>

                    {/* Divisor "OR" */}
                    <div className="relative flex items-center py-4">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm">or</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    {/* Botão Antigo do Google */}
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

                    {/* Mensagens de Erro */}
                    {errorMsg && (
                        <p className="text-destructive text-sm text-center mt-4 font-medium animate-in fade-in slide-in-from-top-2">
                            {errorMsg}
                        </p>
                    )}

                    {/* Toggle Login/Cadastro */}
                    <div className="text-center pt-4">
                        <p className="text-sm text-muted-foreground">
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setErrorMsg(''); // Limpa os erros ao trocar de tela
                                }}
                                className="ml-1 text-primary hover:underline font-medium outline-none"
                            >
                                {isSignUp ? "Log in" : "Sign up"}
                            </button>
                        </p>
                    </div>


                </div>
            </div>

        </div>
    );
}

/**
 * UI Helper component to render feature items, maintaining DRY principles.
 *
 * @param {Object} props - The component properties.
 * @param {React.ReactNode} props.icon - The Lucide React icon element.
 * @param {string} props.title - The feature title.
 * @param {string} props.description - The feature description.
 * @returns {JSX.Element} A formatted feature item layout.
 */
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