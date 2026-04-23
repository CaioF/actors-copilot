"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clapperboard } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ActorProfileForm } from "@/components/profile/actor-profile-form";
import { ProfileLivePreview } from "@/components/profile/profile-live-preview";
import { ImdbAutofill } from "@/components/profile/imdb-autofill";
import { useLoadingText } from "@/hooks/use-loading-text";
import { logger } from '@/lib/logger';
import {
  ActorProfile,
  actorProfileSchema,
  defaultActorProfile,
  generateSlug,
} from "@/lib/profile-types";
import { useAuth } from "@/lib/context/AuthContext";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface FirestoreError {
  code?: string;
  message?: string;
}

/**
 * Main profile page component that renders the actor profile editor.
 * Handles loading, saving (auto-save and manual), publishing, and IMDB autofill.
 * @returns The rendered profile page with form and live preview
 */
export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const loadingText = useLoadingText("ui");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether initial load is done to avoid auto-saving on reset()
  const initialLoadDone = useRef(false);

  const methods = useForm<ActorProfile>({
    resolver: zodResolver(actorProfileSchema),
    defaultValues: defaultActorProfile,
  });

  /**
   * Core save function that persists the actor profile to Firestore.
   * Used by auto-save, manual save, and publish flows.
   * @param data - Optional actor profile data to save; defaults to current form values
   * @returns void (side effects: updates saveStatus state)
   * @async
   */
  const saveDraft = useCallback(async (data?: ActorProfile) => {
    if (!user) return;
    setSaveStatus("saving");
    try {
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();

      const formData = data || methods.getValues();
      await setDoc(
        doc(db, "actorProfiles", user.uid),
        {
          ...formData,
          status: formData.status || "draft",
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
      setSaveStatus("saved");
      // Clear "saved" indicator after 3 seconds
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      logger.error({ err: error, msg: 'Error saving profile' });
      setSaveStatus("error");
    }
  }, [user, methods]);

  /**
   * Debounced auto-save trigger that waits 2 seconds after the last form change
   * before calling saveDraft to avoid excessive Firestore writes.
   * @returns void (side effect: schedules a delayed saveDraft call)
   */
  const debouncedSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveDraft();
    }, 2000);
  }, [saveDraft]);

  // Load existing profile from Firestore once auth resolves
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    const fullName = user.displayName || "";
    const defaults = {
      ...defaultActorProfile,
      fullName,
      slug: generateSlug(fullName),
    };

    let cancelled = false;

    /**
     * Loads the existing actor profile from Firestore and populates the form.
     * Falls back to default values if no profile exists or on error.
     * @returns void (side effects: updates form values and isLoading state)
     * @async
     */
    const loadProfile = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { getDb } = await import("@/lib/firebase");
        const db = getDb();
        const docSnap = await getDoc(doc(db, "actorProfiles", user.uid));

        if (cancelled) return;
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<ActorProfile>;
          methods.reset({ ...defaults, ...data });
        } else {
          methods.reset(defaults);
        }
      } catch (error: unknown) {
    if (cancelled) return;
    const isFirestoreError = typeof error === 'object' && error !== null && 'code' in error;
    const isGenericError = error instanceof Error;
    const errorCode = isFirestoreError ? (error as FirestoreError).code : null;
    const errorMessage = isGenericError ? error.message : "";
    if (errorCode === "unavailable" || errorMessage.includes("offline")) {
        logger.warn({ msg: 'Firestore offline, using defaults.' });
    } else {
        logger.error({ err: error, msg: 'Error loading profile' });
    }
    methods.reset(defaults);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          // Mark initial load as done after a tick so the watch subscription
          // doesn't fire for the reset() that just happened
          setTimeout(() => { initialLoadDone.current = true; }, 100);
        }
      }
    };

    loadProfile();

    return () => { cancelled = true; };
  }, [user, authLoading, methods]);

  // Watch all form changes and trigger debounced auto-save
  useEffect(() => {
    const subscription = methods.watch((value, { name }) => {
      // Don't auto-save during initial load
      if (!initialLoadDone.current) return;

      // Auto-generate slug when name changes
      if (name === "fullName" && value.fullName) {
        methods.setValue("slug", generateSlug(value.fullName as string));
      }

      debouncedSave();
    });
    return () => subscription.unsubscribe();
  }, [methods, debouncedSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  /**
   * Manual save handler that immediately triggers saveDraft.
   * Clears any pending debounce timer to ensure instant save.
   * @returns void (side effect: calls saveDraft immediately)
   */
  const saveProfile = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveDraft();
  }, [saveDraft]);

  /**
   * Publishes the actor profile, setting status to "published" and recording publishedAt timestamp.
   * Reverts to draft status if publish fails.
   * @returns void (side effects: updates profile status in Firestore and saveStatus state)
   * @async
   */
  const publishProfile = useCallback(async () => {
    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    methods.setValue("status", "published");
    setSaveStatus("saving");
    try {
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const { getDb } = await import("@/lib/firebase");
      const db = getDb();

      const formData = methods.getValues();
      await setDoc(
        doc(db, "actorProfiles", user.uid),
        {
          ...formData,
          status: "published",
          publishedAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
      setSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      logger.error({ err: error, msg: 'Error publishing profile' });
      alert("Failed to publish profile. Please try again.");
      methods.setValue("status", "draft");
      setSaveStatus("error");
    }
  }, [user, methods]);

  /**
   * Handles successful IMDB autofill by merging AI-generated data with existing form data.
   * AI data fills empty fields only, preserving user's existing values.
   * @param autofillData - Partial actor profile data from IMDB autofill
   * @returns void (side effects: resets form with merged data and triggers debouncedSave)
   */
  const handleAutofillSuccess = useCallback((autofillData: Partial<ActorProfile>) => {
    const currentValues = methods.getValues();

    // Start from ALL current values so no existing user-entered data is wiped.
    // Only fill a field with autofill data when the current value is empty/missing.
    const merged: Partial<ActorProfile> = {
      ...currentValues,
      // String fields: keep current non-empty value, else use autofill
      fullName: currentValues.fullName || autofillData.fullName || '',
      slug: currentValues.slug || autofillData.slug || '',
      bio: currentValues.bio || autofillData.bio || '',
      headshot: currentValues.headshot || autofillData.headshot || '',
      height: currentValues.height || autofillData.height || '',
      heightUnit: currentValues.heightUnit || autofillData.heightUnit || 'imperial',
      location: currentValues.location || autofillData.location || '',
      timezone: currentValues.timezone || autofillData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      gender: currentValues.gender || autofillData.gender || '',
      awardsCallout: currentValues.awardsCallout || autofillData.awardsCallout || '',
      // Array fields: keep current non-empty array, else use autofill; ensure defaults
      credits: (currentValues.credits && currentValues.credits.length > 0)
        ? currentValues.credits
        : (autofillData.credits ?? []),
      showreels: (currentValues.showreels && currentValues.showreels.length > 0)
        ? currentValues.showreels
        : (autofillData.showreels ?? []),
      additionalPhotos: (currentValues.additionalPhotos && currentValues.additionalPhotos.length > 0)
        ? currentValues.additionalPhotos
        : (autofillData.additionalPhotos ?? []),
      nationalities: (currentValues.nationalities && currentValues.nationalities.length > 0)
        ? currentValues.nationalities
        : (autofillData.nationalities ?? []),
      skillsAndAccents: (currentValues.skillsAndAccents && currentValues.skillsAndAccents.length > 0)
        ? currentValues.skillsAndAccents
        : (autofillData.skillsAndAccents ?? []),
      training: currentValues.training ?? autofillData.training ?? [],
      appearance: currentValues.appearance ?? autofillData.appearance ?? [],
      workPermits: currentValues.workPermits ?? autofillData.workPermits ?? [],
    };

    // Generate slug from name if still missing
    if (merged.fullName && !merged.slug) {
      merged.slug = generateSlug(merged.fullName);
    }

    // Update form with merged data
    methods.reset(merged);

    // Trigger save
    debouncedSave();
  }, [methods, debouncedSave]);

  if (isLoading) {
    return (
      <main className="flex flex-1 flex-col">
        <DashboardHeader title="My Profile" />
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="relative flex items-center justify-center mb-8">
            <div className="absolute w-24 h-24 border-2 border-[#E8721A] rounded-full animate-ping opacity-20" />
            <div className="absolute w-20 h-20 border-4 border-[#E8721A]/30 rounded-full animate-pulse" />
            <div className="relative z-10 bg-[#3D4A3C] p-4 rounded-full shadow-2xl">
              <Clapperboard className="w-8 h-8 text-[#E8721A]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-[#E8721A] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-[#6B6B6B] text-sm uppercase tracking-[0.2em] mt-4 font-medium h-5 transition-opacity duration-300">
            {loadingText}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="My Profile" />

      <div className="px-8 pb-8">
        <FormProvider {...methods}>
          <ProfileHeader
            onPublish={publishProfile}
            onSave={saveProfile}
            saveStatus={saveStatus}
          />

          <div className="flex gap-8">
            {/* Left column: Form */}
            <div className="flex-1 min-w-0">
              <ActorProfileForm onSave={saveProfile} saveStatus={saveStatus} />
            </div>

            {/* Right column: Live Preview */}
            <div className="hidden w-[280px] flex-shrink-0 lg:block">
              <div className="space-y-4">
                <ImdbAutofill onSuccess={handleAutofillSuccess} />
                <ProfileLivePreview />
              </div>
            </div>
          </div>
        </FormProvider>
      </div>
    </main>
  );
}
