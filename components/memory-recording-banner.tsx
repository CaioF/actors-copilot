"use client";

import { useState, useRef } from "react";
import { Mic, Square, Loader2, CheckCircle2 } from "lucide-react";
import { getAuth } from "firebase/auth";

type RecordStatus = "idle" | "recording" | "processing" | "success" | "error";

export function MemoryRecordingBanner() {
  const [status, setStatus] = useState<RecordStatus>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

            // Envia para a nossa nova rota única
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
            // Volta pro estado normal depois de 3 segundos
            setTimeout(() => setStatus("idle"), 3000); 

          } catch (error) {
            console.error("Memory processing error:", error);
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
          }
        };
      };

      mediaRecorder.start();
      setStatus("recording");
    } catch (error) {
      console.error("Mic access denied", error);
      alert("Please allow microphone access to record a memory.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Renderização dinâmica do botão baseada no status
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
            className="flex items-center gap-3 px-4 py-4 bg-[#FF7316] text-white rounded-full font-medium hover:bg-[#FF7316]/90 transition-all shrink-0 shadow-lg shadow-[#FF7316]/20 hover:scale-105 active:scale-95"
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
            Quick Memory Recording
          </h3>
          <p className="text-[#B7BCB6] text-sm max-w-2xl leading-relaxed">
            Moments of truth don't wait. Tap the mic anytime to record personal thoughts or past experiences. The Copilot will analyze and add it to your DNA Vault.
          </p>
        </div>
      </div>
      
      {renderButton()}
    </div>
  );
}