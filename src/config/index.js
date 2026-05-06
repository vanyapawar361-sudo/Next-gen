require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || 'rag-index',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'nova-enterprise-rag-secret-key-2025'
};
