"use client";

import { useEffect, useRef } from "react";

interface IntroVideoModalProps {
  onClose: () => void;
}

export function IntroVideoModal({ onClose }: IntroVideoModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-video-modal-title"
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#424842]"
      >
        <h2 id="intro-video-modal-title" className="sr-only">
          Intro video
        </h2>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close intro video"
          className="absolute top-6 right-6 text-[#B7BCB6] hover:text-white"
        >
          ✕
        </button>
        <video
          src="https://firebasestorage.googleapis.com/v0/b/actors-copilot-app.firebasestorage.app/o/INTRO_VIDEO.MP4?alt=media"
          controls
          autoPlay
          data-testid="intro-video-modal"
          className="w-full"
        />
      </div>
    </div>
  );
}
