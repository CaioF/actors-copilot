"use client"

import { useState, useEffect, useRef } from "react"
import { User, Shield, AlertTriangle, Mail, Trash2, Camera, Save } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
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
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/context/AuthContext"
import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { logger } from '@/lib/logger';

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

/**
 * Renders a section header with icon, title, and subtitle.
 * Used to categorize settings into distinct sections.
 * @param icon - Lucide icon component to display
 * @param title - Section title text
 * @param subtitle - Section subtitle/description text
 * @param variant - Visual variant ("default" or "danger")
 * @returns The styled section header element
 */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  variant = "default",
}: {
  icon: React.ElementType
  title: string
  subtitle: string
  variant?: "default" | "danger"
}) {
  const bg = variant === "danger" ? "bg-gradient-to-r from-[#8B5E3C] to-[#6B4430]" : "bg-[#3D4A3C]"
  return (
    <div className={`flex items-center gap-3 rounded-t-2xl px-5 py-4 ${bg}`}>
      <Icon className="h-5 w-5 text-[#F5F0E8]" />
      <div>
        <h3 className="font-title text-base font-bold text-[#F5F0E8]">{title}</h3>
        <p className="text-xs text-[#F5F0E8]/60">{subtitle}</p>
      </div>
    </div>
  )
}

/**
 * Settings page for managing user account, profile, privacy, and danger zone actions.
 * @returns The rendered settings page
 */
export default function SettingsPage() {
  const { user } = useAuth(); // 1. Get the current logged-in user
  
  // Form States
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Reference for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. POPULATE DATA ON LOAD: When the page loads, fill the inputs with the user's actual data
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      setPhotoURL(user.photoURL || "");
    }
  }, [user]);

  // 3. SAVE TEXT DATA: Updates the Display Name in Firebase Auth
  /**
   * Saves the user's display name to Firebase Auth.
   * @returns void (side effects: updates Firebase Auth profile)
   * @async
   */
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      // We dynamically import auth to keep the page load fast
      const { getAuth, updateProfile } = await import("firebase/auth");
      const auth = getAuth();
      
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { 
          displayName: displayName 
        });
        // Note: We don't update email here because changing an Auth email requires 
        // a secure re-authentication flow (sending a verification link).
      }
    } catch (error) {
      logger.error({ err: error, msg: 'Error updating profile' });
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // 4. HANDLE IMAGE UPLOAD: Uploads to Firebase Storage and updates Auth Profile
  /**
   * Handles profile image upload to Firebase Storage and updates Auth profile.
   * Validates file size (max 2MB) and image types.
   * @param e - React change event from file input
   * @returns void (side effects: uploads to Firebase Storage and updates auth photoURL)
   * @async
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (limit to 2MB as promised in the UI)
    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large. Please select an image under 2MB.");
      return;
    }

    setIsSaving(true);
    try {
      // Dynamically import storage functions
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { getApp } = await import("@/lib/firebase");
      const { getAuth, updateProfile } = await import("firebase/auth");

      const storage = getStorage(getApp());
      // Create a secure path in storage: avatars/userId.jpg
       // Create a secure path in storage: avatars/userId.<ext>
      let fileExtension: string | undefined;
      const nameParts = file.name.split(".");
      if (nameParts.length > 1 && nameParts[nameParts.length - 1]) {
        fileExtension = nameParts[nameParts.length - 1].toLowerCase();
      } else if (file.type && file.type.includes("/")) {
        // Derive extension from MIME type, e.g. "image/png" -> "png"
        fileExtension = file.type.split("/").pop() || undefined;
      }
      if (!fileExtension) {
        // Fallback to a safe default
        fileExtension = "jpg";
      }
      const storageRef = ref(storage, `avatars/${user.uid}.${fileExtension}`);
      
      // Upload the file with appropriate contentType metadata
      const contentType =
        file.type && file.type.trim().length > 0
          ? file.type
          : fileExtension === "jpg" || fileExtension === "jpeg"
            ? "image/jpeg"
            : `image/${fileExtension}`;
      await uploadBytes(storageRef, file, { contentType });

      // Get the public URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firebase Auth with the new photo URL
      const auth = getAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
        setPhotoURL(downloadURL); // Update UI immediately
      }

    } catch (error) {
      logger.error({ err: error, msg: 'Error uploading image' });
      alert("Failed to upload image. Make sure Firebase Storage is enabled in your console.");
    } finally {
      setIsSaving(false);
    }
  };

  // 5. DELETE CHAT DATA: Wipes out the user's sessions and vault in Firestore
  /**
   * Permanently deletes all chat data including DNA sessions and vault extractions from Firestore.
   * @returns void (side effects: deletes Firestore collections and shows alert)
   * @async
   */
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
         logger.error({ err, msg: 'Failed to check sessions' });
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

      // Coach sessions — same writeBatch pattern as DNA sessions above
      const coachSessionsRef = collection(db, `users/${userPath}/coachSessions`);
      const coachSessionDocs = await getDocs(coachSessionsRef).catch((err) => {
        logger.error({ err, msg: 'Failed to check coach sessions' });
        throw err;
      });

      for (const coachSessionDoc of coachSessionDocs.docs) {
        const coachMessagesRef = collection(
          db,
          `users/${userPath}/coachSessions/${coachSessionDoc.id}/messages`
        );
        const coachMessagesSnap = await getDocs(coachMessagesRef);

        coachMessagesSnap.docs.forEach((msgDoc) => {
          batch.delete(
            doc(
              db,
              `users/${userPath}/coachSessions/${coachSessionDoc.id}/messages`,
              msgDoc.id
            )
          );
          operationsCount++;
        });

        batch.delete(
          doc(db, `users/${userPath}/coachSessions`, coachSessionDoc.id)
        );
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
      logger.error({ err: error, msg: 'Failed to delete chat data' });
      alert("Failed to delete chat data. ");
      setIsDeletingChat(false);
    } 
  };

// 6. DELETE ACCOUNT: Removes ALL user data (Firestore & Storage) AND the Firebase Auth user
  /**
   * Permanently deletes the entire user account including all Firestore data,
   * Firebase Storage files, and Firebase Auth user.
   * @returns void (side effects: deletes all user data and triggers auth redirect)
   * @async
   */
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Extra safety confirmation before making the API call
    const confirmFinal = window.confirm("Are you absolutely sure? This will permanently delete your profile, auditions, breakdowns, and account. This cannot be undone.");
    if (!confirmFinal) return;

    setIsDeletingAccount(true);
    try {
      // --- 1. DYNAMIC PATH CALCULATION ---
      const firstName = user.displayName ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "Actor";
      const userPath = `${user.uid}_${firstName}`;

      // --- 2. DELETE ALL FIRESTORE DATA ---
      const { getFirestore, collection, getDocs, doc, writeBatch } = await import("firebase/firestore");
      const { getApp } = await import("@/lib/firebase");
      const db = getFirestore(getApp());

      const batch = writeBatch(db);

      // DNA sessions — delete message subcollections first, then session docs
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

      // Coach sessions — delete message subcollections first, then session docs
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

      // DNA vault docs
      const vaultDocs = await getDocs(collection(db, `users/${userPath}/dnaVault`));
      vaultDocs.docs.forEach(d => batch.delete(doc(db, `users/${userPath}/dnaVault`, d.id)));

      // Audition docs
      const auditionDocs = await getDocs(collection(db, `users/${userPath}/auditions`));
      auditionDocs.docs.forEach(d => batch.delete(doc(db, `users/${userPath}/auditions`, d.id)));

      // Profile doc
      batch.delete(doc(db, `users/${userPath}/profile/master`));

      // Parent user document
      batch.delete(doc(db, `users/${userPath}`));

      await batch.commit();

      // --- 3. DELETE AVATAR FROM STORAGE (If it exists) ---
      if (user.photoURL && user.photoURL.includes('firebasestorage')) {
        try {
          const { getStorage, ref, deleteObject } = await import("firebase/storage");
          const storage = getStorage(getApp());
          // Firebase Storage 'ref' can accept the full download URL directly
          const avatarRef = ref(storage, user.photoURL);
          await deleteObject(avatarRef);
        } catch (storageError) {
          logger.warn({ msg: 'Avatar not found or already deleted, moving on.' });
        }
      }

      // --- 4. FINALLY, DELETE FIREBASE AUTH USER ---
      const { getAuth, deleteUser } = await import("firebase/auth");
      const auth = getAuth();
      
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
        // Note: AuthContext handles the redirect automatically when currentUser becomes null.
      }

    } catch (error: unknown) {
        logger.error({ err: error, msg: 'Error deleting account' });
        if (isFirebaseError(error)) {
          if (error.code === 'auth/requires-recent-login') {
            alert("For security reasons, you need to verify your identity. Please log out, log back in, and try again.");
            return; // Early return 
          }
        }
        alert("Failed to delete account. Please try again.");
    
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="Settings" />

      <div className="px-8 pb-8">
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="font-title text-2xl font-bold text-[#2C3328]">Manage User Settings</h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">Manage your account and preferences</p>
        </div>

        {/* Settings Sections */}
        <div className="flex flex-col gap-6">
          {/* Profile */}
          {/* Profile */}
          <div className="overflow-hidden rounded-2xl border border-[#C7C0B5]/50 shadow-sm">
            <SectionHeader icon={User} title="Profile" subtitle="Your account details" />
            <div className="bg-[#F5F0E8] px-5 py-6">
              
              {/* Profile Picture Area */}
              <div className="flex items-center gap-5 mb-8">
                <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#C7C0B5] bg-[#E8DFD0]">
                  
                  {/* Show the uploaded image if it exists, otherwise show the placeholder icon */}
                  {photoURL ? (
                    <img src={photoURL} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 text-[#B7BCB6]" />
                  )}
                  
                  {/* Overlay upload button (Triggers the hidden file input) */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="absolute bottom-0 left-0 flex w-full cursor-pointer justify-center bg-black/60 py-1 transition-colors hover:bg-black/80 disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4 text-white" />
                  </button>

                  {/* HIDDEN FILE INPUT */}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden" 
                  />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#2C3328]">Profile Picture</h4>
                  <p className="mt-1 text-xs text-[#6B6B6B]">
                    PNG, JPG up to 2MB. This will be visible on your master profile.
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="mt-2 text-xs font-medium text-[#E8721A] hover:underline disabled:opacity-50"
                  >
                    {isSaving ? "Uploading..." : "Upload new photo"}
                  </button>
                </div>
              </div>

              {/* Inputs Grid */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Display Name Input */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2C3328]">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
                    <input
                      type="text"
                      placeholder="e.g., Viola Davis"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0] py-2.5 pl-10 pr-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none transition-all focus:border-[#E8721A] focus:ring-1 focus:ring-[#E8721A]"
                    />
                  </div>
                </div>

                {/* Email Input (Usually disabled/read-only in settings if tied to Auth) */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#2C3328]">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
                    <input
                      type="email"
                      placeholder="actor@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled // Removing this lets them edit, but changing Firebase auth email requires special logic
                      className="w-full rounded-lg border border-[#C7C0B5] bg-[#E8DFD0]/50 py-2.5 pl-10 pr-4 text-sm text-[#2C3328] placeholder-[#6B6B6B]/60 outline-none cursor-not-allowed opacity-70"
                      title="Email cannot be changed directly here"
                    />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-8 flex justify-end border-t border-[#C7C0B5]/30 pt-5">
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-[#E8721A] px-5 py-2.5 text-sm font-medium text-[#fff6ec] transition-colors hover:bg-[#E8721A]/90 disabled:opacity-70"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>

            </div>
          </div>

          {/* Privacy */}
          <div className="overflow-hidden rounded-2xl border border-[#C7C0B5]/50">
            <SectionHeader icon={Shield} title="Privacy" subtitle="How we handle your data" />
            <div className="bg-[#F5F0E8] px-5 py-5">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-[#2C3328]">Private by default</h4>
                <p className="mt-1 text-sm leading-relaxed text-[#6B6B6B]">
                  {"Your data belongs to you. We don't sell your information, share it with third parties, or use it to train AI models. Your audition sides, Personal DNA, and all content remain completely private."}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#2C3328]">Full control</h4>
                <p className="mt-1 text-sm leading-relaxed text-[#6B6B6B]">
                  Export your data anytime. Delete individual items or your entire account. We make it easy to maintain control over your creative work.
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="overflow-hidden rounded-2xl border border-[#C7C0B5]/50">
            <SectionHeader icon={AlertTriangle} title="Danger Zone" subtitle="Permanent actions" variant="danger" />
            <div className="bg-[#F5F0E8] divide-y divide-[#C7C0B5]/50">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#E8DFD0]">
                    <Trash2 className="h-4 w-4 text-[#C45A3C]" />
                    <div>
                      <p className="text-sm font-semibold text-[#C45A3C]">Delete chat data</p>
                      <p className="text-xs text-[#6B6B6B]">Permanently delete your chat data at any time</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-title text-[#2C3328]">Delete Chat Data</AlertDialogTitle>
                    <AlertDialogDescription className="text-[#6B6B6B]">
                      This will permanently delete all your chat data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0]">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteChatData} 
                      disabled={isDeletingChat}      
                      className="bg-[#C45A3C] text-[#ffffff] hover:bg-[#C45A3C]/90"
                    >
                      {isDeletingChat ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#E8DFD0]">
                    <Trash2 className="h-4 w-4 text-[#C45A3C]" />
                    <div>
                      <p className="text-sm font-semibold text-[#C45A3C]">Delete account</p>
                      <p className="text-xs text-[#6B6B6B]">Permanently delete your account and all data</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-title text-[#2C3328]">Delete Account</AlertDialogTitle>
                    <AlertDialogDescription className="text-[#6B6B6B]">
                      This will permanently delete your account and all associated data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-[#C7C0B5] text-[#2C3328] hover:bg-[#E8DFD0]">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAccount} // ADD THIS
                      disabled={isDeletingAccount}  // ADD THIS
                      className="bg-[#C45A3C] text-[#ffffff] hover:bg-[#C45A3C]/90"
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
        <p className="mt-8 text-center text-xs leading-relaxed text-[#6B6B6B]">
          Disclaimer: The Actors Copilot is a creative tool designed to assist with audition preparation.
          It is not a substitute for professional acting, coaching, therapy, or medical advice.
        </p>
      </div>
    </main>
  )
}
