"use client";

import { useState, useEffect, useRef } from "react";
import { 
  User, 
  Shield, 
  AlertTriangle, 
  Mail, 
  Trash2, 
  Camera, 
  Save, 
  Lock, 
  Check 
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/context/AuthContext";
import { collection, getDocs, doc, writeBatch, deleteDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { logger } from "@/lib/logger";

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

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  variant = "default",
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  variant?: "default" | "danger";
}) {
  const isDanger = variant === "danger";

  return (
    <div
      className={`flex items-center gap-3.5 rounded-t-3xl px-6 py-4 transition-colors ${
        isDanger
          ? "bg-primary text-primary-foreground"
          : "bg-neutral-900 text-white dark:bg-neutral-800"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div>
        <h3 className="font-title text-base font-bold tracking-tight">{title}</h3>
        <p className={`text-xs ${isDanger ? "text-primary-foreground/80" : "text-neutral-400"}`}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, sendPasswordReset } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      setPhotoURL(user.photoURL || "");
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const { getAuth, updateProfile } = await import("firebase/auth");
      const auth = getAuth();

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName,
        });
      }
    } catch (error) {
      logger.error({ err: error, msg: "Error updating profile" });
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) return;
    setIsResettingPassword(true);
    try {
      await sendPasswordReset(email);
      alert(`A password reset email has been sent to ${email}.`);
    } catch (error) {
      logger.error({ err: error, msg: "Error sending password reset" });
      alert("Failed to send password reset email. Please try again.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large. Please select an image under 2MB.");
      return;
    }

    setIsSaving(true);
    try {
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { getApp } = await import("@/lib/firebase");
      const { getAuth, updateProfile } = await import("firebase/auth");

      const storage = getStorage(getApp());

      let fileExtension: string | undefined;
      const nameParts = file.name.split(".");
      if (nameParts.length > 1 && nameParts[nameParts.length - 1]) {
        fileExtension = nameParts[nameParts.length - 1].toLowerCase();
      } else if (file.type && file.type.includes("/")) {
        fileExtension = file.type.split("/").pop() || undefined;
      }
      if (!fileExtension) {
        fileExtension = "jpg";
      }
      const storageRef = ref(storage, `avatars/${user.uid}.${fileExtension}`);

      const contentType =
        file.type && file.type.trim().length > 0
          ? file.type
          : fileExtension === "jpg" || fileExtension === "jpeg"
          ? "image/jpeg"
          : `image/${fileExtension}`;
      await uploadBytes(storageRef, file, { contentType });

      const downloadURL = await getDownloadURL(storageRef);

      const auth = getAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
        setPhotoURL(downloadURL);
      }
    } catch (error) {
      logger.error({ err: error, msg: "Error uploading image" });
      alert("Failed to upload image. Make sure Firebase Storage is enabled in your console.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChatData = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    setIsDeletingChat(true);

    try {
      const db = getDb();
      const firstName = user.displayName ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "Actor";
      const userPath = `${user.uid}_${firstName}`;

      const batch = writeBatch(db);
      let operationsCount = 0;

      const sessionsRef = collection(db, `users/${userPath}/dnaSessions`);
      const sessionDocs = await getDocs(sessionsRef).catch((err) => {
        logger.error({ err, msg: "Failed to check sessions" });
        throw err;
      });

      for (const sessionDoc of sessionDocs.docs) {
        const messagesRef = collection(db, `users/${userPath}/dnaSessions/${sessionDoc.id}/messages`);
        const messagesSnap = await getDocs(messagesRef);

        messagesSnap.docs.forEach((msgDoc) => {
          batch.delete(doc(db, `users/${userPath}/dnaSessions/${sessionDoc.id}/messages`, msgDoc.id));
          operationsCount++;
        });

        batch.delete(doc(db, `users/${userPath}/dnaSessions`, sessionDoc.id));
        operationsCount++;
      }

      const coachSessionsRef = collection(db, `users/${userPath}/coachSessions`);
      const coachSessionDocs = await getDocs(coachSessionsRef).catch((err) => {
        logger.error({ err, msg: "Failed to check coach sessions" });
        throw err;
      });

      for (const coachSessionDoc of coachSessionDocs.docs) {
        const coachMessagesRef = collection(db, `users/${userPath}/coachSessions/${coachSessionDoc.id}/messages`);
        const coachMessagesSnap = await getDocs(coachMessagesRef);

        coachMessagesSnap.docs.forEach((msgDoc) => {
          batch.delete(doc(db, `users/${userPath}/coachSessions/${coachSessionDoc.id}/messages`, msgDoc.id));
          operationsCount++;
        });

        batch.delete(doc(db, `users/${userPath}/coachSessions`, coachSessionDoc.id));
        operationsCount++;
      }

      const profileRef = doc(db, `users/${userPath}/profile/master`);
      batch.delete(profileRef);
      operationsCount++;

      if (operationsCount > 0) {
        await batch.commit();
      }

      alert("Chat data and DNA profile successfully deleted.");
      window.location.reload();
    } catch (error) {
      logger.error({ err: error, msg: "Failed to delete chat data" });
      alert("Failed to delete chat data.");
      setIsDeletingChat(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmFinal = window.confirm(
      "Are you absolutely sure? This will permanently delete your profile, auditions, breakdowns, and account. This cannot be undone."
    );
    if (!confirmFinal) return;

    setIsDeletingAccount(true);
    try {
      const firstName = user.displayName ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "Actor";
      const userPath = `${user.uid}_${firstName}`;

      const { getFirestore, collection, getDocs, doc, writeBatch } = await import("firebase/firestore");
      const { getApp } = await import("@/lib/firebase");
      const db = getFirestore(getApp());

      const batch = writeBatch(db);

      const dnaSessionsRef = collection(db, `users/${userPath}/dnaSessions`);
      const dnaSessionDocs = await getDocs(dnaSessionsRef);
      for (const sessionDoc of dnaSessionDocs.docs) {
        const messagesRef = collection(db, `users/${userPath}/dnaSessions/${sessionDoc.id}/messages`);
        const messagesSnap = await getDocs(messagesRef);
        messagesSnap.docs.forEach((msgDoc) => {
          batch.delete(doc(db, `users/${userPath}/dnaSessions/${sessionDoc.id}/messages`, msgDoc.id));
        });
        batch.delete(doc(db, `users/${userPath}/dnaSessions`, sessionDoc.id));
      }

      const coachSessionsRef = collection(db, `users/${userPath}/coachSessions`);
      const coachSessionDocs = await getDocs(coachSessionsRef);
      for (const sessionDoc of coachSessionDocs.docs) {
        const messagesRef = collection(db, `users/${userPath}/coachSessions/${sessionDoc.id}/messages`);
        const messagesSnap = await getDocs(messagesRef);
        messagesSnap.docs.forEach((msgDoc) => {
          batch.delete(doc(db, `users/${userPath}/coachSessions/${sessionDoc.id}/messages`, msgDoc.id));
        });
        batch.delete(doc(db, `users/${userPath}/coachSessions`, sessionDoc.id));
      }

      const vaultDocs = await getDocs(collection(db, `users/${userPath}/dnaVault`));
      vaultDocs.docs.forEach((d) => batch.delete(doc(db, `users/${userPath}/dnaVault`, d.id)));

      const auditionDocs = await getDocs(collection(db, `users/${userPath}/auditions`));
      auditionDocs.docs.forEach((d) => batch.delete(doc(db, `users/${userPath}/auditions`, d.id)));

      batch.delete(doc(db, `users/${userPath}/profile/master`));
      batch.delete(doc(db, `users/${userPath}`));

      await batch.commit();

      if (user.photoURL && user.photoURL.includes("firebasestorage")) {
        try {
          const { getStorage, ref, deleteObject } = await import("firebase/storage");
          const storage = getStorage(getApp());
          const avatarRef = ref(storage, user.photoURL);
          await deleteObject(avatarRef);
        } catch (storageError) {
          logger.warn({ msg: "Avatar not found or already deleted, moving on." });
        }
      }

      const { getAuth, deleteUser } = await import("firebase/auth");
      const auth = getAuth();

      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
    } catch (error: unknown) {
      logger.error({ err: error, msg: "Error deleting account" });
      if (isFirebaseError(error)) {
        if (error.code === "auth/requires-recent-login") {
          alert("For security reasons, you need to verify your identity. Please log out, log back in, and try again.");
          return;
        }
      }
      alert("Failed to delete account. Please try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteProfile = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    const confirmFinal = window.confirm(
      "Are you absolutely sure? This will erase your public profile (bio, credits, physical details) to start from scratch."
    );
    if (!confirmFinal) return;

    setIsDeletingProfile(true);

    try {
      const db = getDb();
      const profileRef = doc(db, "actorProfiles", user.uid);
      await deleteDoc(profileRef);

      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logger.error({ err: error, msg: "Failure during public profile hard-reset" });
      alert("Failed to reset profile. Please try again.");
    } finally {
      setIsDeletingProfile(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background text-foreground transition-colors pb-16">
      <DashboardHeader title="Settings" />

      <div className="px-4 sm:px-8 py-6 max-w-5xl mx-auto w-full space-y-8">
        {/* Page Title */}
        <div>
          <h2 className="font-title text-3xl font-bold text-foreground">Manage User Settings</h2>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-8">
          
          {/* SECTION 1: PROFILE */}
          <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden transition-colors">
            <SectionHeader icon={User} title="Profile" subtitle="Your account details" />
            
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                
                {/* Left Side: Avatar & Description */}
                <div className="md:col-span-5 flex flex-col items-center sm:items-start text-center sm:text-left space-y-4">
                  <div className="relative group flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted">
                    {photoURL ? (
                      <img src={photoURL} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 text-muted-foreground" />
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity disabled:opacity-50"
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-title font-bold text-foreground text-sm sm:text-base">Profile Picture</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                      PNG, JPG up to 2MB. This will be visible on your master profile.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving}
                      className="text-xs font-bold text-primary hover:underline disabled:opacity-50 pt-1 block"
                    >
                      {isSaving ? "Uploading..." : "Change photo"}
                    </button>
                  </div>
                </div>

                {/* Right Side: Inputs & Actions */}
                <div className="md:col-span-7 space-y-5">
                  {/* Display Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">Display Name</label>
                    <div className="flex items-center rounded-2xl border border-border bg-card px-3.5 py-2.5 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                      <User className="h-4 w-4 text-muted-foreground shrink-0 mr-2.5" />
                      <input
                        type="text"
                        placeholder="e.g., Viola Davis"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                      />
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">Email address</label>
                    <div className="flex items-center rounded-2xl border border-border bg-card px-3.5 py-2.5 opacity-70 cursor-not-allowed">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0 mr-2.5" />
                      <input
                        type="email"
                        placeholder="actor@email.com"
                        value={email}
                        disabled
                        className="w-full bg-transparent text-xs sm:text-sm text-foreground cursor-not-allowed outline-none"
                      />
                    </div>
                  </div>

                  {/* Secondary Action: Change Password */}
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword}
                    className="w-full py-2.5 px-4 rounded-full border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span>{isResettingPassword ? "Sending reset link..." : "Change password"}</span>
                  </button>

                  {/* Primary Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="w-full py-3 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-70"
                  >
                    <Save className="h-4 w-4" />
                    <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* SECTION 2: PRIVACY & DATA */}
          <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden transition-colors">
            <SectionHeader icon={Shield} title="Privacy & Data" subtitle="How we handle your data" />
            
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-3">
                <Check className="h-4 w-4 text-primary shrink-0 mt-1" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-foreground text-xs sm:text-sm">Privacy by default</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Your data belongs to you. We don't sell your information, share it with third parties, or use it to train AI models. Your audition sides, Personal DNA, and all content remain completely private.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="h-4 w-4 text-primary shrink-0 mt-1" />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-foreground text-xs sm:text-sm">Full control</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Export your data anytime. Delete individual items or your entire account. We make it easy to maintain control over your creative work.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DANGER ZONE */}
          <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden transition-colors">
            <SectionHeader icon={AlertTriangle} title="Danger Zone" subtitle="Permanent actions" variant="danger" />
            
            <div className="divide-y divide-border">
              {/* Delete Chat Data */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/50">
                    <Trash2 className="h-5 w-5 text-destructive shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-destructive">Delete chat data</p>
                      <p className="text-xs text-muted-foreground">Permanently delete your chat data at any time</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-title text-foreground">Delete Chat Data</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-xs sm:text-sm">
                      This will permanently delete all your chat data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border text-foreground hover:bg-muted">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteChatData}
                      disabled={isDeletingChat}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeletingChat ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete Profile */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/50">
                    <Trash2 className="h-5 w-5 text-destructive shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-destructive">Delete profile</p>
                      <p className="text-xs text-muted-foreground">Permanently erase your actor profile to start from scratch</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-title text-foreground">Delete Profile</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-xs sm:text-sm">
                      This will permanently delete your public profile data (bio, credits, physical details, etc.). This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border text-foreground hover:bg-muted">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteProfile}
                      disabled={isDeletingProfile}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeletingProfile ? "Deleting..." : "Delete Profile"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete Account */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-muted/50">
                    <Trash2 className="h-5 w-5 text-destructive shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-destructive">Delete account</p>
                      <p className="text-xs text-muted-foreground">Permanently delete all your data. You'll have to start everything from scratch.</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-title text-foreground">Delete Account</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground text-xs sm:text-sm">
                      This will permanently delete all your data. You will not lose access to your account but will lose all your information. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-border text-foreground hover:bg-muted">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeletingAccount ? "Deleting..." : "Delete Account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

            </div>
          </div>

        </div>

        {/* Disclaimer */}
        <p className="pt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Disclaimer: The Actors Copilot is a creative tool designed to assist with audition preparation.
          It is not a substitute for professional acting, coaching, therapy, or medical advice.
        </p>

      </div>
    </main>
  );
}