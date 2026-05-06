const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('../config');

// Setup Pinecone client (will fail on execution if api key is mock/invalid)
const pc = new Pinecone({
  apiKey: config.PINECONE_API_KEY || 'dummy_api_key_update_in_env'
});

const indexName = config.PINECONE_INDEX_NAME;

async function upsertEmbeddings(docId, embeddings, extraMetadata = {}) {
  if (!embeddings || embeddings.length === 0) return;
  const index = pc.Index(indexName);

  const vectors = embeddings.map((emb, i) => ({
    id: `${docId}-chunk-${i}`,
    values: emb.embedding,
    metadata: {
      docId: docId,
      text: emb.text,
      chunkIndex: i,
      ...extraMetadata
    }
  }));

  // Upsert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert({ records: batch });
  }
}

async function querySimilarChunks(queryEmbedding, topK = 5, filter = null) {
  const index = pc.Index(indexName);
  const queryConfig = {
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  };

  if (filter) {
    queryConfig.filter = filter;
  }

  const response = await index.query(queryConfig);
  return response.matches;
}

async function deleteEmbeddings(docId) {
  const index = pc.Index(indexName);
  // Delete all vectors with this docId in metadata
  await index.deleteMany({
    filter: { docId: { $eq: docId } }
  });
}

module.exports = { upsertEmbeddings, querySimilarChunks, deleteEmbeddings, pc };
