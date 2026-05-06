const { Queue } = require('bullmq');
const config = require('../config');

// Re-using Redis connection via standard URL format for ioredis
const ioredis = require('ioredis');
const connection = new ioredis(config.REDIS_URL, { maxRetriesPerRequest: null });

const documentQueue = new Queue('document-processing', { connection });

async function addDocumentJob(docId) {
  return await documentQueue.add('process-document', { docId });
}

async function removeDocumentJobs(docId) {
  // Get all potential pending/active jobs
  const jobs = await documentQueue.getJobs(['waiting', 'delayed', 'active', 'failed']);
  for (const job of jobs) {
    if (job.data && job.data.docId === docId) {
      try {
        await job.remove();
        console.log(`[Queue] Removed job ${job.id} for docId ${docId}`);
      } catch (err) {
        console.warn(`[Queue] Could not remove job ${job.id}: ${err.message}`);
      }
    }
  }
}

module.exports = {
  documentQueue,
  addDocumentJob,
  removeDocumentJobs
};
