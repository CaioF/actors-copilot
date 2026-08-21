"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import type { ActorProfile } from "@/lib/profile-types";

interface ImdbAutofillProps {
  onSuccess: (data: Partial<ActorProfile>) => void;
}

type AutofillState = "idle" | "loading" | "success" | "error";

/**
 * AI-powered IMDB autofill component that imports actor profile data from an IMDB URL.
 * @param onSuccess - Callback with the imported profile data
 */
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
    <div className="rounded-2xl bg-card border border-border text-card-foreground p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground font-title">AI Autofill</h3>
          <p className="text-xs text-muted-foreground">
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
            className="w-full rounded-xl border border-border bg-input/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Error message */}
        {isError && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/15 border border-destructive/30 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Submit button */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || isSuccess || !url.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
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
              className="rounded-full border border-border bg-muted/60 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Retry
            </button>
          )}
        </div>
      </form>

      {/* Help text */}
      {!isLoading && !isSuccess && !isError && (
        <p className="mt-3 text-xs text-muted-foreground">
          Paste your IMDB profile URL to auto-fill your profile with career data enriched by your DNA insights.
        </p>
      )}
    </div>
  );
}

/**
 * Retrieves a Firebase authentication token for API authorization.
 * @throws Error if the user is not authenticated
 */
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
