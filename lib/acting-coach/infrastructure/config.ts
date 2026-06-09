export interface ActingCoachConfig {
  generationModel: string;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cachedConfig: ActingCoachConfig | null = null;

export function getActingCoachConfig(): ActingCoachConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const generationModel = getEnv("ACTING_COACH_GENERATION_MODEL");

  cachedConfig = {
    generationModel,
  };

  return cachedConfig;
}
