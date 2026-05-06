# Advanced RAG Document System

A scalable RAG system built with Node.js that performs document processing, automatic summarization, and multilingual question-answering.

## Features
- **Universal Document Ingestion**: Upload Standard PDFs, Scanned PDFs (via Tesseract OCR), and Text files.
- **Background Processing**: Redis queue via BullMQ handles potentially slow extraction, chunking, and embedding creation without blocking the main server thread.
- **Auto-Summarization**: Uses OpenAI API to generate short & detailed summaries upon processing completion.
- **Multilingual RAG QA**: Queries the Pinecone vector database to retrieve facts from your documents, and subsequently instructs the AI to translate answers.

## Prerequisites
- **Node.js** (v18+)
- **Redis Server** (Usually running locally on port 6379)
- **OpenAI API Key**
- **Pinecone API Key & Index** (Index Dimensions: 1536, Metric: cosine)

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Setup environment variables by copying `.env.example` to `.env` and adding your real API keys.
3. Run the Background Queue Worker in a terminal:
   ```bash
   node src/queue/worker.js
   ```
4. Run the API Server in another terminal:
   ```bash
   npx nodemon src/server.js
   ```

## Design Architecture
- **Controllers & Routes**: Fast endpoints responding instantly while enqueueing computationally expensive jobs to Redis.
- **Services Pattern**: Logic compartmentalized (`extraction`, `chunking`, `embedding`, `vectorDb`, `llm`, `db`).
- **Simulated DB Mock**: Uses a local JSON file (`db.json`) wrapped in promises to simulate a non-blocking asynchronous NoSQL document-based database environment for saving configurations and states.

## API Endpoints
### 1. `POST /api/upload`
Upload a document. (Use `multipart/form-data` with a `file` field). Returns a `documentId` which you'll use in subsequent routes.

### 2. `GET /api/summary/:id`
Retrieves auto generated summaries once the background job finishes processing the uploaded document.

### 3. `POST /api/ask`
Ask questions against your document in any target language!
```json
{
  "docId": "your-document-id",
  "question": "Explain page faults.",
  "language": "Hindi"
}
```
