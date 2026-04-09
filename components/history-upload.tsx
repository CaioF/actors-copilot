"use client";

import { useState } from "react";
import { StepUpload } from "@/components/auditions/step/step-upload"; // Ajuste o caminho conforme necessário
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { getAuth } from "firebase/auth";

interface HistoryUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function HistoryUploadModal({ onClose, onSuccess }: HistoryUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text && !file) return;
    
    setIsSubmitting(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");

      const idToken = await user.getIdToken();

      // Usando FormData para suportar o envio do arquivo binário real para a API
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

      onSuccess();
    } catch (error) {
      console.error("Error saving history:", error);
      alert("Failed to save history. Make sure your PDF is not encrypted or corrupted.");
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
            className="px-8 py-2 rounded-full bg-[#FF7316] text-white font-medium hover:bg-[#FF7316]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Saving..." : "Save Baseline"}
          </button>
        </div>
      </div>
    </div>
  );
}