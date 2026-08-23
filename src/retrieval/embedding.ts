import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../lib/config';

let genAIClient: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  if (genAIClient) return genAIClient;
  const apiKey = config.geminiApiKey || config.embeddingApiKey;
  if (apiKey && !apiKey.startsWith('sk-')) {
    genAIClient = new GoogleGenerativeAI(apiKey);
    return genAIClient;
  }
  return null;
}

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const apiKey = config.embeddingApiKey || config.llmApiKey;
  if (apiKey && apiKey.startsWith('sk-')) {
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
  }
  return null;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: config.embeddingModel || 'text-embedding-004' });
      const result = await model.embedContent(text.replace(/\n+/g, ' ').trim());
      const values = result.embedding.values;
      if (values && values.length > 0) {
        // Pad / normalize to 1536 for consistent Qdrant vector sizing if needed
        return normalizeToDimension(values, 1536);
      }
    } catch (err) {
      console.warn('Gemini embedding API call failed, falling back to deterministic generator:', err);
    }
  }

  const openai = getOpenAIClient();
  if (openai) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n+/g, ' ').trim(),
        dimensions: 1536,
      });
      return response.data[0].embedding;
    } catch (err) {
      console.warn('OpenAI Embedding API call failed, falling back to deterministic generator:', err);
    }
  }

  // High-dimensional deterministic embedding projection for offline / test environments
  return generateDeterministicEmbedding(text, 1536);
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const t of texts) {
    results.push(await generateEmbedding(t));
  }
  return results;
}

function normalizeToDimension(vector: number[], targetDim: number = 1536): number[] {
  if (vector.length === targetDim) return vector;

  const result = new Array(targetDim).fill(0);
  for (let i = 0; i < targetDim; i++) {
    result[i] = vector[i % vector.length];
  }

  // L2 Normalize
  let norm = 0;
  for (let i = 0; i < targetDim; i++) {
    norm += result[i] * result[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < targetDim; i++) {
      result[i] /= norm;
    }
  }
  return result;
}

/**
 * Deterministic bag-of-words / character-n-gram vector embedding generator (1536 dims)
 * Normalized with unit L2 norm for exact Cosine similarity support in Qdrant.
 */
export function generateDeterministicEmbedding(text: string, dimensions: number = 1536): number[] {
  const vec = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);

  // Unigram & bigram hashing with frequency weighting
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const hash = simpleHash(word);
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1.0;

    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      const biHash = simpleHash(bigram);
      const biIdx = Math.abs(biHash) % dimensions;
      vec[biIdx] += 1.5;
    }
  }

  // Character 3-grams for semantic substring matching
  for (let i = 0; i < text.length - 2; i++) {
    const tri = text.substring(i, i + 3).toLowerCase();
    const triHash = simpleHash(tri);
    const triIdx = Math.abs(triHash) % dimensions;
    vec[triIdx] += 0.2;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= norm;
    }
  } else {
    vec[0] = 1.0;
  }

  return vec;
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash;
}
