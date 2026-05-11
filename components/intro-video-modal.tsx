"use client";

interface IntroVideoModalProps {
  onClose: () => void;
}

export function IntroVideoModal({ onClose }: IntroVideoModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#424842]">
        <button
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
