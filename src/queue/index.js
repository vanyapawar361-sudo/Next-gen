const db = require('../services/db.service');
const extractionService = require('../services/extraction.service');
const chunkingService = require('../services/chunking.service');
const embeddingService = require('../services/embedding.service');
const vectorDbService = require('../services/vectorDb.service');
const llmService = require('../services/llm.service');

const processingQueue = [];
let isProcessing = false;

async function processDocument(jobData) {
  const { docId } = jobData;
  const jobId = Math.random().toString(36).substring(7);
  console.log(`[Job ${jobId}] Started processing document: ${docId}`);
  
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
    console.log(`[Job ${jobId}] Extracting text for ${document.filename}...`);
    const rawText = await extractionService.extractText(document.path, document.mimetype);
    
    // Store extracted text into DB (or file storage)
    await db.update('documents', { id: docId }, { 
      extractedText: rawText,
      extractedAt: new Date().toISOString()
    });

    // 3. Generate Summary FIRST (Fast Groq API) so UI updates immediately!
    console.log(`[Job ${jobId}] Generating summary...`);
    try {
      const summaries = await llmService.generateSummary(rawText);
      await db.insert('summaries', {
        docId,
        shortSummary: summaries.shortSummary,
        detailedSummary: summaries.detailedSummary,
        createdAt: new Date().toISOString()
      });
      console.log(`[Job ${jobId}] Summaries generated and saved!`);
    } catch (err) {
      console.warn(`[Job ${jobId}] Skipping summary due to API key or config error: ${err.message}`);
    }

    // 4. Chunking Text
    console.log(`[Job ${jobId}] Chunking text...`);
    const chunks = chunkingService.chunkText(rawText);
    
    // 5. Generating Embeddings (Slow locally) and 6. Save to Vector DB
    console.log(`[Job ${jobId}] Generating embeddings for ${chunks.length} chunks...`);
    try {
      const embeddingResults = await embeddingService.generateEmbeddings(chunks);
      console.log(`[Job ${jobId}] Upserting to Vector DB...`);
      await vectorDbService.upsertEmbeddings(docId, embeddingResults, metadata);
      console.log(`[Job ${jobId}] Vector DB Upsert successful!`);
    } catch (err) {
      console.warn(`[Job ${jobId}] Skipping embeddings step due to API key or config error: ${err.message}`);
    }

    // Finally, Update status to completed
    await db.update('documents', { id: docId }, { status: 'completed' });

    console.log(`[Job ${jobId}] Finished task sequence for document: ${docId}`);
  } catch (error) {
    console.error(`[Job ${jobId}] Failed:`, error.message);
    await db.update('documents', { id: docId }, { status: 'failed', error: error.message });
  }
}

async function processNext() {
  if (isProcessing || processingQueue.length === 0) return;
  isProcessing = true;
  const job = processingQueue.shift();
  try {
    await processDocument(job);
  } catch (err) {
    console.error("Error in queue processor:", err);
  } finally {
    isProcessing = false;
    processNext();
  }
}

async function addDocumentJob(docId) {
  processingQueue.push({ docId });
  processNext();
  return { id: `in-memory-${Date.now()}` };
}

async function removeDocumentJobs(docId) {
  // Try finding and removing from in-memory queue
  for (let i = processingQueue.length - 1; i >= 0; i--) {
     if (processingQueue[i].docId === docId) {
         processingQueue.splice(i, 1);
     }
  }
  console.log(`[Queue] Removed jobs for docId ${docId}`);
}

module.exports = {
  addDocumentJob,
  removeDocumentJobs
};
