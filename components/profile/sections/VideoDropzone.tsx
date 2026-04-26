"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { logger } from "@/lib/logger";

interface VideoDropzoneProps {
  /**
   * Callback fired when the upload successfully completes.
   * @param url - The public Firebase Storage download URL.
   * @param fileName - The original file name (without extension) to be used as the title.
   */
  onUploadSuccess: (url: string, fileName: string) => void;
}

/**
 * A drag-and-drop zone specifically configured for large video files.
 * Handles chunked uploads to Firebase Storage with real-time progress tracking
 * to prevent browser freezing and handle large media efficiently.
 */
export function VideoDropzone({ onUploadSuccess }: VideoDropzoneProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !user) return;

    setIsUploading(true);
    setProgress(0);

    try {
      // Dynamically importing Firebase modules to optimize initial bundle size
      const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage");
      const { getApp } = await import("@/lib/firebase");

      const storage = getStorage(getApp());
      
      // Constructing a unique file path to prevent naming collisions
      // Sanitizing the filename to prevent URL encoding issues
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const uniqueFileName = `${Date.now()}_${safeName}`;
      const storageRef = ref(storage, `users/${user.uid}/showreels/${uniqueFileName}`);

      // Create the resumable upload task tailored for large multi-part files
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || "video/mp4",
      });

      // Attach the state observer to handle progress, errors, and completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate and update the upload progress percentage
          const currentProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(Math.round(currentProgress));
        },
        (error) => {
          // Handle unsuccessful uploads
          logger.error({ err: error, msg: "Video upload failed during transfer" });
          alert("Upload failed. Please check your internet connection and try again.");
          setIsUploading(false);
        },
        async () => {
          // Handle successful uploads on complete
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Extract file name without extension for a cleaner UI title
            const fileNameWithoutExt = file.name.split('.').slice(0, -1).join('.') || file.name;
            
            // Pass the URL and title back to the parent form (react-hook-form)
            onUploadSuccess(downloadURL, fileNameWithoutExt);
          } catch (urlError) {
            logger.error({ err: urlError, msg: "Failed to retrieve video download URL" });
            alert("Video uploaded, but failed to retrieve the link.");
          } finally {
            setIsUploading(false);
          }
        }
      );

    } catch (error) {
      logger.error({ err: error, msg: "Failed to initialize video upload process" });
      alert("Could not start upload. Please try again.");
      setIsUploading(false);
    }
  }, [user, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    maxSize: 500 * 1024 * 1024, // 500MB strict limit
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative mt-4 flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all 
        ${isDragActive ? "border-[#E8721A] bg-[#E8721A]/10" : "border-[#C7C0B5] bg-[#E8DFD0]/50 hover:bg-[#E8DFD0]"}
        ${isUploading ? "pointer-events-none opacity-80" : ""}`}
    >
      <input {...getInputProps()} />
      
      {isUploading ? (
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#E8721A]" />
          <div className="text-sm font-medium text-[#2C3328]">Uploading... {progress}%</div>
          {/* Visual progress bar */}
          <div className="h-2 w-48 overflow-hidden rounded-full bg-[#C7C0B5]">
            <div 
              className="h-full bg-[#E8721A] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="rounded-full bg-[#E8DFD0] p-3">
            <UploadCloud className="h-6 w-6 text-[#E8721A]" />
          </div>
          <p className="text-sm font-medium text-[#2C3328]">
            Drag & drop a video up to 500MB
          </p>
          <p className="text-xs text-[#6B6B6B]">
            or click to browse from your computer
          </p>
        </div>
      )}
    </div>
  );
}