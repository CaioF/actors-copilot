/**
 * Rotating loading text system.
 * Two categories: "ai" for AI/Coach waiting states, "ui" for general UI loading.
 */

export const LOADING_TEXTS = {
  ai: [
    "The Coach is analyzing your response...",
    "The Coach is rethinking the approach...",
    "The Coach is reviewing the next steps...",
    "The Coach is crafting a deeper question...",
    "The Coach is connecting the dots...",
    "The Coach is preparing your next moment...",
  ],
  ui: [
    "Preparing your studio...",
    "Loading your profile...",
    "Setting the stage...",
    "Getting everything ready...",
    "Warming up the lights...",
    "Cueing your entrance...",
  ],
} as const;

export type LoadingTextType = keyof typeof LOADING_TEXTS;
