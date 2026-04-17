"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, AudioLines, SendHorizontal, Square, Loader2, Mic, X } from "lucide-react"; 
import { getAuth } from "firebase/auth";

interface ChatInputProps {
  onSend: (message: string, document?: AttachedDocument | null) => void;
  isLoading: boolean;
}

/**
 * Standardized payload for attached documents, enforcing strong typing 
 * for Base64 encoded files sent to the Next.js API.
 */
export interface AttachedDocument {
  data: string;
  mimeType: string;
  name: string;
}

/**
 * Renders a pulsating voice waveform to provide visual feedback during audio capture.
 * Uses staggered animation delays to simulate real-time audio input.
 */
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

  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * State management for the currently queued document attachment.
   */
  const [pendingDocument, setPendingDocument] = useState<AttachedDocument | null>(null);
  
  /**
   * Reference to the hidden file input element, allowing us to programmatically 
   * trigger the native OS file picker via the Paperclip UI button.
   */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Intercepts the native file selection event, reads the file via FileReader,
   * extracts the Base64 payload, and updates the pending document state.
   */
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input value to ensure the onChange event fires even if 
    // the user removes and selects the exact same file again.
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

  /**
   * Programmatically triggers the hidden file input click event.
   */
  const triggerFileSelect = () => fileInputRef.current?.click();

  /**
   * Clears the current pending document from memory and UI.
   */
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
   * Handles form submission by sending the trimmed message and/or the attached 
   * document, then clearing the respective input states.
   */
  const handleSubmit = () => {
    const hasText = value.trim().length > 0;
    const hasDoc = pendingDocument !== null;
    
    if ((!hasText && !hasDoc) || isLoading) return;
    
    onSend(value.trim(), pendingDocument);
    setValue("");
    setPendingDocument(null);
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
               setValue(data.text);
               
               setTimeout(() => {
                 inputRef.current?.focus();
               }, 10);
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
    // Atualize esta linha para considerar o pendingDocument
    else if (value.trim() || pendingDocument) handleSubmit();
    else startRecording();
  };

  return (
    <div className="flex justify-center px-8 pb-3 pt-2">
      {/* Mudamos de items-center para items-end para os botões ficarem no fundo quando a caixa crescer */}
      <div className="flex w-full max-w-2xl items-end gap-2 rounded-3xl border border-[#C7C0B5]/60 bg-[#F0E8DC] px-4 py-2 shadow-sm transition-all">
        
        {/* Hidden file input strictly for handling OS file picker dialogs */}
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
        
        {/* Document Attachment Badge 
          Provides visual confirmation of a successfully queued document.
        */}
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
            placeholder={isTranscribing ? "Transcribing..." : "Ask me anything..."}
            disabled={isLoading || isTranscribing}
            className="max-h-[150px] min-h-[24px] w-full resize-none bg-transparent py-2 text-sm text-[#2C3328] outline-none placeholder:text-[#6B6B6B]/60 disabled:opacity-50"
          />
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
