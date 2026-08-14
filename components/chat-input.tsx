"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, SendHorizontal, Square, Loader2, Mic, X, Dna, RefreshCw } from "lucide-react"; 
import { getAuth } from "firebase/auth";
import { logger } from "@/lib/logger";

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
  role: "user" | "assistant" | "coach" | "system";
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
  { title: "Early Childhood / Home", desc: "Safety, belonging, first wounds." },
  { title: "School / Authority", desc: "Rules, power, being seen or invisible." },
  { title: "Identity / Self-Story", desc: "Who you believe you are." },
  { title: "Friendship / Belonging", desc: "Acceptance, exclusion, loyalty." },
  { title: "Romance / Intimacy", desc: "Desire, vulnerability, attachment." },
  { title: "Loss / Grief", desc: "What you've had to let go." },
  { title: "Ambition / Drive", desc: "What you're reaching for." },
  { title: "Shame / Secret Self", desc: "What you hide and why." },
  { title: "Joy / Play", desc: "When you're most alive." },
  { title: "Conflict / Anger", desc: "What makes you fight." }
];

function VoiceWaveform() {
  return (
    <div className="flex items-center justify-center gap-1.5 h-10 w-full bg-transparent">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-primary rounded-full animate-bounce"
          style={{
            height: "16px",
            animationDuration: `${0.6 + i * 0.1}s`,
          }}
        />
      ))}
      <span className="ml-3 text-sm font-medium text-muted-foreground animate-pulse">
        Listening...
      </span>
    </div>
  );
}

/**
 * ChatInput Component.
 * Responsive, themed input control bar supporting voice recording, file attachments, and DNA Vault shortcuts.
 * @param {ChatInputProps} props - Component property settings
 * @returns {JSX.Element} Rendered ChatInput container
 */
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dnaMenuRef.current && !dnaMenuRef.current.contains(event.target as Node)) {
        setIsDnaOpen(false);
      }
    }
    if (isDnaOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDnaOpen]);

  const handleUpdateDna = async () => {
    if (!messages || messages.length === 0) return;

    setIsUpdatingDna(true);
    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      if (!idToken) throw new Error("User not authenticated.");

      const messagesToAnalyze = messages.slice(-15).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await fetch("/api/coach/updateDna", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
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
    } catch (error) {
      logger.error({ err: error, msg: "Error updating DNA Vault" });
    } finally {
      setIsUpdatingDna(false);
    }
  };

  const inferMimeType = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    switch (ext) {
      case "md":
      case "markdown":
        return "text/markdown";
      case "rtf":
        return "application/rtf";
      case "txt":
        return "text/plain";
      case "pdf":
        return "application/pdf";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      default:
        return "";
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];

      setPendingDocument({
        data: base64Data,
        mimeType: inferMimeType(file),
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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(",")[1];
          try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();

            const response = await fetch("/api/dna/transcribe/chat", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${idToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ audioBase64: base64data, mimeType: audioBlob.type })
            });

            const data = await response.json();
            if (data.text) {
               setValue(data.text);
               setTimeout(() => inputRef.current?.focus(), 10);
            }
          } catch (error) {
            logger.error({ err: error, msg: "Transcription error" });
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      logger.error({ err: error, msg: "Mic access denied" });
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
    <div className="flex justify-center px-4 sm:px-8 pb-3 pt-2 bg-background">
      <div className="flex w-full max-w-2xl items-end gap-2 rounded-3xl border border-border bg-card px-4 py-2 shadow-sm transition-all">
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          accept=".pdf,.txt,.doc,.docx,.rtf,.md,.markdown"
        />

        {/* Attach File Button */}
        <button
          onClick={triggerFileSelect} 
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Attach file"
          type="button"
          disabled={isRecording || isTranscribing || !!pendingDocument} 
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-hidden flex flex-col justify-end">
          {pendingDocument && (
            <div className="flex items-center gap-2 mb-1 mt-1 bg-muted px-2.5 py-1 rounded-md w-fit border border-border">
              <span className="text-xs text-foreground font-semibold truncate max-w-[120px]">
                {pendingDocument.name}
              </span>
              <button 
                onClick={removeDocument} 
                className="text-muted-foreground hover:text-destructive transition-colors"
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
              className="max-h-[150px] min-h-[24px] w-full resize-none bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
            />
          )}
        </div>

        {/* DNA Button and Popover */}
        <div className="relative flex items-center justify-center mb-0.5" ref={dnaMenuRef}>
          <button
            onClick={() => setIsDnaOpen((prev) => !prev)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors mr-1 ${
              isDnaOpen 
                ? "bg-muted text-foreground" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            type="button"
            aria-label="DNA Reservoirs"
          >
            <Dna className="h-5 w-5" />
          </button>

          {isDnaOpen && (
            <div className="absolute bottom-[calc(100%+24px)] right-[-20px] sm:right-0 z-50 w-[85vw] max-w-[480px] rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
              
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-foreground font-semibold">Your DNA Reservoirs</h3>
                <button 
                  onClick={handleUpdateDna}
                  disabled={isUpdatingDna || messages.length === 0}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border disabled:opacity-50 disabled:cursor-not-allowed"
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

              <div className="h-[1px] w-full bg-border mb-4" />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                {DNA_RESERVOIRS.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex flex-col cursor-pointer group"
                    onClick={() => setIsDnaOpen(false)}
                  >
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Action Button (Mic / Send / Stop) */}
        <button
          onClick={handleMainAction}
          disabled={isLoading && !isRecording && !isTranscribing}
          className={`mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
            isRecording
              ? "animate-pulse bg-destructive text-destructive-foreground"
              : isTranscribing
              ? "bg-primary/70 text-primary-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
          aria-label={isRecording ? "Stop recording" : value.trim() ? "Send message" : "Start recording"}
          type="button"
        >
          {isTranscribing ? (
            <Loader2 size={20} className="animate-spin text-primary-foreground" />
          ) : isRecording ? (
            <Square size={16} className="fill-current text-destructive-foreground" />
          ) : value.trim().length > 0 ? (
            <SendHorizontal size={20} className="text-primary-foreground" />
          ) : (
            <Mic size={20} className="text-primary-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}