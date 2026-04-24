export interface ActingCoachConfig {
  embeddingModel: string;
  embeddingDimension: number;
  generationModel: string;
  corpusDir: string;
  googleCloudProject: string;
  googleCloudLocation: string;
  pineconeApiKey: string;
  pineconeIndexName: string;
  pineconeNamespace: string;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function getEnvAsInt(name: string): number {
  const value = getEnv(name);
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid integer, got: ${value}`);
  }
  return parsed;
}

let cachedConfig: ActingCoachConfig | null = null;

export function getActingCoachConfig(): ActingCoachConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const embeddingModel = getEnv("ACTING_COACH_EMBEDDING_MODEL");
  const embeddingDimension = getEnvAsInt("ACTING_COACH_EMBEDDING_DIMENSION");
  const generationModel = getEnv("ACTING_COACH_GENERATION_MODEL");
  const corpusDir = getEnv("ACTING_COACH_CORPUS_DIR");
  const googleCloudProject = getEnv("GOOGLE_CLOUD_PROJECT");
  const googleCloudLocation = getEnv("GOOGLE_CLOUD_LOCATION");
  const pineconeApiKey = getEnv("PINECONE_API_KEY");
  const pineconeIndexName = getEnv("PINECONE_INDEX_NAME");
  const pineconeNamespace = getOptionalEnv("PINECONE_NAMESPACE", "");

  cachedConfig = {
    embeddingModel,
    embeddingDimension,
    generationModel,
    corpusDir,
    googleCloudProject,
    googleCloudLocation,
    pineconeApiKey,
    pineconeIndexName,
    pineconeNamespace,
  };

  return cachedConfig;
}

export const actingCoachConfig = getActingCoachConfig();
