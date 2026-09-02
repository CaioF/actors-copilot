"use client";

import { useAuth } from "@/lib/context/AuthContext";
import {
  Dna,
  FileText,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight
} from "lucide-react";
import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

interface FirebaseError {
  code: string;
  message: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string"
  );
}

export default function LoginPage() {
  const { user, loginWithGoogle, loginWithEmail, signupWithEmail, sendPasswordReset, loading } = useAuth();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");

  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSigned, setKeepSigned] = useState(true);

  const redirectAfterAuth = () => {
    if (plan === "economy" || plan === "business") {
      window.location.href = "/upgrade";
    }
  };

  useEffect(() => {
    if (!loading && user) {
      if (plan === "economy" || plan === "business") {
        window.location.href = "/upgrade";
      }
    }
  }, [user, loading, plan]);

  const handlePasswordReset = async () => {
    setErrorMsg("");
    setInfoMsg("");

    if (!email) {
      setErrorMsg("Please enter your email address above, then try again.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordReset(email);
      setInfoMsg(`If an account exists for ${email}, a password reset link has been sent.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not send reset email. Please try again.";
      setErrorMsg(message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogin = async () => {
    setErrorMsg("");
    setInfoMsg("");
    try {
      await loginWithGoogle();
      redirectAfterAuth();
    } catch (error: unknown) {
      if (isFirebaseError(error)) {
        if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
          return;
        }
        setErrorMsg(error.message);
      } else {
        const message = error instanceof Error ? error.message : "Access denied. Please try again later.";
        setErrorMsg(message);
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    if (!email || !password) {
      setErrorMsg("Please enter your email address and password to continue.");
      return;
    }

    try {
      await loginWithEmail(email, password);
      redirectAfterAuth();
    } catch (error: any) {
      const errorCode = error.cause?.code || error.code;

      if (errorCode === "auth/invalid-credential" || errorCode === "auth/user-not-found") {
        try {
          await signupWithEmail(email, password);
          redirectAfterAuth();
        } catch (signupError: any) {
          const signupErrorCode = signupError.cause?.code || signupError.code;

          if (signupErrorCode === "auth/email-already-in-use") {
            setErrorMsg("The email address or password is incorrect. Please try again.");
          } else if (signupErrorCode === "auth/weak-password") {
            setErrorMsg("Please choose a password with at least 6 characters.");
          } else {
            setErrorMsg(signupError.message || "We could not complete sign-in. Please try again.");
          }
        }
      } else {
        setErrorMsg(error.message || "Connection failed.");
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground transition-colors">

      {/* ========================================================= */}
      {/* LEFT PANEL: Branding & Visual Hero                        */}
      {/* ========================================================= */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-neutral-950 p-12 lg:p-16 flex-col justify-between overflow-hidden">

        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/image4.png"
            alt="The Actors Copilot Background"
            fill
            className="object-cover object-center opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
        </div>

        {/* Content Box Overlay */}
        <div className="relative z-10 flex flex-col justify-between h-full max-w-lg mx-auto w-full">
          {/* Logo */}
          <div>
            <Link href="/dashboard" className="inline-block transition-transform hover:scale-105">
              <Image
                src="/logo.png"
                alt="The Actors Copilot"
                width={140}
                height={50}
                className="object-contain"
                priority
              />
            </Link>
          </div>

          {/* Headline & Features Container */}
          <div className="my-auto py-12 space-y-8 rounded-3xl bg-neutral-900/60 backdrop-blur-md border border-white/10 p-8">
            <div className="space-y-3">
              <h1 className="font-title text-3xl xl:text-4xl font-bold text-white leading-tight">
                Your AI Partner for<br />Self-Taping
              </h1>
              <div className="w-12 h-[2px] bg-primary" />
              <p className="text-neutral-300 text-sm leading-relaxed">
                Build your Personal DNA, Breakdown Characters in minutes, and prepare with confidence.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <FeatureItem
                icon={<Dna className="w-4 h-4 text-white" />}
                title="Personal DNA"
                description="Build a living profile that personalises every audition"
              />
              <FeatureItem
                icon={<FileText className="w-4 h-4 text-white" />}
                title="Instant Breakdown"
                description="Upload sides and get character insights in minutes"
              />
              <FeatureItem
                icon={<ShieldCheck className="w-4 h-4 text-white" />}
                title="Private by Default"
                description="Your data stays yours. Delete anytime"
              />
            </div>
          </div>

          {/* Footer Subtext */}
          <p className="text-xs text-neutral-500">
            © {new Date().getFullYear()} The Actor's Copilot. All rights reserved.
          </p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL: Form & Auth Card                             */}
      {/* ========================================================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-background">
        <div className="w-full max-w-md space-y-6">

          {/* Mobile Logo */}
          <div className="flex justify-center lg:hidden pb-2">
            <Image
              src="/logo.png"
              alt="The Actors Copilot"
              width={130}
              height={50}
              className="object-contain"
              priority
            />
          </div>

          {/* Main Login Card */}
          <div className="rounded-3xl bg-card border border-border p-6 sm:p-10 shadow-sm transition-colors">

            {/* Header */}
            <div className="text-center space-y-1.5 mb-8">
              <h2 className="font-title text-2xl sm:text-3xl font-bold text-foreground">
                {plan ? "First, Create Your Account" : "Welcome back"}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {plan
                  ? "Let's set up your account first, then choose the perfect plan to boost your career."
                  : "Sign in to continue your acting journey."}
              </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-5">

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Email
                </label>
                <div className="flex items-center rounded-2xl border border-border bg-card px-3.5 py-2.5 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0 mr-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="support@theactorscopilot.com"
                    className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  Password
                </label>
                <div className="flex items-center rounded-2xl border border-border bg-card px-3.5 py-2.5 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Lock className="h-4 w-4 text-muted-foreground shrink-0 mr-2.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-2"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Checkbox & Forgot Password Row */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={keepSigned}
                    onChange={(e) => setKeepSigned(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
                  />
                  <span>Keep me signed in</span>
                </label>

                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetLoading || loading}
                  className="text-primary hover:underline font-semibold disabled:opacity-60 transition-all"
                >
                  {resetLoading ? "Sending link..." : "Forgot password?"}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-70 mt-4"
              >
                {loading ? (
                  <span className="animate-pulse">Processing...</span>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative flex items-center my-6">
              <div className="flex-grow border-t border-border" />
              <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs uppercase tracking-wider">
                or
              </span>
              <div className="flex-grow border-t border-border" />
            </div>

            {/* Google Sign In */}
            <div>
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 px-4 rounded-full bg-card hover:bg-muted border border-border text-foreground font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors shadow-sm disabled:opacity-70"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Info Messages */}
            {infoMsg && (
              <p className="mt-4 text-xs text-center font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                {infoMsg}
              </p>
            )}

            {/* Error Messages */}
            {errorMsg && (
              <div className="mt-4 space-y-3 animate-in fade-in">
                <p className="text-destructive text-xs text-center font-medium">
                  {errorMsg}
                </p>

                {errorMsg.includes("You don't have the required 'The Actor's Copilot' offer") && (
                  <div className="flex flex-col gap-2 pt-1">
                    <a
                      href="https://theactorscopilot.com/#pricing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-center rounded-full py-2.5 text-xs font-bold transition-colors shadow-sm"
                    >
                      Buy Premium Plan
                    </a>

                    <a
                      href="mailto:support@theactorscopilot.com"
                      className="w-full border border-border hover:bg-muted text-muted-foreground text-center rounded-full py-2.5 text-xs font-medium transition-colors"
                    >
                      Contact Support
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtitle / Secure Footer */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" />
            <span>Secure, private, and never shared.</span>
          </div>

        </div>
      </div>

    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="bg-white/10 p-2 rounded-xl shrink-0 border border-white/10">
        {icon}
      </div>
      <div>
        <h3 className="font-title font-bold text-white text-xs sm:text-sm">{title}</h3>
        <p className="text-neutral-400 text-[11px] leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
  );
}