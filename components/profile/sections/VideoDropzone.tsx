"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { UploadCloud, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { logger } from "@/lib/logger";
import { extractVideoThumbnail } from "@/lib/showreels/extract-thumbnail";
import { toast } from "@/hooks/use-toast";

interface VideoDropzoneProps {
  /**
   * Callback fired when the upload successfully completes.
   * @param url - The public Firebase Storage download URL.
   * @param fileName - The original file name (without extension) to be used as the title.
   * @param thumbnailUrl - The optional thumbnail URL extracted and uploaded client-side.
   */
  onUploadSuccess: (url: string, fileName: string, thumbnailUrl: string | null) => void;
}

/**
 * A drag-and-drop zone configured for large video files.
 * Handles chunked uploads to Firebase Storage with real-time progress tracking,
 * parallel client-side thumbnail extraction, and graceful cancellation on unmount.
 */
export function VideoDropzone({ onUploadSuccess }: VideoDropzoneProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mutable refs to persist task handles across renders for unmount cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadTaskRef = useRef<any>(null); 
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Component lifecycle guard.
   * Ensures that if the actor unmounts the component (e.g., navigating away),
   * any active network-bound chunked upload and local CPU-bound extraction processes are cleanly aborted.
   */
  useEffect(() => {
    return () => {
      if (uploadTaskRef.current && typeof uploadTaskRef.current.cancel === "function") {
        uploadTaskRef.current.cancel();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsUploading(false);
    };
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    // Surface dropzone rejections (e.g., > 500MB limit, invalid MIME type) via the global toast system
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      const errorCode = rejection.errors[0]?.code;
      let errorMessage = rejection.errors[0]?.message ?? "File was rejected.";
      
      if (errorCode === "file-too-large") {
        errorMessage = "File is too large. Maximum size is 500MB.";
      }

      toast({
        title: "Upload rejected",
        description: errorMessage,
        variant: "destructive"
      });
      return;
    }

    const file = acceptedFiles[0];
    if (!file || !user) return;

    setIsUploading(true);
    setProgress(0);

    // Initialize extraction cancellation token
    abortControllerRef.current = new AbortController();

    /**
     * Fire-and-forget local thumbnail extraction.
     * Initiated immediately to run in parallel with the heavy network-bound video upload process.
     */
    const thumbnailBlobPromise = extractVideoThumbnail(file, { 
      signal: abortControllerRef.current.signal 
    }).catch((err) => {
      logger.warn({ err, msg: "Local thumbnail extraction failed; failing gracefully to video-only upload flow" });
      return null;
    });

    try {
      // Dynamically importing Firebase modules to optimize initial bundle size
      const { getStorage, ref, uploadBytesResumable, getDownloadURL, uploadBytes } = await import("firebase/storage");
      const { getApp } = await import("@/lib/firebase");

      const storage = getStorage(getApp());
      
      // Constructing a unique file path to prevent naming collisions
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const uniqueFileName = `${Date.now()}_${safeName}`;
      const storageRef = ref(storage, `users/${user.uid}/showreels/${uniqueFileName}`);

      // Create the resumable upload task tailored for large multi-part files
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || "video/mp4",
      });

      // Store reference for potential unmount cancellation
      uploadTaskRef.current = uploadTask;

      // Attach the state observer to handle progress, errors, and completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate and update the upload progress percentage
          const currentProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(Math.round(currentProgress));
        },
        (error) => {
          // Handle unsuccessful uploads securely without native alerts
          logger.error({ err: error, msg: "Video upload failed during transfer" });
          toast({
            title: "Upload failed",
            description: "Please check your internet connection and try again.",
            variant: "destructive"
          });
          setIsUploading(false);
        },
        async () => {
          // Handle successful uploads on complete
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Await the parallel thumbnail extraction result
            const thumbnailBlob = await thumbnailBlobPromise;
            let thumbnailUrl: string | null = null;

            if (thumbnailBlob) {
              try {
                // Upload thumbnail as a discrete buffer stream (not resumable to avoid overhead for <200KB payload)
                const thumbnailRef = ref(storage, `users/${user.uid}/showreels/thumbnails/${uniqueFileName}.jpg`);
                await uploadBytes(thumbnailRef, thumbnailBlob, { contentType: "image/jpeg" });
                thumbnailUrl = await getDownloadURL(thumbnailRef);
              } catch (thumbError) {
                // Non-fatal exception: Video URL is already secured; we proceed with null thumbnail
                logger.error({ err: thumbError, msg: "Thumbnail upload failed, continuing without thumbnail" });
              }
            }

            // Extract file name without extension for a cleaner UI title
            const fileNameWithoutExt = file.name.split('.').slice(0, -1).join('.') || file.name;
            
            // Pass the URL, title, and optional thumbnail URL back to the parent form
            onUploadSuccess(downloadURL, fileNameWithoutExt, thumbnailUrl);
          } catch (urlError) {
            logger.error({ err: urlError, msg: "Failed to retrieve video download URL" });
            toast({
              title: "Upload failed",
              description: "Video uploaded, but failed to retrieve the link.",
              variant: "destructive"
            });
          } finally {
            setIsUploading(false);
          }
        }
      );

    } catch (error) {
      logger.error({ err: error, msg: "Failed to initialize video upload process" });
      toast({
        title: "Upload failed",
        description: "Could not start upload. Please try again.",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  }, [user, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    maxSize: 500 * 1024 * 1024, // 500MB strict limit enforced client-side
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