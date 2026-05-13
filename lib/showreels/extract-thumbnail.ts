/**
 * Core infrastructure utility for client-side video frame extraction.
 * Generates a JPEG Blob thumbnail from a given File object using HTML5 Video and Canvas APIs.
 * * Includes enterprise-grade safety mechanisms:
 * - OOM (Out of Memory) guards via strict dimensional capping (512px max).
 * - Memory leak prevention via deterministic URL.revokeObjectURL calls.
 * - Resource cleanup on all exit paths (success, error, timeout, abort).
 */
export function extractVideoThumbnail(
  file: File,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const timeoutMs = options?.timeoutMs ?? 10000;
    let isCleanedUp = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Early exit if already aborted
    if (options?.signal?.aborted) {
      return reject(new Error("AbortError: extraction aborted"));
    }

    const objectURL = URL.createObjectURL(file);
    const video = document.createElement("video");

    /**
     * Idempotent cleanup sequence. Pauses the video, clears src, 
     * removes listeners, and revokes the blob URL to prevent memory leaks.
     */
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      clearTimeout(timeoutId);
      
      if (options?.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
      
      video.pause();
      video.src = "";
      URL.revokeObjectURL(objectURL);
    };

    const onAbort = () => {
      cleanup();
      reject(new Error("AbortError: extraction aborted"));
    };

    if (options?.signal) {
      options.signal.addEventListener("abort", onAbort);
    }

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("extraction timeout"));
    }, timeoutMs);

    // Muted is required for programmatic seekability in many modern browsers (e.g., Safari)
    video.muted = true;
    video.preload = "metadata";
    video.src = objectURL;

    video.onerror = () => {
      cleanup();
      reject(new Error("video load error"));
    };

    video.onloadedmetadata = () => {
      if (isCleanedUp) return;
      
      // Fallback for corrupt metadata yielding NaN/Infinity durations
      if (isNaN(video.duration) || !isFinite(video.duration)) {
        video.currentTime = 1.0;
      } else {
        video.currentTime = 0.1;
      }
    };

    video.onseeked = () => {
      if (isCleanedUp) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        cleanup();
        return reject(new Error("canvas context unavailable"));
      }

      let w = video.videoWidth;
      let h = video.videoHeight;

      // 16:9 Fallback for browsers failing to report native dimensions
      if (w === 0 || h === 0) {
        w = 320;
        h = 180;
      }

      // Proportional downscaling to cap max dimension at 512px (OOM prevention)
      if (w > 512 || h > 512) {
        const ratio = Math.min(512 / w, 512 / h);
        w = w * ratio;
        h = h * ratio;
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);

      canvas.toBlob((blob) => {
        cleanup();
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("blob generation failed"));
        }
      }, "image/jpeg");
    };

    // Explicit load call required to trigger metadata loading pipeline
    video.load();
  });
}