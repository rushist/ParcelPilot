import dotenv from 'dotenv';
dotenv.config();

export const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/parcelpilot',
  qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  qdrantApiKey: process.env.QDRANT_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  llmApiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'gemini-1.5-flash-latest',
  embeddingApiKey: process.env.GEMINI_API_KEY || process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '',
  embeddingModel: process.env.EMBEDDING_MODEL || 'embedding-001',
  isDev: process.env.NODE_ENV !== 'production',
};

export function validateConfig() {
  const missing: string[] = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.qdrantUrl) missing.push('QDRANT_URL');
  return {
    isValid: missing.length === 0,
    missing,
  };
}
