"use client";

import { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { ActorProfile } from "@/lib/profile-types";
import { useAuth } from "@/lib/context/AuthContext";

/**
 * Form section for managing actor photos including primary headshot and additional gallery images.
 * Supports uploading images to Firebase storage with drag-and-drop functionality.
 */
export function PhotosSection() {
  const { user } = useAuth();
  const { watch, setValue } = useFormContext<ActorProfile>();
  const headshot = watch("headshot");
  const additionalPhotos = watch("additionalPhotos");
  const headshotInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  /**
   * Uploads an image file to Firebase storage and returns the download URL.
   * @param file - The image file to upload
   * @param path - The storage path for the file
   * @returns The download URL of the uploaded image
   */
  const uploadImage = async (file: File, path: string): Promise<string> => {
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
    const { getApp } = await import("@/lib/firebase");
    const storage = getStorage(getApp());
    const storageRef = ref(storage, path);
    const contentType = file.type || "image/jpeg";
    await uploadBytes(storageRef, file, { contentType });
    return getDownloadURL(storageRef);
  };

  /**
   * Handles the headshot image upload event, validating file size and updating form state.
   * @param e - The change event from the file input
   */
  const handleHeadshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please select an image under 5MB.");
      return;
    }
    setUploading("headshot");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const url = await uploadImage(file, `profiles/${user.uid}/headshot.${ext}`);
      setValue("headshot", url, { shouldDirty: true });
    } catch (error) {
      console.error("Error uploading headshot:", error);
      alert("Failed to upload headshot.");
    } finally {
      setUploading(null);
    }
  };

  /**
   * Handles additional photo upload events, with limit of 10 photos.
   * @param e - The change event from the file input
   */
  const handleAdditionalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (additionalPhotos.length >= 10) {
      alert("Maximum 10 additional photos allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please select an image under 5MB.");
      return;
    }
    setUploading("additional");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const index = additionalPhotos.length;
      const url = await uploadImage(file, `profiles/${user.uid}/photos/${index}.${ext}`);
      setValue("additionalPhotos", [...additionalPhotos, url], { shouldDirty: true });
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo.");
    } finally {
      setUploading(null);
    }
  };

  /**
   * Removes an additional photo at the specified index from the profile.
   * @param index - The index of the photo to remove
   */
  const removeAdditionalPhoto = (index: number) => {
    setValue(
      "additionalPhotos",
      additionalPhotos.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
  };

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-[#2C3328]">Photos</h3>

      {/* Primary Headshot */}
      <div>
        <p className="mb-2 text-sm font-medium text-[#2C3328]">Primary Headshot</p>
        <div
          onClick={() => headshotInputRef.current?.click()}
          className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[#C7C0B5] bg-[#F0E9DE] transition-colors hover:border-[#E8721A]"
        >
          {uploading === "headshot" ? (
            <span className="text-xs text-[#6B6B6B]">Uploading...</span>
          ) : headshot ? (
            <img src={headshot} alt="Headshot" className="h-full w-full object-cover" />
          ) : (
            <Upload className="h-6 w-6 text-[#6B6B6B]" />
          )}
        </div>
        <p className="mt-1 text-xs text-[#6B6B6B]">Click or drag & drop</p>
        <input
          ref={headshotInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleHeadshotUpload}
          className="hidden"
        />
      </div>

      {/* Additional Photos */}
      <div>
        <p className="mb-2 text-sm font-medium text-[#2C3328]">
          Additional Photos (up to 10)
        </p>
        <div className="flex flex-wrap gap-3">
          {additionalPhotos.map((url, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-[#C7C0B5]">
              <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAdditionalPhoto(i)}
                className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 text-white group-hover:block"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {additionalPhotos.length < 10 && (
            <div
              onClick={() => additionalInputRef.current?.click()}
              className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#C7C0B5] bg-[#F0E9DE] transition-colors hover:border-[#E8721A]"
            >
              {uploading === "additional" ? (
                <span className="text-[10px] text-[#6B6B6B]">...</span>
              ) : (
                <Upload className="h-5 w-5 text-[#6B6B6B]" />
              )}
            </div>
          )}
        </div>
        <input
          ref={additionalInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          onChange={handleAdditionalUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}
