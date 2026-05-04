"use client";

import { useState } from "react";
import { StepUpload } from "@/components/auditions/step/step-upload";
import { CheckCircle2 } from "lucide-react";
import { getAuth } from "firebase/auth";
import { logger } from '@/lib/logger';
import { useToast } from "@/hooks/use-toast";

interface HistoryUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal component for uploading and submitting user history/baseline data.
 * Allows users to upload a PDF file or enter text, then sends it to the API
 * for processing and storage in the user's DNA vault.
 * 
 * @param props - Component props
 * @param props.onClose - Callback to close the modal
 * @param props.onSuccess - Callback to execute after successful upload
 * @returns JSX element representing the history upload modal
 */
export function HistoryUploadModal({ onClose, onSuccess }: HistoryUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  /**
   * Handles the submission of history/baseline data.
   * Validates input, authenticates the user, and uploads the file and/or text
   * to the API endpoint for processing.
   * 
   * @returns Promise<void> - Resolves when submission completes, or throws on error
   */
  const handleSubmit = async () => {
    if (!text && !file) return;
    
    setIsSubmitting(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const idToken = await user.getIdToken();

      const formData = new FormData();
      if (file) formData.append('file', file);
      if (text) formData.append('text', text);

      const response = await fetch('/api/dna/baseline', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload");
      }

      setIsSuccess(true);

    } catch (error) {
      logger.error({ err: error, msg: 'Error saving history' });
      const message = error instanceof Error ? error.message : "";
      toast({
        variant: "destructive",
        title: "Couldn't save your baseline",
        description:
          message.toLowerCase().includes("auth")
            ? "Your session may have expired — try logging out and back in, then upload again."
            : "We couldn't read that file. Most often the PDF is password-protected, scanned-as-image, or corrupted. Try a clean PDF or paste the text directly into the box.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#424842]">
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-[#B7BCB6] hover:text-white"
        >
          ✕
        </button>

        {/* RENDERIZAÇÃO CONDICIONAL: Tela de Sucesso ou Tela de Upload */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center p-12 py-24 text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-[#FF7316]/20 p-5 rounded-full mb-6">
              <CheckCircle2 className="w-16 h-16 text-[#FF7316]" />
            </div>
            <h2 className="text-3xl font-title font-medium text-[#EADDCE] mb-4">
              Baseline Saved & Analyzed!
            </h2>
            <p className="text-[#B7BCB6] text-lg max-w-lg mx-auto mb-10 leading-relaxed">
              The Coach has successfully extracted the core patterns from your history and updated your Personal DNA Vault. You are ready to dive deeper.
            </p>
            <button 
              onClick={onSuccess} // Isso vai fechar o modal através da Dashboard
              className="px-10 py-3 rounded-full bg-[#FF7316] text-white font-medium hover:bg-[#FF7316]/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#FF7316]/20"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <StepUpload 
              title="Upload Your Baseline History"
              description="Give The Coach a head start. Upload your journal entries, therapy notes, or personal biography. The AI will use this to skip the small talk and dive deep into your specific patterns."
              file={file}
              text={text}
              onFileChange={setFile}
              onTextChange={setText}
            />

            <div className="p-8 pt-0 flex justify-end gap-4 bg-[#424842] rounded-b-3xl">
              <button 
                onClick={onClose}
                className="px-6 py-2 rounded-full text-[#EADDCE] hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || (!text && !file)}
                className="px-8 py-2 rounded-full bg-[#FF7316] text-white font-medium hover:bg-[#FF7316]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[160px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Analyzing...
                  </span>
                ) : (
                  "Save Baseline"
                )}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}