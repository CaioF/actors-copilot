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
import {
  ActorProfile,
  actorProfileSchema,
  defaultActorProfile,
  generateSlug,
} from "@/lib/profile-types";
import { useAuth } from "@/lib/context/AuthContext";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

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

  // Core save function — used by auto-save, manual save, and publish
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
      console.error("Error saving profile:", error);
      setSaveStatus("error");
    }
  }, [user, methods]);

  // Debounced auto-save: triggers 2s after the last form change
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
      } catch (error: any) {
        if (cancelled) return;
        if (error?.code === "unavailable" || error?.message?.includes("offline")) {
          console.warn("Firestore offline, using defaults.");
        } else {
          console.error("Error loading profile:", error);
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

  // Manual save (flushes any pending debounce)
  const saveProfile = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveDraft();
  }, [saveDraft]);

  // Publish
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
      console.error("Error publishing profile:", error);
      alert("Failed to publish profile. Please try again.");
      methods.setValue("status", "draft");
      setSaveStatus("error");
    }
  }, [user, methods]);

  // Handle IMDB autofill success - merge AI data with existing form data
  // AI data fills empty fields only, preserving user input
  const handleAutofillSuccess = useCallback((autofillData: Partial<ActorProfile>) => {
    const currentValues = methods.getValues();

    // Build merge: existing values take priority, AI data fills empty
    // Ensure array fields have defaults to prevent crashes during render
    const merged: Partial<ActorProfile> = {
      additionalPhotos: [],
      credits: [],
      showreels: [],
      training: [],
      skillsAndAccents: [],
      nationalities: [],
      appearance: [],
      workPermits: [],
      ...autofillData,
    };

    // Preserve user's non-empty values over AI data
    if (currentValues.fullName) {
      merged.fullName = currentValues.fullName;
    }
    if (currentValues.slug) {
      merged.slug = currentValues.slug;
    }
    if (currentValues.bio) {
      merged.bio = currentValues.bio;
    }
    if (currentValues.headshot) {
      merged.headshot = currentValues.headshot;
    }
    if (currentValues.height) {
      merged.height = currentValues.height;
    }
    if (currentValues.location) {
      merged.location = currentValues.location;
    }
    if (currentValues.credits && currentValues.credits.length > 0) {
      merged.credits = currentValues.credits;
    }
    if (currentValues.showreels && currentValues.showreels.length > 0) {
      merged.showreels = currentValues.showreels;
    }

    // Preserve slug generation from name if name was filled
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
