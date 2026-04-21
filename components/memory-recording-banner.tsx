"use client";

import { useState, useRef } from "react";
import { Mic, Square, Loader2, CheckCircle2 } from "lucide-react";
import { getAuth } from "firebase/auth";
import { logger } from '@/lib/logger';

type RecordStatus = "idle" | "recording" | "processing" | "success" | "error";

/**
 * MemoryRecordingBanner Component
 * Provides a UI for recording voice memories to be added to the user's DNA Vault.
 * Handles microphone access, audio recording, and transcription via API.
 */
export function MemoryRecordingBanner() {
  const [status, setStatus] = useState<RecordStatus>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /**
   * Initiates audio recording by requesting microphone access,
   * setting up MediaRecorder, and preparing chunks for upload.
   */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setStatus("processing");
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          
          try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Not authenticated");

            const response = await fetch('/api/dna/transcribe/history', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                audioBase64: base64data,
                mimeType: audioBlob.type 
              })
            });

            if (!response.ok) throw new Error("Failed to process memory");

            setStatus("success");
            setTimeout(() => setStatus("idle"), 3000); 

          } catch (error) {
            logger.error({ err: error, msg: 'Memory processing error' });
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
          }
        };
      };

      mediaRecorder.start();
      setStatus("recording");
    } catch (error) {
      logger.error({ err: error, msg: 'Mic access denied' });
      alert("Please allow microphone access to record a memory.");
    }
  };

  /**
   * Stops the current audio recording and releases microphone tracks.
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  /**
   * Renders the appropriate button based on the current recording status.
   * @returns React button element appropriate for the current status
   */
  const renderButton = () => {
    switch (status) {
      case "recording":
        return (
          <button
            onClick={stopRecording}
            className="flex items-center gap-3 px-8 py-4 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition-all shrink-0 shadow-lg shadow-red-500/20 animate-pulse"
          >
            <Square className="h-5 w-5 fill-current" />
            <span>Stop Recording</span>
          </button>
        );
      case "processing":
        return (
          <button
            disabled
            className="flex items-center gap-3 px-8 py-4 bg-[#FF7316]/70 text-white rounded-full font-medium shrink-0 cursor-not-allowed"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Analyzing...</span>
          </button>
        );
      case "success":
        return (
          <button
            disabled
            className="flex items-center gap-3 px-8 py-4 bg-green-600 text-white rounded-full font-medium shrink-0"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span>Memory Saved!</span>
          </button>
        );
      case "error":
        return (
          <button
            onClick={() => setStatus("idle")}
            className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white rounded-full font-medium shrink-0"
          >
            <span>Failed. Try again.</span>
          </button>
        );
      default: // "idle"
        return (
          <button
            onClick={startRecording}
            className="flex items-center gap-3 px-4 py-4 bg-[#FF7316] text-white rounded-full font-medium hover:bg-[#FF7316]/90 transition-all shrink-0 hover:scale-105 active:scale-95"
          >
            <Mic className="h-5 w-5" />
            <span>Capture a Memory</span>
          </button>
        );
    }
  };

  return (
    <div className="mx-8 mt-4 bg-[#3D4A3C] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl border border-[#B7BCB6]/10">
      <div className="flex gap-4 items-center">
        <div className="bg-[#FF7316]/20 p-4 rounded-full shrink-0 hidden sm:flex">
          <Mic className="w-6 h-6 text-[#ff6600]" />
        </div>
        <div>
          <h3 className="text-[#EADDCE] text-xl font-medium font-title mb-1.5">
            Memory Recording
          </h3>
          <p className="text-[#B7BCB6] text-sm max-w-2xl leading-relaxed">
            When something surfaces, record it while it’s still fresh. Stay close to the details — what you saw, heard, smelt, touched, or tasted. The more vivid and specific the memory, the more truthfully it can live in your work.
          </p>
        </div>
      </div>
      
      {renderButton()}
    </div>
  );
}