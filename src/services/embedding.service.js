const { pipeline, env } = require('@xenova/transformers');
const config = require('../config');

// Using standard remote cache for Xenova
env.cacheDir = './.cache/transformers';

let extractor = null;

async function getExtractor() {
  if (!extractor) {
    console.log('Loading local Xenova/all-MiniLM-L6-v2 model... (this happens once)');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractor;
}

/**
 * Generates embeddings for an array of text chunks using HuggingFace all-MiniLM-L6-v2 locally.
 */
async function generateEmbeddings(textChunks) {
  if (!textChunks || textChunks.length === 0) return [];
  const embeddings = [];
  
  try {
    const ext = await getExtractor();
    
    // Process in batches of 10 to speed up while keeping memory usage reasonable
    const batchSize = 10;
    for (let i = 0; i < textChunks.length; i += batchSize) {
      const batch = textChunks.slice(i, i + batchSize);
      const batchPromises = batch.map(async (text) => {
        const output = await ext(text, { pooling: 'mean', normalize: true });
        return {
          text,
          embedding: Array.from(output.data)
        };
      });
      
      const results = await Promise.all(batchPromises);
      embeddings.push(...results);
    }
    
    return embeddings;
  } catch (error) {
    console.error('Error in Xenova Embeddings pipeline:', error.message);
    throw error;
  }
}

async function generateQueryEmbedding(text) {
  const results = await generateEmbeddings([text]);
  return results[0].embedding;
}

module.exports = { generateEmbeddings, generateQueryEmbedding };
