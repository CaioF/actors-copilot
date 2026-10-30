"use client";

import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import {
  Mic,
  Square,
  Play,
  Pause,
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
  getHandsFreeEndpointDelayMs,
  getVoiceForCharacter,
  AVAILABLE_GEMINI_VOICES,
} from "@/lib/actor-copilot/script-parser";
import {
  ActorTake,
  ActorTakeStore,
  isUsableTake,
  pickRecorderMimeType,
} from "@/lib/actor-copilot/recordings";

type PlaybackSpeed = "slow" | "normal" | "fast";

const PLAYBACK_SPEEDS: { id: PlaybackSpeed; label: string; rate: number }[] = [
  { id: "slow", label: "Slow", rate: 0.85 },
  { id: "normal", label: "Normal", rate: 1.0 },
  { id: "fast", label: "Fast", rate: 1.1 },
];

const DEFAULT_PAUSE_MS = 1000;
const SHORT_LINE_PAUSE_MS = 800;
const EMOTIONAL_PAUSE_MS = 1200;
const TRAILING_OFF_PAUSE_MS = 1600;
const ERROR_ADVANCE_DELAY_MS = 500;
const MUTED_ADVANCE_DELAY_MS = 400;

/**
 * Pause applied after an AI line has finished playing, before the next AI line
 * starts. No pause is needed when the actor speaks next: their turn begins
 * as soon as the AI finishes.
 */
function getPauseAfterAiLine(line: ScriptLine, nextLine: ScriptLine | undefined, actorCharacter: string): number {
  if (!nextLine || nextLine.character === actorCharacter) return 0;

  const dialogue = line.dialogue.trim();
  if (/(\.\.\.|…|—)\s*["”']?$/.test(dialogue)) return TRAILING_OFF_PAUSE_MS;
  if (line.emotionNote) return EMOTIONAL_PAUSE_MS;
  if (dialogue.split(/\s+/).length <= 2) return SHORT_LINE_PAUSE_MS;
  return DEFAULT_PAUSE_MS;
}

/** Display-only script stage directions. Never spoken, matched, or assigned to a character. */
function StageDirections({ directions }: { directions?: string[] }) {
  if (!directions?.length) return null;
  return (
    <>
      {directions.map((direction, index) => (
        <p
          key={index}
          data-stage-direction
          className="px-5 text-sm italic leading-relaxed text-muted-foreground"
        >
          {direction}
        </p>
      ))}
    </>
  );
}

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

  // Hands-Free Auto Flow mode state
  const [isHandsFreeMode, setIsHandsFreeMode] = useState<boolean>(true);
  const [isHandsFreeListening, setIsHandsFreeListening] = useState<boolean>(false);

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

  // Audio level meter & Mic permission state
  const audioVolumeRef = useRef<number>(0);
  const [micPermissionError, setMicPermissionError] = useState<boolean>(false);

  // --- ACTOR SELF-RECORDING TAKES ---
  // The actor's own audio, kept per dialogue line so it can be played back
  // without repeating the scene. Session-scoped: a reload clears the takes.
  const takeStoreRef = useRef<ActorTakeStore | null>(null);
  if (takeStoreRef.current === null) {
    takeStoreRef.current = new ActorTakeStore();
  }
  const [takes, setTakes] = useState<ActorTake[]>([]);
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
  const [isMicReady, setIsMicReady] = useState<boolean>(false);
  const [rerecordLineId, setRerecordLineId] = useState<string | null>(null);
  const takePlaybackRef = useRef<HTMLAudioElement | null>(null);

  // Background Audio Pre-fetch Cache for Zero-Latency AI turns
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const audioElementCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const prefetchingIdsRef = useRef<Set<string>>(new Set());

  // Audio & Mic refs & Hands-Free timers
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lineContainerRef = useRef<HTMLDivElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdvancingRef = useRef<boolean>(false);
  const isUnmountedRef = useRef<boolean>(false);
  const discardRecordingRef = useRef<boolean>(false);

  // Playback pacing: speed preference, inter-line pause timer and session guards
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>("normal");
  const [rehearsalSession, setRehearsalSession] = useState<number>(0);
  const sessionRef = useRef<number>(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedLineKeyRef = useRef<string | null>(null);
  const playbackRateRef = useRef<number>(1);
  playbackRateRef.current = PLAYBACK_SPEEDS.find((s) => s.id === playbackSpeed)?.rate ?? 1;

  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const currentLine: ScriptLine | undefined = scene.lines[currentLineIndex];
  const isActorTurn = actorCharacter && currentLine ? currentLine.character === actorCharacter : false;

  // --- REAL-TIME MICROPHONE STREAM & AUDIO LEVEL ANALYZER ---
  useEffect(() => {
    if (!actorCharacter || status === "FINISHED") {
      setIsMicReady(false);
      return;
    }

    let isSubscribed = true;

    const setupMicStream = async () => {
      try {
        if (!micStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!isSubscribed) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          micStreamRef.current = stream;
        }

        setMicPermissionError(false);
        setIsMicReady(true);

        // Setup Web Audio API Analyser for real-time visual feedback
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx && micStreamRef.current) {
          if (!audioContextRef.current || audioContextRef.current.state === "closed") {
            audioContextRef.current = new AudioCtx();
          }
          if (audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
          }

          const ctx = audioContextRef.current;

          if (!analyserRef.current) {
            const source = ctx.createMediaStreamSource(micStreamRef.current);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;
          }

          const analyser = analyserRef.current;
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateVolume = () => {
            if (!isSubscribed) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            audioVolumeRef.current = Math.min(100, Math.round((average / 128) * 100));

            animFrameRef.current = requestAnimationFrame(updateVolume);
          };

          updateVolume();
        }
      } catch (err: any) {
        logger.warn({ msg: "Microphone permission error for rehearsal", errMessage: err?.message });
        if (isSubscribed) {
          setMicPermissionError(true);
        }
      }
    };

    void setupMicStream();

    return () => {
      isSubscribed = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [actorCharacter, status]);

  // Auto-scroll active line into view smoothly
  useEffect(() => {
    if (lineContainerRef.current) {
      const activeElement = lineContainerRef.current.querySelector('[data-active-line="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentLineIndex]);

  // Invalidates the current session, stops audio and clears any pending "next line" timer
  const cancelPendingPlayback = useCallback(() => {
    sessionRef.current += 1;
    startedLineKeyRef.current = null;
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  // --- ACTOR TAKE PLAYBACK ---
  // Plays the actor's own recording. It uses a dedicated audio element, so it
  // never triggers AI speech and never advances the rehearsal.
  const stopTakePlayback = useCallback(() => {
    if (takePlaybackRef.current) {
      takePlaybackRef.current.onended = null;
      takePlaybackRef.current.onerror = null;
      takePlaybackRef.current.pause();
      takePlaybackRef.current.removeAttribute("src");
      takePlaybackRef.current = null;
    }
    setPlayingTakeId(null);
  }, []);

  // Keeps the actor's captured audio for a dialogue line. A new recording for
  // the same line replaces the previous one (take number goes up).
  const storeTake = useCallback((lineId: string, blob: Blob, mimeType?: string) => {
    if (!isUsableTake(blob)) return null;
    const store = takeStoreRef.current;
    if (!store) return null;
    const take = store.put(lineId, blob, mimeType);
    if (take) {
      setTakes(store.list());
      setRerecordLineId((prev) => (prev === lineId ? null : prev));
    }
    return take;
  }, []);

  const toggleTakePlayback = useCallback(
    async (take: ActorTake) => {
      const existing = takePlaybackRef.current;

      if (existing && existing.dataset.lineId === take.lineId) {
        if (existing.paused) {
          try {
            await existing.play();
            setPlayingTakeId(take.lineId);
          } catch (err) {
            logger.warn({ msg: "Could not resume actor take playback", err });
            setPlayingTakeId(null);
          }
        } else {
          existing.pause();
          setPlayingTakeId(null);
        }
        return;
      }

      stopTakePlayback();

      const audio = new Audio(take.url);
      audio.dataset.lineId = take.lineId;
      audio.preload = "auto";
      takePlaybackRef.current = audio;

      audio.onended = () => {
        if (takePlaybackRef.current === audio) takePlaybackRef.current = null;
        setPlayingTakeId(null);
      };

      audio.onerror = () => {
        logger.warn({ msg: "Actor take playback error" });
        if (takePlaybackRef.current === audio) takePlaybackRef.current = null;
        setPlayingTakeId(null);
        setErrorMessage("Could not play your recording. Please record it again.");
      };

      try {
        await audio.play();
        setPlayingTakeId(take.lineId);
      } catch (err) {
        logger.warn({ msg: "Actor take playback could not start", err });
        if (takePlaybackRef.current === audio) takePlaybackRef.current = null;
        setPlayingTakeId(null);
        setErrorMessage("Could not play your recording. Please record it again.");
      }
    },
    [stopTakePlayback]
  );

  // Re-record: jump back to the line so the actor can capture a new take
  // without replaying the whole scene. The new take replaces the old one.
  const handleRerecord = useCallback(
    (line: ScriptLine, lineIndex: number) => {
      stopTakePlayback();
      setRerecordLineId(line.id);
      setCurrentLineIndex(lineIndex);
      setStatus("WAITING_FOR_ACTOR");
    },
    [stopTakePlayback]
  );

  // Apply speed changes immediately to a line that is already playing
  useEffect(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.playbackRate = playbackRateRef.current;
    }
  }, [playbackSpeed]);

  // Clean up audio playback and timers on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      cancelPendingPlayback();
      stopTakePlayback();
      takeStoreRef.current?.clear();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
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
    async (line: ScriptLine, lineIndex: number) => {
      const sessionId = sessionRef.current;
      const isStale = () => sessionRef.current !== sessionId;

      // Moves to the next line only if this session is still current and the
      // rehearsal is still on the line that just finished.
      const advanceAfter = (delayMs: number) => {
        const advance = () => {
          pauseTimerRef.current = null;
          if (isStale()) return;
          setCurrentLineIndex((prev) => (prev === lineIndex ? prev + 1 : prev));
        };
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        if (delayMs <= 0) {
          advance();
        } else {
          pauseTimerRef.current = setTimeout(advance, delayMs);
        }
      };

      if (isAudioMuted) {
        advanceAfter(MUTED_ADVANCE_DELAY_MS);
        return;
      }

      // Never let two dialogue lines play at once
      if (currentAudioRef.current) {
        currentAudioRef.current.onended = null;
        currentAudioRef.current.onerror = null;
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // The AI takes the floor: stop any actor take that was still playing so
      // the two voices never overlap.
      stopTakePlayback();

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

        // Rehearsal was restarted, stopped or unmounted while audio was loading
        if (isStale()) return;
        if (!audioObj) throw new Error("No audio available for line.");

        currentAudioRef.current = audioObj;

        // The pause starts only once the browser reports the line has finished playing
        audioObj.onended = () => {
          if (isStale()) return;
          setIsProcessing(false);
          advanceAfter(getPauseAfterAiLine(line, scene.lines[lineIndex + 1], actorCharacter ?? ""));
        };

        audioObj.onerror = (e) => {
          logger.warn({ err: e, msg: "Audio element playback error" });
          if (isStale()) return;
          setIsProcessing(false);
          advanceAfter(ERROR_ADVANCE_DELAY_MS);
        };

        audioObj.currentTime = 0;
        audioObj.playbackRate = playbackRateRef.current;
        audioObj.preservesPitch = true;
        await audioObj.play();
      } catch (err: any) {
        if (isStale()) return;
        logger.warn({ msg: "AI TTS line playback warning/error", errMessage: err?.message });
        setErrorMessage(err.message || "Could not play AI line audio.");
        setIsProcessing(false);

        // Advance line after short fallback delay so scene progression is never blocked
        advanceAfter(ERROR_ADVANCE_DELAY_MS);
      }
    },
    [actorCharacter, characterVoices, isAudioMuted, scene.characters, scene.lines, scene.title, stopTakePlayback]
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
      // It's the AI's turn! Each line starts once per session, even if
      // playAiLine is re-created (e.g. voice change or mute toggle mid-line).
      const lineKey = `${sessionRef.current}:${currentLineIndex}`;
      if (startedLineKeyRef.current === lineKey) return;
      startedLineKeyRef.current = lineKey;
      void playAiLine(line, currentLineIndex);
    }
  }, [actorCharacter, currentLineIndex, playAiLine, scene.lines, rehearsalSession]);

  // --- HANDS-FREE AUTOMATIC LINE ADVANCE FUNCTION ---
  const completeActorTurn = useCallback(
    (spokenText: string) => {
      if (isAdvancingRef.current) return;
      isAdvancingRef.current = true;

      // Clean up active speech recognition instance
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.onresult = null;
          speechRecognitionRef.current.onend = null;
          speechRecognitionRef.current.onerror = null;
          speechRecognitionRef.current.stop();
        } catch (_) {
          // Ignore errors if recognition already stopped
        }
        speechRecognitionRef.current = null;
      }
      setIsHandsFreeListening(false);

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      if (currentLine) {
        setTranscripts((prev) => ({
          ...prev,
          [currentLine.order]: spokenText || "Spoken line recognized",
        }));
      }

      setStatus("MATCHING_LINE");

      const sessionId = sessionRef.current;
      setTimeout(() => {
        isAdvancingRef.current = false;
        if (sessionRef.current !== sessionId) return;
        setCurrentLineIndex((prev) => prev + 1);
      }, 250);
    },
    [currentLine]
  );

  // --- HANDS-FREE AUTOMATIC SPEECH RECOGNITION ENGINE ---
  // Latest line/handlers live in refs so the recognizer is only rebuilt when the
  // turn itself changes, never on unrelated re-renders.
  const currentLineRef = useRef<ScriptLine | undefined>(currentLine);
  currentLineRef.current = currentLine;
  const completeActorTurnRef = useRef(completeActorTurn);
  completeActorTurnRef.current = completeActorTurn;

  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    const isListeningTurn = !!actorCharacter && isActorTurn && isHandsFreeMode && !isProcessing;
    if (!isListeningTurn) {
      setIsHandsFreeListening(false);
      return;
    }

    if (!SpeechRecognitionAPI) {
      setErrorMessage(
        "Voice recognition is not supported in this browser. Turn off Auto-Flow to use the mic button."
      );
      return;
    }

    const VOICE_ACTIVITY_VOLUME = 15;
    const START_DELAY_MS = 300;
    const RESTART_DELAY_MS = 250;
    const MAX_QUICK_FAILURES = 5;

    let disposed = false;
    let finished = false;
    let fatal = false;
    let recognition: any = null;
    let committedText = "";
    let sessionText = "";
    let lastActivityAt = Date.now();
    let quickFailures = 0;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;

    const getSpokenText = () => `${committedText} ${sessionText}`.trim();

    const startRecognition = () => {
      if (disposed || fatal) return;

      const instance = new SpeechRecognitionAPI();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = "en-US";
      recognition = instance;
      speechRecognitionRef.current = instance;
      const startedAt = Date.now();
      sessionText = "";

      instance.onstart = () => {
        setIsHandsFreeListening(true);
        setErrorMessage(null);
      };

      instance.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const trimmed = transcript.trim();
        if (!trimmed) return;
        sessionText = trimmed;
        lastActivityAt = Date.now();
        quickFailures = 0;
      };

      instance.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
          setMicPermissionError(true);
          fatal = true;
        }
        logger.warn({ msg: "Hands-free SpeechRecognition error", error: event.error });
      };

      instance.onend = () => {
        setIsHandsFreeListening(false);
        committedText = getSpokenText();
        sessionText = "";
        if (disposed || finished || fatal) return;

        if (Date.now() - startedAt < 1000) quickFailures += 1;
        if (quickFailures >= MAX_QUICK_FAILURES) {
          fatal = true;
          setErrorMessage("Voice recognition keeps stopping. Turn off Auto-Flow to use the mic button.");
          return;
        }
        restartTimer = setTimeout(startRecognition, RESTART_DELAY_MS);
      };

      try {
        instance.start();
      } catch (err: any) {
        logger.warn({ msg: "Could not start SpeechRecognition", errMessage: err?.message });
        setIsHandsFreeListening(false);
      }
    };

    // End-of-speech detection: the turn only completes after the actor has been
    // silent (no new words and no voice on the mic) for longer than the endpoint
    // delay, which is long for unfinished lines so natural pauses never cut them off.
    const endpointTimer = setInterval(() => {
      if (disposed || finished) return;
      if (audioVolumeRef.current > VOICE_ACTIVITY_VOLUME) {
        lastActivityAt = Date.now();
      }
      const spoken = getSpokenText();
      const line = currentLineRef.current;
      if (!spoken || !line) return;

      const endpointDelay = getHandsFreeEndpointDelayMs(line.dialogue, spoken);
      if (Date.now() - lastActivityAt >= endpointDelay) {
        finished = true;
        completeActorTurnRef.current(spoken);
      }
    }, 150);

    startTimer = setTimeout(startRecognition, START_DELAY_MS);

    return () => {
      disposed = true;
      clearInterval(endpointTimer);
      if (startTimer) clearTimeout(startTimer);
      if (restartTimer) clearTimeout(restartTimer);
      if (recognition) {
        try {
          recognition.onstart = null;
          recognition.onresult = null;
          recognition.onend = null;
          recognition.onerror = null;
          recognition.stop();
        } catch (_) {
          // Recognition may already be stopped
        }
        if (speechRecognitionRef.current === recognition) {
          speechRecognitionRef.current = null;
        }
      }
    };
  }, [actorCharacter, currentLineIndex, isActorTurn, isHandsFreeMode, isProcessing]);

  // --- ACTOR VOICE CAPTURE DURING HANDS-FREE ---
  // Hands-Free only transcribes what the actor says; it never keeps the audio.
  // We record the very same microphone stream in parallel so the actor can
  // play back their own voice on the line they just delivered. Capture
  // failures stay silent: they must never interrupt the recognition loop.
  useEffect(() => {
    if (!actorCharacter || !isActorTurn || !isHandsFreeMode || !isMicReady) return;

    const line = currentLine;
    const stream = micStreamRef.current;
    if (!line || !stream || typeof MediaRecorder === "undefined") return;

    const mimeType = pickRecorderMimeType();
    let recorder: MediaRecorder;

    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      logger.warn({ msg: "Could not create actor take recorder", err });
      return;
    }

    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      if (isUnmountedRef.current) return;
      const blob = new Blob(chunks, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      storeTake(line.id, blob, blob.type);
    };

    recorder.onerror = () => {
      logger.warn({ msg: "Actor take recorder error" });
    };

    try {
      recorder.start();
    } catch (err) {
      logger.warn({ msg: "Could not start actor take recorder", err });
      return;
    }

    return () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch (_) {
        // Recorder may already be stopped
      }
    };
  }, [actorCharacter, currentLine, isActorTurn, isHandsFreeMode, isMicReady, storeTake]);

  // --- MICROPHONE RECORDING & STT ---
  const startRecording = async () => {
    setErrorMessage(null);

    // The dialogue line is captured at recording time, so the audio can never
    // end up attached to a different line if the rehearsal moves on meanwhile.
    const recordedLine = currentLine;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      let mediaRecorder: MediaRecorder;

      try {
        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (err) {
        logger.warn({ msg: "Recorder mime type rejected, using default", err });
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setStatus("TRANSCRIBING");
        setIsProcessing(true);

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || mimeType || "audio/webm",
        });

        // Keep the actor's own audio for this exact line so it can be played
        // back later. This is the actor's voice, never AI-generated audio.
        if (recordedLine && !discardRecordingRef.current) {
          storeTake(recordedLine.id, audioBlob, audioBlob.type);
        }
        discardRecordingRef.current = false;

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

            if (recordedLine) {
              setTranscripts((prev) => ({
                ...prev,
                [recordedLine.order]: transcribedText,
              }));

              // Fuzzy match what was said with script line
              setStatus("MATCHING_LINE");
              matchActorLine(recordedLine.dialogue, transcribedText);
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
    cancelPendingPlayback();
    stopTakePlayback();
    setRehearsalSession(sessionRef.current);
    setIsProcessing(false);
    if (isRecording) {
      // The pending recorder callback must not store a take for the session we
      // are dropping right now.
      discardRecordingRef.current = true;
      stopRecording();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {
        // Ignore errors if recognition already stopped
      }
      speechRecognitionRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isAdvancingRef.current = false;
    setIsHandsFreeListening(false);
    setCurrentLineIndex(0);
    setTranscripts({});
    setErrorMessage(null);
    setStatus("IDLE");

    // A restart is a brand new session: the previous takes are dropped so no
    // stale recording can be played back as part of the new rehearsal.
    takeStoreRef.current?.clear();
    setTakes([]);
    setRerecordLineId(null);
  };

  // Filter non-actor AI characters in scene
  const aiCharactersInScene = scene.characters.filter((c) => c !== actorCharacter);

  // Actor takes, kept in state so the UI re-renders when a take is stored,
  // replaced or cleared.
  const takesByLineId = useMemo(() => new Map(takes.map((take) => [take.lineId, take])), [takes]);

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
      <header className="flex flex-col gap-4 border-b border-border pb-4 mb-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="max-w-full truncate text-xs font-semibold uppercase tracking-wider text-primary px-2.5 py-1 rounded-full bg-primary/10">
              {scene.title}
            </span>
            {projectTitle && (
              <span className="truncate text-xs text-muted-foreground">{projectTitle}</span>
            )}
          </div>
          <h1 className="flex flex-wrap items-baseline gap-x-2 text-xl sm:text-2xl font-bold leading-tight text-foreground">
            <span>Rehearsing as</span>
            <span className="text-primary font-black">{actorCharacter}</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* HANDS-FREE AUTO FLOW TOGGLE */}
            <button
              onClick={() => setIsHandsFreeMode((prev) => !prev)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full border text-xs font-bold transition-all shadow-sm ${
                isHandsFreeMode
                  ? "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 shadow-primary/10"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
              title={isHandsFreeMode ? "Hands-Free Auto Flow Active" : "Switch to Hands-Free Auto Flow"}
            >
              <Zap size={15} className={isHandsFreeMode ? "text-primary fill-current animate-pulse" : "text-muted-foreground"} />
              <span>{isHandsFreeMode ? "Auto-Flow ON" : "Auto-Flow OFF"}</span>
            </button>

            {/* VOICE CUSTOMIZATION BUTTON */}
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
              title="Configure Scene Partner Voices"
              aria-label="Partner Voices"
            >
              <Settings2 size={16} className="text-primary" />
              <span className="hidden sm:inline">Partner Voices</span>
            </button>

            {/* AI PLAYBACK SPEED */}
            <div
              role="group"
              aria-label="AI voice speed"
              className="flex shrink-0 items-center rounded-full border border-border bg-card p-0.5 shadow-sm"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed.id}
                  type="button"
                  onClick={() => setPlaybackSpeed(speed.id)}
                  aria-pressed={playbackSpeed === speed.id}
                  title={`${speed.label} (${speed.rate}x)`}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    playbackSpeed === speed.id
                      ? "bg-primary/15 text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {speed.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAudioMuted((prev) => !prev)}
              className="p-2.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={isAudioMuted ? "Unmute AI audio" : "Mute AI audio"}
              aria-label={isAudioMuted ? "Unmute AI audio" : "Mute AI audio"}
            >
              {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              onClick={handleResetRehearsal}
              className="p-2.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Restart Scene"
              aria-label="Restart Scene"
            >
              <RotateCcw size={18} />
            </button>

            <button
              onClick={() => {
                cancelPendingPlayback();
                setIsProcessing(false);
                setActorCharacter(null);
              }}
              className="whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-primary px-4 py-2.5 rounded-full border border-border hover:bg-muted transition-colors"
            >
              Change Character
            </button>
          </div>
        </div>
      </header>

      {/* SCRIPT DISPLAY CONTAINER (Visually Central) */}
      <div
        ref={lineContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 rounded-3xl border border-border bg-card/50 shadow-inner scrollbar-thin"
      >
        {scene.lines.map((line, index) => {
          const isActive = index === currentLineIndex;
          const isActorLine = line.character === actorCharacter;
          const isPastLine = index < currentLineIndex;
          const take = isActorLine ? takesByLineId.get(line.id) : undefined;
          const isPlayingThisTake = !!take && playingTakeId === line.id;
          const activeVoice =
            characterVoices[line.character] ||
            getVoiceForCharacter(line.character, scene.characters.indexOf(line.character));

          return (
            <Fragment key={line.id}>
            <StageDirections directions={line.directionsBefore} />
            <div
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

              {/* Actor's own recording of this line */}
              {isActorLine && take && (
                <div className="mt-3 pt-2 border-t border-border/50 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void toggleTakePlayback(take)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                    title={
                      isPlayingThisTake
                        ? "Pause your own recording"
                        : "Play your own recording of this line"
                    }
                    aria-label={
                      isPlayingThisTake
                        ? `Pause your recording of line ${line.order}`
                        : `Play your recording of line ${line.order}`
                    }
                  >
                    {isPlayingThisTake ? <Pause size={13} /> : <Play size={13} />}
                    <span>{isPlayingThisTake ? "Pause" : "Play my take"}</span>
                  </button>

                  <button
                    onClick={() => handleRerecord(line, index)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-muted transition-colors"
                    title="Record this line again. The new take replaces the previous one."
                  >
                    <RotateCcw size={13} />
                    <span>Record again</span>
                  </button>

                  <span className="text-[10px] text-muted-foreground">
                    Take {take.takeNumber} · your voice
                    {take.takeNumber > 1 ? " (replaces the previous take)" : ""}
                  </span>

                  {rerecordLineId === line.id && (
                    <span className="text-[10px] font-semibold text-primary">
                      Re-recording — the new take replaces take {take.takeNumber}
                    </span>
                  )}
                </div>
              )}
            </div>
            </Fragment>
          );
        })}

        <StageDirections directions={scene.trailingDirections} />

        {status === "FINISHED" && (
          <div className="p-8 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/30 text-center animate-in fade-in">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-2xl font-bold text-foreground mb-1">Scene Rehearsal Complete!</h3>
            <p className="text-muted-foreground text-sm mb-6">Great job working through the scene.</p>

            {/* REVIEW: the actor's own recordings of this session */}
            {takes.length > 0 && (
              <div className="mb-6 text-left">
                <h4 className="text-sm font-bold text-foreground mb-1">Your recordings</h4>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Play back your own voice line by line. Takes are kept for this session only —
                  rehearsing again clears them.
                </p>
                <div className="space-y-2">
                  {takes.map((take) => {
                    const line = scene.lines.find((item) => item.id === take.lineId);
                    const isPlayingThisTake = playingTakeId === take.lineId;

                    return (
                      <div
                        key={take.lineId}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                      >
                        <button
                          onClick={() => void toggleTakePlayback(take)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors shrink-0"
                          title={
                            isPlayingThisTake
                              ? "Pause your own recording"
                              : "Play your own recording of this line"
                          }
                          aria-label={
                            isPlayingThisTake
                              ? `Pause your recording of line ${line?.order ?? take.lineId}`
                              : `Play your recording of line ${line?.order ?? take.lineId}`
                          }
                        >
                          {isPlayingThisTake ? <Pause size={13} /> : <Play size={13} />}
                          <span>{isPlayingThisTake ? "Pause" : "Play"}</span>
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {line ? `"${line.dialogue}"` : "Recorded line"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {line ? `${line.character} · ` : ""}Take {take.takeNumber} · your voice
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

      {/* MIC PERMISSION ALERT */}
      {micPermissionError && (
        <div className="mt-3 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-amber-500" />
            <span>
              Microphone access is needed for hands-free speech recognition. Please allow microphone permissions in your browser address bar.
            </span>
          </div>
          <button
            onClick={() => {
              navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
                micStreamRef.current = stream;
                setMicPermissionError(false);
              }).catch(() => {
                // permission still denied; keep the error visible
              });
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-amber-950 font-bold hover:bg-amber-400 transition-colors shrink-0 shadow-sm"
          >
            Grant Mic Access
          </button>
        </div>
      )}

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

          {(status === "WAITING_FOR_ACTOR" || status === "HANDS_FREE_LISTENING") && isHandsFreeMode && (
            <div className="flex items-center gap-2 text-sm font-semibold text-primary bg-primary/15 px-4 py-1 rounded-full border border-primary/30 shadow-sm animate-pulse">
              <Zap size={14} className="fill-current text-primary" />
              <span>HANDS-FREE ACTIVE — Speak your line out loud</span>
            </div>
          )}

          {status === "WAITING_FOR_ACTOR" && !isHandsFreeMode && (
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
                : isHandsFreeListening
                ? "bg-primary text-primary-foreground animate-pulse ring-4 ring-primary/30 scale-105 shadow-primary/30"
                : isActorTurn
                ? "bg-primary text-primary-foreground hover:scale-105 shadow-primary/25"
                : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
            }`}
            aria-label={
              isRecording
                ? "Stop recording"
                : isHandsFreeListening
                ? "Hands-Free Listening Active"
                : "Start recording your line"
            }
          >
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isRecording ? (
              <Square className="w-7 h-7 fill-current" />
            ) : isHandsFreeListening ? (
              <AudioWaveform className="w-8 h-8 animate-pulse" />
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
                const currentVoiceId =
                  characterVoices[char] || getVoiceForCharacter(char, scene.characters.indexOf(char));
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
