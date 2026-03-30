"use client"

import { useState, useEffect, useRef } from "react"
import { User, Bell, Shield, AlertTriangle, Mail, Trash2, Camera, Save } from "lucide-react"
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
        <h3 className="font-serif text-base font-bold text-[#F5F0E8]">{title}</h3>
        <p className="text-xs text-[#F5F0E8]/60">{subtitle}</p>
      </div>
    </div>
  )
}

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
      console.error("Error updating profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // 4. HANDLE IMAGE UPLOAD: Uploads to Firebase Storage and updates Auth Profile
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
      const fileExtension = file.name.split('.').pop();
      const storageRef = ref(storage, `avatars/${user.uid}.${fileExtension}`);
      
      // Upload the file
      await uploadBytes(storageRef, file);
      // Get the public URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firebase Auth with the new photo URL
      const auth = getAuth();
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
        setPhotoURL(downloadURL); // Update UI immediately
      }

    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image. Make sure Firebase Storage is enabled in your console.");
    } finally {
      setIsSaving(false);
    }
  };

  // 5. DELETE CHAT DATA: Wipes out the user's sessions and vault in Firestore
  const handleDeleteChatData = async () => {
    if (!user) return;
    setIsDeletingChat(true);
    try {
      const { getFirestore, collection, getDocs, deleteDoc, doc } = await import("firebase/firestore");
      const { getApp } = await import("@/lib/firebase");
      const db = getFirestore(getApp());

      // Construct the exact same userPath you use in use-chat.ts
      const firstName = user.displayName ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") : "Actor";
      const userPath = `${user.uid}_${firstName}`;

      // Fetch and delete all active sessions
      const sessionsRef = collection(db, `users/${userPath}/dnaSessions`);
      const sessionDocs = await getDocs(sessionsRef);
      const deleteSessions = sessionDocs.docs.map(d => deleteDoc(doc(db, `users/${userPath}/dnaSessions`, d.id)));
      
      // Fetch and delete all saved vault extractions
      const vaultRef = collection(db, `users/${userPath}/dnaVault`);
      const vaultDocs = await getDocs(vaultRef);
      const deleteVault = vaultDocs.docs.map(d => deleteDoc(doc(db, `users/${userPath}/dnaVault`, d.id)));

      // Wait for all deletions to finish
      await Promise.all([...deleteSessions, ...deleteVault]);
      
      alert("Chat data successfully deleted.");
    } catch (error) {
      console.error("Error deleting chat data:", error);
      alert("Failed to delete chat data. Please try again.");
    } finally {
      setIsDeletingChat(false);
    }
  };

  // 6. DELETE ACCOUNT: Removes the user from Firebase Auth
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Extra safety confirmation before making the API call
    const confirmFinal = window.confirm("Are you absolutely sure? This cannot be undone.");
    if (!confirmFinal) return;

    setIsDeletingAccount(true);
    try {
      const { getAuth, deleteUser } = await import("firebase/auth");
      const auth = getAuth();
      
      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
        alert("Account successfully deleted. We're sorry to see you go!");
      }
    } catch (error: any) {
      console.error("Error deleting account:", error);
      // FIREBASE SECURITY PROTOCOL: Requires recent login for destructive actions
      if (error.code === 'auth/requires-recent-login') {
        alert("For security reasons, you need to verify your identity. Please log out, log back in, and try again.");
      } else {
        alert("Failed to delete account. Please try again.");
      }
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
          <h2 className="font-serif text-2xl font-bold text-[#2C3328]">Manage User Settings</h2>
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
                  {"Your data belongs to you. We don't sell your information, share it with third parties, or use it to train AI models. Your audition slides, personal DNA, and all content remain completely private."}
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
                      <p className="text-xs text-[#6B6B6B]">Permanently delete your chat data</p>
                    </div>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#F0E8DC] border-[#C7C0B5]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif text-[#2C3328]">Delete Chat Data</AlertDialogTitle>
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
                    <AlertDialogTitle className="font-serif text-[#2C3328]">Delete Account</AlertDialogTitle>
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
