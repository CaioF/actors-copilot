"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, AudioLines, SendHorizontal, Square, Loader2, Mic } from "lucide-react"; 
import { getAuth } from "firebase/auth";
interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

/**
 * Chat input component with text input, voice recording, and message submission.
 * @param props - The component props
 * @param props.onSend - Callback function to send a message
 * @param props.isLoading - Whether the AI is currently processing a request
 * @returns The chat input JSX element
 */
export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Focus automatically after AI finishes generating a response
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      // 10ms delay to ensure focus happens after any potential UI updates from the new message rendering
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isLoading]);

  /**
   * Handles form submission by sending the trimmed message and clearing the input.
   */
  const handleSubmit = () => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
  };

  /**
   * Handles keyboard events for the input field.
   * Submits the message when Enter is pressed (without Shift).
   * @param e - The keyboard event
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /**
   * Starts audio recording, requests microphone access, and sets up transcription on stop.
   * @async
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
        setIsTranscribing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();

            const response = await fetch('/api/dna/transcribe/chat', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ audioBase64: base64data, mimeType: audioBlob.type })
            });

            const data = await response.json();
            if (data.text) {
               onSend(data.text);
            }
          } catch (error) {
            console.error("Transcription error:", error);
            alert("Failed to transcribe audio.");
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Mic access denied", error);
      alert("Please allow microphone access.");
    }
  };

  /**
   * Stops the currently active audio recording and releases microphone resources.
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  /**
   * Handles the main action button click based on current state.
   * Stops recording if recording, submits if text exists, otherwise starts recording.
   */
  const handleMainAction = () => {
    if (isTranscribing) return; 
    if (isRecording) stopRecording();
    else if (value.trim()) handleSubmit();
    else startRecording();
  };

  return (
    <div className="flex justify-center px-8 pb-3 pt-2">
      <div className="flex w-full max-w-2xl items-center gap-2 rounded-full border border-[#C7C0B5]/60 bg-[#F0E8DC] px-4 py-2 shadow-sm">
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#E8DFD0] hover:text-[#2C3328]"
          aria-label="Attach file"
          type="button"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Ask me anything..."}
          disabled={isLoading || isRecording || isTranscribing}
          className="flex-1 bg-transparent text-sm text-[#2C3328] outline-none placeholder:text-[#6B6B6B]/60 disabled:opacity-50"
        />

        <button
          onClick={handleMainAction}
          disabled={isLoading && !isRecording && !isTranscribing}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
            isRecording
              ? "animate-pulse bg-red-500 text-white"
              : isTranscribing
              ? "bg-[#E8721A]/70 text-white cursor-not-allowed"
              : "bg-[#E8721A] text-white hover:bg-[#E8721A]/90"
          }`}
          aria-label={isRecording ? "Stop recording" : value.trim() ? "Send message" : "Start recording"}
          type="button"
        >
          {isTranscribing ? (
            <Loader2 size={20} className="animate-spin text-white" />
          ) : isRecording ? (
            <Square size={16} className="fill-current text-white" />
          ) : value.trim().length > 0 ? (
            <SendHorizontal size={20} className="text-white" />
          ) : (
            <Mic size={20} className="text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
