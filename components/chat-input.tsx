"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, AudioLines, SendHorizontal, Square, Loader2, Mic, X, Dna, RefreshCw } from "lucide-react"; 
import { getAuth } from "firebase/auth";
import { logger } from '@/lib/logger';

/**
 * Standardized payload for attached documents.
 */
export interface AttachedDocument {
  data: string;
  mimeType: string;
  name: string;
}

/**
 * Represents a single message object from the acting coach session.
 */
export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'coach' | 'system';
  content: string;
}

/**
 * Props for the ChatInput component.
 */
interface ChatInputProps {
  onSend: (message: string, document?: AttachedDocument | null) => void;
  isLoading: boolean;
  placeholder?: string;
  messages?: SessionMessage[];
  sessionId?: string;
}

const DNA_RESERVOIRS = [
  { title: "Early Childhood / Home", desc: "Safety, belonging, firsts wounds." },
  { title: "School / Authority", desc: "Rules, powers, being seen or invisible" },
  { title: "Identity / Self-Story", desc: "Who you believe you are" },
  { title: "Friendship / Belonging", desc: "Acceptance, exclusion, loyalty" },
  { title: "Romance / Intimacy", desc: "Desire, vulnerability, attachment" },
  { title: "Loss / Grief", desc: "What you've had to let go" },
  { title: "Ambition / Drive", desc: "What you're reaching for" },
  { title: "Shame / Secret Self", desc: "What you hide why" },
  { title: "Joy / Play", desc: "When you're most alive" },
  { title: "Conflict / Anger", desc: "What makes you fight" }
];

function VoiceWaveform() {
  return (
    <div className="flex items-center justify-center gap-1.5 h-10 w-full bg-transparent">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-[#E8721A] rounded-full animate-bounce"
          style={{
            height: "16px",
            animationDuration: `${0.6 + i * 0.1}s`,
          }}
        />
      ))}
      <span className="ml-3 text-sm font-medium text-[#6B6B6B] animate-pulse">
        Listening...
      </span>
    </div>
  );
}

export function ChatInput({ 
  onSend, 
  isLoading, 
  placeholder = "Ask me anything...",
  messages = [],
  sessionId
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDnaOpen, setIsDnaOpen] = useState(false);
  const [isUpdatingDna, setIsUpdatingDna] = useState(false);
  const [pendingDocument, setPendingDocument] = useState<AttachedDocument | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dnaMenuRef = useRef<HTMLDivElement>(null);

  /**
   * Handles closing the DNA popover when clicking outside of it.
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dnaMenuRef.current && !dnaMenuRef.current.contains(event.target as Node)) {
        setIsDnaOpen(false);
      }
    }
    if (isDnaOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDnaOpen]);

  /**
   * Extracts psychological data from the current session history via API.
   * Filters the last 15 messages to prevent payload bloat.
   */
  const handleUpdateDna = async () => {
    if (!messages || messages.length === 0) return;

    setIsUpdatingDna(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      if (!idToken) throw new Error("User not authenticated.");

      // For performance, we analyze a sliding window of the most recent messages
      const messagesToAnalyze = messages.slice(-15).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch('/api/coach/updateDna', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sessionId: sessionId,
          messages: messagesToAnalyze 
        }) 
      });

      if (!response.ok) {
        throw new Error(`Failed to update DNA Vault. Status: ${response.status}`);
      }

      const data = await response.json();
      logger.info({ msg: "DNA Vault updated successfully", data });
      // TODO: Implement UI Toast Notification for success here.
      
    } catch (error) {
      logger.error({ err: error, msg: 'Error updating DNA Vault' });
      // TODO: Implement UI Toast Notification for error here.
    } finally {
      setIsUpdatingDna(false);
    }
  };

  // ... (Keep existing handleFileUpload, triggerFileSelect, removeDocument, Textarea height useEffect, Focus useEffect) ...
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1]; 

      setPendingDocument({
        data: base64Data,
        mimeType: file.type,
        name: file.name
      });
    };
  };

  const triggerFileSelect = () => fileInputRef.current?.click();
  const removeDocument = () => setPendingDocument(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [value]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isLoading]);

  const handleSubmit = () => {
    const hasText = value.trim().length > 0;
    const hasDoc = pendingDocument !== null;
    
    if ((!hasText && !hasDoc) || isLoading) return;
    
    onSend(value.trim(), pendingDocument);
    setValue("");
    setPendingDocument(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
               setValue(data.text);
               setTimeout(() => inputRef.current?.focus(), 10);
            }
          } catch (error) {
            logger.error({ err: error, msg: 'Transcription error' });
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      logger.error({ err: error, msg: 'Mic access denied' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleMainAction = () => {
    if (isTranscribing) return; 
    if (isRecording) stopRecording();
    else if (value.trim() || pendingDocument) handleSubmit();
    else startRecording();
  };

  return (
    <div className="flex justify-center px-8 pb-3 pt-2">
      <div className="flex w-full max-w-2xl items-end gap-2 rounded-3xl border border-[#C7C0B5]/60 bg-[#F0E8DC] px-4 py-2 shadow-sm transition-all">
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          accept=".pdf,.txt,.doc,.docx"
        />

        <button
          onClick={triggerFileSelect} 
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#E8DFD0] hover:text-[#2C3328]"
          aria-label="Attach file"
          type="button"
          disabled={isRecording || isTranscribing || !!pendingDocument} 
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-hidden flex flex-col justify-end">
          {pendingDocument && (
            <div className="flex items-center gap-2 mb-1 mt-1 bg-[#E8DFD0] px-2.5 py-1 rounded-md w-fit border border-[#C7C0B5]/50">
              <span className="text-xs text-[#2C3328] font-semibold truncate max-w-[100px]">
                {pendingDocument.name}
              </span>
              <button 
                onClick={removeDocument} 
                className="text-[#6B6B6B] hover:text-red-500 transition-colors"
                aria-label="Remove attachment"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {isRecording ? (
            <VoiceWaveform />
          ) : (
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isTranscribing ? "Transcribing..." : placeholder ?? "Ask me anything..."}
              disabled={isLoading || isTranscribing}
              className="max-h-[150px] min-h-[24px] w-full resize-none bg-transparent py-2 text-sm text-[#2C3328] outline-none placeholder:text-[#6B6B6B]/60 disabled:opacity-50"
            />
          )}
        </div>

        {/* DNA Button and Popover */}
        <div className="relative flex items-center justify-center mb-0.5" ref={dnaMenuRef}>
          <button
            onClick={() => setIsDnaOpen((prev) => !prev)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors mr-1 ${
              isDnaOpen 
                ? "bg-[#E8DFD0] text-[#2C3328]" 
                : "text-[#6B6B6B] hover:bg-[#E8DFD0] hover:text-[#2C3328]"
            }`}
            type="button"
            aria-label="DNA Reservoirs"
          >
            <Dna className="h-5 w-5" />
          </button>

          {isDnaOpen && (
            <div className="absolute bottom-[calc(100%+24px)] right-[-20px] sm:right-0 z-50 w-[85vw] max-w-[480px] rounded-2xl border border-[#E8DFD0] bg-[#F9F7F2] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
              
              {/* Refactored Header Layout */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#2C3328] font-semibold">Your DNA Reservoirs</h3>
                <button 
                  onClick={handleUpdateDna}
                  disabled={isUpdatingDna || messages.length === 0}
                  className="flex items-center gap-1.5 rounded-full bg-[#E8DFD0] px-3 py-1.5 text-xs font-medium text-[#2C3328] transition-colors hover:bg-[#C7C0B5] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Update DNA Vault based on current session"
                >
                  {isUpdatingDna ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Update Vault
                </button>
              </div>

              <div className="h-[1px] w-full bg-[#E8DFD0] mb-4"></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {DNA_RESERVOIRS.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex flex-col cursor-pointer group"
                    onClick={() => setIsDnaOpen(false)}
                  >
                    <span className="text-sm font-medium text-[#2C3328] group-hover:text-[#E8721A] transition-colors">
                      {item.title}
                    </span>
                    <span className="text-xs text-[#6B6B6B] mt-0.5">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleMainAction}
          disabled={isLoading && !isRecording && !isTranscribing}
          className={`mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
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