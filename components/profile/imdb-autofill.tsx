"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import type { ActorProfile } from "@/lib/profile-types";

interface ImdbAutofillProps {
  onSuccess: (data: Partial<ActorProfile>) => void;
}

type AutofillState = "idle" | "loading" | "success" | "error";

export function ImdbAutofill({ onSuccess }: ImdbAutofillProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<AutofillState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successTimer, setSuccessTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) return;

    setState("loading");
    setErrorMessage("");

    try {
      const token = await getFirebaseToken();
      const response = await fetch("/api/profile/autofill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to autofill profile");
      }

      setState("success");
      onSuccess(data.data);

      // Reset after 3 seconds
      if (successTimer) clearTimeout(successTimer);
      const timer = setTimeout(() => {
        setState("idle");
        setUrl("");
      }, 3000);
      setSuccessTimer(timer);
    } catch (error: any) {
      setState("error");
      setErrorMessage(error.message || "An unexpected error occurred");
    }
  };

  const handleRetry = () => {
    setState("idle");
    setErrorMessage("");
  };

  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";

  return (
    <div className="rounded-2xl bg-[#3D4A3C] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#E8721A]" />
        <div>
          <h3 className="text-sm font-semibold text-white">AI Autofill</h3>
          <p className="text-xs text-[#C7C7C7]/70">
            Import from your IMDB page and enrich with your DNA
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.imdb.com/name/nm0000000/"
            disabled={isLoading || isSuccess}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#E8721A] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Error message */}
        {isError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/20 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p className="text-xs text-red-200">{errorMessage}</p>
          </div>
        )}

        {/* Submit button */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || isSuccess || !url.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E8721A] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#E8721A]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importing...</span>
              </>
            ) : isSuccess ? (
              <>
                <Check className="h-4 w-4" />
                <span>Profile updated!</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Autofill</span>
              </>
            )}
          </button>

          {isError && (
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Retry
            </button>
          )}
        </div>
      </form>

      {/* Help text */}
      {!isLoading && !isSuccess && !isError && (
        <p className="mt-3 text-xs text-[#C7C7C7]/50">
          Paste your IMDB profile URL to auto-fill your profile with career data enriched by your DNA insights.
        </p>
      )}
    </div>
  );
}

async function getFirebaseToken(): Promise<string> {
  const { getAuth } = await import("firebase/auth");
  const { getApp } = await import("@/lib/firebase");

  const auth = getAuth(getApp());
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const token = await user.getIdToken();
  return token;
}
