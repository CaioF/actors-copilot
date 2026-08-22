"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ExternalLink, Copy, Share2, Check, Loader2, Cloud, CloudOff } from "lucide-react";
import { ActorProfile, generateSlug } from "@/lib/profile-types";
import type { SaveStatus } from "@/app/(interior)/profile/page";

interface ProfileHeaderProps {
  onPublish: () => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}

/**
 * Header component for the profile page displaying profile status, URL, and publish controls.
 * Allows users to copy the profile link, unpublish a live profile, or publish a draft.
 * @param onPublish - Callback to publish the profile
 * @param onSave - Callback to save the profile
 * @param saveStatus - Current save status
 */
export function ProfileHeader({ onPublish, onSave, saveStatus }: ProfileHeaderProps) {
  const { watch, setValue } = useFormContext<ActorProfile>();
  const status = watch("status");
  const slug = watch("slug");
  const fullName = watch("fullName");
  const [copied, setCopied] = useState(false);

  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const profilePath = `actors/${slug || generateSlug(fullName || "")}`;
  // Display URL without protocol; full URL (with protocol) is used for copy/share
  const profileUrl = `${siteOrigin.replace(/^https?:\/\//, "")}/${profilePath}`;
  const profileFullUrl = `${siteOrigin}/${profilePath}`;

  /**
   * Copies the profile URL to the clipboard and shows a temporary success indicator.
   */
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileFullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard access denied - silently ignore
    }
  };

  /**
   * Sets the profile status to draft and triggers a save.
   */
  const unpublish = () => {
    setValue("status", "draft", { shouldDirty: true });
    onSave();
  };

  /**
   * Opens the native device sharing dialog if supported, otherwise falls back to copying the link.
   */
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${fullName || 'Actor'} - Profile`,
          text: 'Check out my actor profile on The Actors Copilot!',
          url: profileFullUrl,
        });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          await copyLink();
        }
      }
    } else {
      // Fallback for desktop browsers that don't support native sharing
      copyLink();
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-title text-2xl font-bold text-foreground">
              Your Actor Profile
            </h2>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                status === "published"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {status === "published" ? "Published" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Build your professional presence. Control what the world sees.
          </p>
        </div>

        {/* Save Status Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Cloud className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary font-medium">Saved</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <CloudOff className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive font-medium">Save failed</span>
            </>
          )}
        </div>
      </div>

      {/* URL Bar + Actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="flex flex-1 items-center gap-2 min-w-[200px] px-2 py-1">
          <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm text-foreground font-mono">{profileUrl}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy Link */}
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
            Share
          </button>

          {/* Draft / Unpublish */}
          {status === "published" ? (
            <button
              type="button"
              onClick={unpublish}
              className="flex items-center gap-1 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Unpublish
            </button>
          ) : (
            <span className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Draft
            </span>
          )}

          {/* Publish */}
          <button
            type="button"
            onClick={onPublish}
            disabled={saveStatus === "saving" || status === "published"}
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70 shadow-sm"
          >
            {status === "published" ? "Published" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
