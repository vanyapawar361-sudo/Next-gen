const { Worker } = require('bullmq');
const config = require('../config');
const db = require('../services/db.service');
const extractionService = require('../services/extraction.service');
const chunkingService = require('../services/chunking.service');
const embeddingService = require('../services/embedding.service');
const vectorDbService = require('../services/vectorDb.service');
const llmService = require('../services/llm.service');
const ioredis = require('ioredis');

const connection = new ioredis(config.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker('document-processing', async (job) => {
  const { docId } = job.data;
  console.log(`[Job ${job.id}] Started processing document: ${docId}`);
  
  try {
    // 1. Fetch document from DB
    const document = await db.findOne('documents', { id: docId });
    if (!document) {
      throw new Error(`Document ${docId} not found`);
    }

    // Update status to processing
    await db.update('documents', { id: docId }, { status: 'processing' });
    
    const metadata = {
      ownerId: document.ownerId,
      category: document.category || 'General',
      requiredRole: document.requiredRole || 'Employee',
      filename: document.filename
    };
    
    // 2. Extract Text
    console.log(`[Job ${job.id}] Extracting text for ${document.filename}...`);
    const rawText = await extractionService.extractText(document.path, document.mimetype);
    
    // Store extracted text into DB (or file storage)
    await db.update('documents', { id: docId }, { 
      extractedText: rawText,
      extractedAt: new Date().toISOString()
    });

    // 3. Generate Summary FIRST (Fast Groq API) so UI updates immediately!
    console.log(`[Job ${job.id}] Generating summary...`);
    try {
      const summaries = await llmService.generateSummary(rawText);
      await db.insert('summaries', {
        docId,
        shortSummary: summaries.shortSummary,
        detailedSummary: summaries.detailedSummary,
        createdAt: new Date().toISOString()
      });
      console.log(`[Job ${job.id}] Summaries generated and saved!`);
    } catch (err) {
      console.warn(`[Job ${job.id}] Skipping summary due to API key or config error: ${err.message}`);
    }

    // 4. Chunking Text
    console.log(`[Job ${job.id}] Chunking text...`);
    const chunks = chunkingService.chunkText(rawText);
    
    // 5. Generating Embeddings (Slow locally) and 6. Save to Vector DB
    console.log(`[Job ${job.id}] Generating embeddings for ${chunks.length} chunks...`);
    try {
      const embeddingResults = await embeddingService.generateEmbeddings(chunks);
      console.log(`[Job ${job.id}] Upserting to Vector DB...`);
      await vectorDbService.upsertEmbeddings(docId, embeddingResults, metadata);
      console.log(`[Job ${job.id}] Vector DB Upsert successful!`);
    } catch (err) {
      console.warn(`[Job ${job.id}] Skipping embeddings step due to API key or config error: ${err.message}`);
    }

    // Finally, Update status to completed
    await db.update('documents', { id: docId }, { status: 'completed' });

    console.log(`[Job ${job.id}] Finished task sequence for document: ${docId}`);
  } catch (error) {
    console.error(`[Job ${job.id}] Failed:`, error.message);
    await db.update('documents', { id: docId }, { status: 'failed', error: error.message });
    throw error;
  }
}, { 
  connection,
  lockDuration: 600000 // 10 mins to allow heavy Xenova event loop blocks
});

worker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});

console.log('Worker is running and waiting for jobs...');

module.exports = worker;
