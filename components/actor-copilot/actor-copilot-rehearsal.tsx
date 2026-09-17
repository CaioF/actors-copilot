"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import {
  Mic,
  Square,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clapperboard,
  Settings2,
  AudioWaveform,
  X,
  Zap,
} from "lucide-react";
import { logger } from "@/lib/logger";
import {
  SceneData,
  ScriptLine,
  RehearsalStatus,
  matchActorLine,
  getVoiceForCharacter,
  AVAILABLE_GEMINI_VOICES,
} from "@/lib/actor-copilot/script-parser";

interface ActorCopilotRehearsalProps {
  scene: SceneData;
  auditionId?: string;
  projectTitle?: string;
  initialActorCharacter?: string;
  onExit?: () => void;
}

export function ActorCopilotRehearsal({
  scene,
  auditionId,
  projectTitle,
  initialActorCharacter,
  onExit,
}: ActorCopilotRehearsalProps) {
  const router = useRouter();

  // Character selection & Rehearsal session state
  const [actorCharacter, setActorCharacter] = useState<string | null>(initialActorCharacter || null);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(0);
  const [status, setStatus] = useState<RehearsalStatus>("IDLE");

  // Custom AI character voice mappings
  const [characterVoices, setCharacterVoices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    scene.characters.forEach((char, idx) => {
      initial[char] = getVoiceForCharacter(char, idx);
    });
    return initial;
  });
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  // Transcriptions & Audio states
  const [transcripts, setTranscripts] = useState<Record<number, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Background Audio Pre-fetch Cache for Zero-Latency AI turns
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const audioElementCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const prefetchingIdsRef = useRef<Set<string>>(new Set());

  // Audio & Mic refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lineContainerRef = useRef<HTMLDivElement | null>(null);

  const currentLine: ScriptLine | undefined = scene.lines[currentLineIndex];
  const isActorTurn = actorCharacter && currentLine ? currentLine.character === actorCharacter : false;

  // Auto-scroll active line into view smoothly
  useEffect(() => {
    if (lineContainerRef.current) {
      const activeElement = lineContainerRef.current.querySelector('[data-active-line="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentLineIndex]);

  // Clean up audio playback on unmount
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Update default character voices when scene characters change
  useEffect(() => {
    setCharacterVoices((prev) => {
      const updated = { ...prev };
      scene.characters.forEach((char, idx) => {
        if (!updated[char]) {
          updated[char] = getVoiceForCharacter(char, idx);
        }
      });
      return updated;
    });
  }, [scene.characters]);

  // --- BACKGROUND PRE-FETCHING FUNCTION ---
  const prefetchAiLine = useCallback(
    async (line: ScriptLine) => {
      if (
        !line ||
        audioCacheRef.current.has(line.id) ||
        prefetchingIdsRef.current.has(line.id) ||
        line.character === actorCharacter
      ) {
        return;
      }

      prefetchingIdsRef.current.add(line.id);

      try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const voiceName =
          characterVoices[line.character] ||
          getVoiceForCharacter(line.character, scene.characters.indexOf(line.character));

        const response = await fetch("/api/actor-copilot/tts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: line.dialogue,
            character: line.character,
            emotionNote: line.emotionNote,
            voiceName,
            sceneContext: scene.title,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.audioUrl) {
            audioCacheRef.current.set(line.id, data.audioUrl);
            const audioObj = new Audio(data.audioUrl);
            audioObj.preload = "auto";
            audioElementCacheRef.current.set(line.id, audioObj);
          }
        }
      } catch (err) {
        logger.warn({ err, msg: `Failed background prefetch for line ${line.id}` });
      } finally {
        prefetchingIdsRef.current.delete(line.id);
      }
    },
    [actorCharacter, characterVoices, scene.characters, scene.title]
  );

  // --- SEQUENTIAL BACKGROUND PRE-FETCHING ---
  useEffect(() => {
    if (!actorCharacter) return;

    let isCancelled = false;

    const prefetchQueue = async () => {
      // Prioritize prefetching upcoming AI lines relative to currentLineIndex sequentially
      const upcomingAiLines = scene.lines
        .slice(currentLineIndex)
        .filter((line) => line.character !== actorCharacter && !audioCacheRef.current.has(line.id))
        .slice(0, 6);

      for (const line of upcomingAiLines) {
        if (isCancelled) break;
        await prefetchAiLine(line);
      }
    };

    void prefetchQueue();

    return () => {
      isCancelled = true;
    };
  }, [actorCharacter, currentLineIndex, prefetchAiLine, scene.lines]);

  // --- AI LINE READING (TTS & PLAYBACK WITH INSTANT CACHE) ---
  const playAiLine = useCallback(
    async (line: ScriptLine) => {
      if (isAudioMuted) {
        setTimeout(() => {
          setCurrentLineIndex((prev) => Math.min(prev + 1, scene.lines.length));
        }, 400);
        return;
      }

      setStatus("AI_READING");
      setIsProcessing(true);
      setErrorMessage(null);

      try {
        let audioObj = audioElementCacheRef.current.get(line.id);
        let audioUrl = audioCacheRef.current.get(line.id);

        if (!audioUrl) {
          // Fallback if not pre-cached yet
          const auth = getAuth();
          const idToken = await auth.currentUser?.getIdToken();
          if (!idToken) throw new Error("Authentication token missing.");

          const voiceName =
            characterVoices[line.character] ||
            getVoiceForCharacter(line.character, scene.characters.indexOf(line.character));

          const response = await fetch("/api/actor-copilot/tts", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: line.dialogue,
              character: line.character,
              emotionNote: line.emotionNote,
              voiceName,
              sceneContext: scene.title,
            }),
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to generate AI speech");
          }

          const data = await response.json();
          audioUrl = data.audioUrl;
          if (audioUrl) {
            audioCacheRef.current.set(line.id, audioUrl);
            audioObj = new Audio(audioUrl);
            audioObj.preload = "auto";
            audioElementCacheRef.current.set(line.id, audioObj);
          }
        } else if (!audioObj) {
          audioObj = new Audio(audioUrl);
          audioObj.preload = "auto";
          audioElementCacheRef.current.set(line.id, audioObj);
        }

        if (!audioObj) throw new Error("No audio available for line.");

        currentAudioRef.current = audioObj;

        audioObj.onended = () => {
          setIsProcessing(false);
          setCurrentLineIndex((prev) => prev + 1);
        };

        audioObj.onerror = (e) => {
          logger.warn({ err: e, msg: "Audio element playback error" });
          setIsProcessing(false);
          setTimeout(() => {
            setCurrentLineIndex((prev) => prev + 1);
          }, 500);
        };

        audioObj.currentTime = 0;
        await audioObj.play();
      } catch (err: any) {
        logger.warn({ msg: "AI TTS line playback warning/error", errMessage: err?.message });
        setErrorMessage(err.message || "Could not play AI line audio.");
        setIsProcessing(false);

        // Advance line after short fallback delay so scene progression is never blocked
        setTimeout(() => {
          setCurrentLineIndex((prev) => prev + 1);
        }, 500);
      }
    },
    [characterVoices, isAudioMuted, scene.characters, scene.lines.length, scene.title]
  );

  // --- PREVIEW A SPECIFIC VOICE ---
  const handlePreviewVoice = async (voiceId: string, charName: string) => {
    if (previewingVoice) return;
    setPreviewingVoice(voiceId);

    try {
      const auth = getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      if (!idToken) throw new Error("Not authenticated.");

      const response = await fetch("/api/actor-copilot/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: `Hello, I'm ready to perform ${charName} with you.`,
          character: charName,
          voiceName: voiceId,
          emotionNote: "natural, friendly, conversational",
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to preview voice.");
      }

      const data = await response.json();
      if (!data.audioUrl) throw new Error("No audio payload returned.");

      const audio = new Audio(data.audioUrl);
      audio.onended = () => setPreviewingVoice(null);
      audio.onerror = () => setPreviewingVoice(null);
      await audio.play();
    } catch (err: any) {
      logger.warn({ msg: "Voice preview error", errMessage: err?.message });
      setPreviewingVoice(null);
    }
  };

  // --- REHEARSAL ENGINE STATE MACHINE STEP ---
  useEffect(() => {
    if (!actorCharacter) return;

    if (currentLineIndex >= scene.lines.length) {
      setStatus("FINISHED");
      return;
    }

    const line = scene.lines[currentLineIndex];
    if (!line) return;

    if (line.character === actorCharacter) {
      // It's the actor's turn! Wait for microphone input.
      setStatus("WAITING_FOR_ACTOR");
    } else {
      // It's the AI's turn!
      void playAiLine(line);
    }
  }, [actorCharacter, currentLineIndex, playAiLine, scene.lines]);

  // --- MICROPHONE RECORDING & STT ---
  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setStatus("TRANSCRIBING");
        setIsProcessing(true);

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);

        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(",")[1];
          try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Authentication token missing.");

            const response = await fetch("/api/dna/transcribe/chat", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ audioBase64: base64data, mimeType: audioBlob.type }),
            });

            if (!response.ok) {
              const errJson = await response.json().catch(() => ({}));
              throw new Error(errJson.error || "Failed to transcribe audio.");
            }

            const data = await response.json();
            const transcribedText = data.text || "";

            if (currentLine) {
              setTranscripts((prev) => ({
                ...prev,
                [currentLine.order]: transcribedText,
              }));

              // Fuzzy match what was said with script line
              setStatus("MATCHING_LINE");
              matchActorLine(currentLine.dialogue, transcribedText);
            }

            // Advance rehearsal to next line
            setCurrentLineIndex((prev) => prev + 1);
          } catch (error: any) {
            logger.error({ err: error, msg: "Transcription error during rehearsal" });
            setErrorMessage("Failed to recognize speech. Advancing line...");
            // Advance line anyway to avoid blocking actor
            setCurrentLineIndex((prev) => prev + 1);
          } finally {
            setIsProcessing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus("ACTOR_RECORDING");
    } catch (error: any) {
      logger.error({ err: error, msg: "Microphone permission denied" });
      setErrorMessage("Microphone access denied. Please grant mic permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleMicToggle = () => {
    if (isProcessing) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleResetRehearsal = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    if (isRecording) {
      stopRecording();
    }
    setCurrentLineIndex(0);
    setTranscripts({});
    setErrorMessage(null);
    setStatus("IDLE");
  };

  // Filter non-actor AI characters in scene
  const aiCharactersInScene = scene.characters.filter((c) => c !== actorCharacter);

  // --- STEP 1: CHARACTER SELECTION UI ---
  if (!actorCharacter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Clapperboard className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Choose Your Character</h2>
        <p className="text-muted-foreground mb-8 text-base">
          Select the part you will speak. The AI will play all other characters in the scene.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-8">
          {scene.characters.map((char) => (
            <button
              key={char}
              onClick={() => setActorCharacter(char)}
              className="flex items-center justify-between p-5 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {char[0]}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{char}</h3>
                  <span className="text-xs text-muted-foreground">
                    {scene.lines.filter((l) => l.character === char).length} lines in scene
                  </span>
                </div>
              </div>
              <UserCheck className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>

        {onExit && (
          <button
            onClick={onExit}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Return to auditions
          </button>
        )}
      </div>
    );
  }

  // --- STEP 2: INTERACTIVE REHEARSAL UI ---
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto p-4 sm:p-6 bg-background">
      {/* HEADER CONTROL BAR */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
              {scene.title}
            </span>
            {projectTitle && <span className="text-xs text-muted-foreground">• {projectTitle}</span>}
          </div>
          <h1 className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
            Rehearsing as <span className="text-primary font-black">{actorCharacter}</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* VOICE CUSTOMIZATION BUTTON */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
            title="Configure Scene Partner Voices"
          >
            <Settings2 size={16} className="text-primary" />
            <span className="hidden sm:inline">Partner Voices</span>
          </button>

          <button
            onClick={() => setIsAudioMuted((prev) => !prev)}
            className="p-2.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={isAudioMuted ? "Unmute AI audio" : "Mute AI audio"}
          >
            {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button
            onClick={handleResetRehearsal}
            className="p-2.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Restart Scene"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={() => setActorCharacter(null)}
            className="text-xs font-medium text-muted-foreground hover:text-primary px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Change Character
          </button>
        </div>
      </div>

      {/* SCRIPT DISPLAY CONTAINER (Visually Central) */}
      <div
        ref={lineContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 rounded-3xl border border-border bg-card/50 shadow-inner scrollbar-thin"
      >
        {scene.lines.map((line, index) => {
          const isActive = index === currentLineIndex;
          const isActorLine = line.character === actorCharacter;
          const isPastLine = index < currentLineIndex;
          const activeVoice = characterVoices[line.character] || getVoiceForCharacter(line.character);

          return (
            <div
              key={line.id}
              data-active-line={isActive}
              className={`p-5 rounded-2xl transition-all duration-300 ${
                isActive
                  ? isActorLine
                    ? "bg-primary/10 border-2 border-primary shadow-md scale-[1.01]"
                    : "bg-amber-500/10 border-2 border-amber-500/50 shadow-md scale-[1.01]"
                  : isPastLine
                  ? "opacity-60 bg-muted/30 border border-transparent"
                  : "opacity-40 border border-transparent"
              }`}
            >
              {/* Speaker Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isActorLine ? "text-primary" : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {line.character} {isActorLine ? "(YOU)" : "(AI)"}
                  </span>

                  {!isActorLine && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                      Voice: {activeVoice}
                      {audioCacheRef.current.has(line.id) && (
                        <span title="Pre-cached zero latency">
                          <Zap size={10} className="text-amber-500 fill-current" />
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {isActive && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary animate-pulse">
                    CURRENT LINE
                  </span>
                )}
                {isPastLine && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>

              {/* Dialogue Text */}
              <p
                className={`text-lg sm:text-xl font-serif leading-relaxed ${
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                "{line.dialogue}"
              </p>

              {/* Performance/Emotion note if available */}
              {line.emotionNote && isActive && (
                <div className="mt-2 text-xs italic text-muted-foreground/80 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                  <span>Direction: {line.emotionNote}</span>
                </div>
              )}

              {/* Actor Spoken Transcript Result */}
              {isPastLine && isActorLine && transcripts[line.order] && (
                <div className="mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">You said:</span> "{transcripts[line.order]}"
                </div>
              )}
            </div>
          );
        })}

        {status === "FINISHED" && (
          <div className="p-8 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 text-center animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-2xl font-bold text-foreground mb-1">Scene Rehearsal Complete!</h3>
            <p className="text-muted-foreground text-sm mb-6">Great job working through the scene.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleResetRehearsal}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-lg"
              >
                <RotateCcw size={16} /> Rehearse Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ERROR MESSAGE ALERT */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* FOOTER CONTROLS & MICROPHONE BUTTON */}
      <div className="pt-4 mt-2 flex flex-col items-center justify-center gap-3">
        {/* REHEARSAL STATUS BADGE */}
        <div className="h-8 flex items-center justify-center">
          {status === "AI_READING" && (
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-4 py-1 rounded-full border border-amber-500/20">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI is performing {currentLine?.character}'s line...</span>
            </div>
          )}

          {status === "WAITING_FOR_ACTOR" && (
            <div className="flex items-center gap-2 text-sm font-semibold text-primary bg-primary/10 px-4 py-1 rounded-full border border-primary/20 animate-pulse">
              <span>YOUR TURN — Press mic to speak line</span>
            </div>
          )}

          {status === "ACTOR_RECORDING" && (
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive bg-destructive/10 px-4 py-1 rounded-full border border-destructive/20 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-ping" />
              <span>Listening... Speak your line, then press mic again to finish</span>
            </div>
          )}

          {(status === "TRANSCRIBING" || status === "MATCHING_LINE") && (
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground bg-muted px-4 py-1 rounded-full border border-border">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing speech recognition...</span>
            </div>
          )}
        </div>

        {/* MAIN INTERACTIVE MIC CONTROL */}
        <div className="flex items-center justify-center gap-4 w-full">
          <button
            onClick={() => setCurrentLineIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentLineIndex === 0 || isProcessing}
            className="p-3 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-all"
            title="Previous Line"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={handleMicToggle}
            disabled={!isActorTurn || isProcessing}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform active:scale-95 ${
              isRecording
                ? "bg-destructive text-destructive-foreground animate-pulse scale-105"
                : isActorTurn
                ? "bg-primary text-primary-foreground hover:scale-105 shadow-primary/25"
                : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
            aria-label={isRecording ? "Stop recording" : "Start recording your line"}
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isRecording ? (
              <Square className="w-7 h-7 fill-current" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          <button
            onClick={() => setCurrentLineIndex((prev) => Math.min(scene.lines.length - 1, prev + 1))}
            disabled={currentLineIndex >= scene.lines.length - 1 || isProcessing}
            className="p-3 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-all"
            title="Next Line"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* VOICE SELECTION MODAL */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg text-foreground">Scene Partner Voice Settings</h3>
              </div>
              <button
                onClick={() => setIsVoiceModalOpen(false)}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-6">
              Customize the voice for each AI character reading partner in this scene. Click the test button to preview any voice.
            </p>

            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              {aiCharactersInScene.map((char) => {
                const currentVoiceId = characterVoices[char] || getVoiceForCharacter(char);
                return (
                  <div key={char} className="p-4 rounded-2xl border border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-foreground">{char}</span>
                      <span className="text-xs font-mono text-primary font-semibold">Voice: {currentVoiceId}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={currentVoiceId}
                        onChange={(e) =>
                          setCharacterVoices((prev) => ({
                            ...prev,
                            [char]: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        {AVAILABLE_GEMINI_VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} — {v.description}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handlePreviewVoice(currentVoiceId, char)}
                        disabled={previewingVoice === currentVoiceId}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                      >
                        {previewingVoice === currentVoiceId ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <AudioWaveform size={14} />
                        )}
                        <span>{previewingVoice === currentVoiceId ? "Testing..." : "Test"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <button
                onClick={() => setIsVoiceModalOpen(false)}
                className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-md"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
