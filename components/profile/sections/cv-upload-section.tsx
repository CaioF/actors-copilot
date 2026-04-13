"use client";

import { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Upload, X } from "lucide-react";
import { ActorProfile } from "@/lib/profile-types";
import { useAuth } from "@/lib/context/AuthContext";

/**
 * Form section for uploading and managing actor CV/resume as a PDF file.
 * Supports drag-and-drop upload with file validation.
 */
export function CvUploadSection() {
  const { user } = useAuth();
  const { watch, setValue } = useFormContext<ActorProfile>();
  const cvFilename = watch("cvFilename");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Uploads a CV PDF file to Firebase storage with validation (PDF only, max 100MB).
   * @param file - The PDF file to upload
   */
  const uploadCv = async (file: File) => {
    if (!user) return;
    if (file.size > 100 * 1024 * 1024) {
      alert("File is too large. Maximum size is 100MB.");
      return;
    }
    if (file.type !== "application/pdf") {
      alert("Only PDF files are accepted.");
      return;
    }
    setUploading(true);
    try {
      const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { getApp } = await import("@/lib/firebase");
      const storage = getStorage(getApp());
      const storageRef = ref(storage, `profiles/${user.uid}/cv.pdf`);
      await uploadBytes(storageRef, file, { contentType: "application/pdf" });
      const url = await getDownloadURL(storageRef);
      setValue("cvUrl", url, { shouldDirty: true });
      setValue("cvFilename", file.name, { shouldDirty: true });
    } catch (error) {
      console.error("Error uploading CV:", error);
      alert("Failed to upload CV.");
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handles file input change events to trigger CV upload.
   * @param e - The change event from the file input
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadCv(file);
  };

  /**
   * Handles drag-and-drop events for CV file upload.
   * @param e - The drag event containing the dropped file
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadCv(file);
  };

  /**
   * Removes the uploaded CV from the profile.
   */
  const removeCv = () => {
    setValue("cvUrl", null, { shouldDirty: true });
    setValue("cvFilename", null, { shouldDirty: true });
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">CV Upload</h3>

      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
          isDragging
            ? "border-[#E8721A] bg-[#E8721A]/5"
            : "border-[#C7C0B5] bg-[#F0E9DE]"
        }`}
      >
        <Upload className="mb-3 h-8 w-8 text-[#6B6B6B]" />
        <p className="text-sm font-medium text-[#2C3328]">
          {uploading ? "Uploading..." : "Drag & drop your PDF"}
        </p>
        <p className="mt-1 text-xs text-[#6B6B6B]">or click to browse</p>
        <p className="mt-1 text-xs text-[#6B6B6B]">Max file size: 100MB</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Uploaded File Display */}
      {cvFilename && (
        <div className="flex items-center gap-3 rounded-lg bg-[#F0E9DE] px-4 py-2.5">
          <span className="flex-1 text-sm text-[#6B6B6B]">{cvFilename}</span>
          <button
            type="button"
            onClick={removeCv}
            className="text-[#6B6B6B] transition-colors hover:text-[#C45A3C]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
