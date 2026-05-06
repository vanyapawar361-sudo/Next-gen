const db = require('../services/db.service');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { addDocumentJob, removeDocumentJobs } = require('../queue');
const embeddingService = require('../services/embedding.service');
const vectorDbService = require('../services/vectorDb.service');
const llmService = require('../services/llm.service');
const categoryService = require('../services/categoryService');
const accessControlService = require('../services/accessControlService');
const memoryService = require('../services/memoryService');

exports.uploadDocument = async (req, res) => {
  console.log(`[UPLOAD] Starting upload for user: ${req.user.id}`);
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a file' });
    }

    const { originalname, mimetype, path: filePath, size } = req.file;
    const { category = 'General', requiredRole = 'Employee', password } = req.body;
    const ownerId = req.user.id; // From authenticate middleware
    const docId = uuidv4();

    if (!categoryService.isValidCategory(category)) {
      return res.status(400).json({ error: `Invalid category. Allowed: ${categoryService.getCategories().join(', ')}` });
    }

    const docData = {
      id: docId,
      ownerId,
      filename: originalname,
      mimetype,
      path: filePath,
      size,
      category,
      requiredRole,
      status: 'uploaded',
      createdAt: new Date().toISOString()
    };

    if (password) {
      docData.sharePassword = bcrypt.hashSync(password, 10);
      docData.isShared = true;
    }

    const document = await db.insert('documents', docData);

    // Queue up the processing job
    await addDocumentJob(docId);

    res.status(201).json({ 
      message: 'Upload successful, processing started',
      docId,
      filename: originalname
    });

  } catch (error) {
    console.error(`[UPLOAD_ERROR] for user ${req.user.id}:`, error);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
};

exports.getSummary = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const canAccess = await accessControlService.hasAccess(id, user);
    if (!canAccess) {
      return res.status(403).json({ error: 'Unauthorized: You do not have access to this document summary' });
    }

    const summary = await db.findOne('summaries', { docId: id });
    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    await accessControlService.logActivity(user.id, 'VIEW_SUMMARY', id, 'Viewed document summary');
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.askQuestion = async (req, res) => {
  console.log(`[QA] Incoming question: "${req.body.question}" from user: ${req.user.id} (${req.user.role})`);
  try {
    const { question, language, category, sessionId = 'default' } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Missing question' });
    }

    const historyContext = memoryService.formatHistory(sessionId);
    const enrichedQuestion = historyContext 
      ? `Previous Conversation:\n${historyContext}\n\nCurrent Question: ${question}`
      : question;

    const user = req.user;
    await accessControlService.logActivity(user.id, 'QUERY', null, `Asked: ${question}`);

    // 1. Determine authorized and protected documents for this user
    // Admins can search across all categories by default, but others are restricted to their role/selected category
    const allCategoryDocs = (user.role === 'Admin')
      ? await db.find('documents', {})
      : (category 
          ? await db.find('documents', { category })
          : await db.find('documents', {})
        );

    const authorizedDocIds = [];
    const authorizedDocs = [];
    const protectedDocs = [];

    for (const d of allCategoryDocs) {
      if (user.role === 'Admin' || d.ownerId === user.id) {
        authorizedDocIds.push(d.id);
        authorizedDocs.push(d);
      } else {
        // Document is not owned by user and user is not admin
        if (d.isShared && d.sharePassword) {
          // It's a protected document, check for granted access
          const hasSharedAccess = await db.findOne('shared_access', { userId: user.id, docId: d.id });
          if (hasSharedAccess) {
            authorizedDocIds.push(d.id);
            authorizedDocs.push(d);
          } else {
            protectedDocs.push(d);
          }
        } else {
          // It's a normal unprotected document assigned to this role category
          authorizedDocIds.push(d.id);
          authorizedDocs.push(d);
        }
      }
    }

    const protectedDocIds = protectedDocs.map(d => d.id);
    const searchDocIds = [...authorizedDocIds, ...protectedDocIds];

    if (searchDocIds.length === 0) {
      return res.json({
        question,
        language,
        answer: "No accessible nodes found in this category. Upload a document first, or ask an admin to share one with you.",
        sources: []
      });
    }

    // 2. Try Pinecone vector search
    let contextText = '';
    let sourceFiles = [];
    let usedVectorSearch = false;

    try {
      const queryEmbedding = await embeddingService.generateQueryEmbedding(question);
      const pineconeFilter = { docId: { $in: searchDocIds } };
      const matches = await vectorDbService.querySimilarChunks(queryEmbedding, 5, pineconeFilter);

      if (matches && matches.length > 0) {
        console.log(`[QA] Found ${matches.length} matches. Top score: ${matches[0].score}`);
        const bestDocId = matches[0].metadata.docId;
        console.log(`[QA] Best doc match: ${bestDocId}`);
        console.log(`[QA] Protected Doc IDs:`, protectedDocIds);

        // If the best match is a document the user lacks access to, signal for password
        if (protectedDocIds.includes(bestDocId)) {
          const lockedDoc = protectedDocs.find(d => d.id === bestDocId);
          console.log(`[QA] TRIGGERING PASSWORD PROMPT for ${lockedDoc.filename}`);
          return res.json({
            status: 'PASSWORD_REQUIRED',
            docId: lockedDoc.id,
            filename: lockedDoc.filename,
            question
          });
        }

        // Otherwise, filter to only use context from authorized documents
        const allowedMatches = matches.filter(m => authorizedDocIds.includes(m.metadata.docId));
        if (allowedMatches.length > 0) {
          contextText = allowedMatches.map(m => m.metadata.text).join('\n---\n');
          sourceFiles = allowedMatches.map(c => ({ 
            filename: c.metadata.filename || 'Unknown',
            chunkIndex: c.metadata.chunkIndex, 
            score: c.score 
          }));
          usedVectorSearch = true;
        }
      }
    } catch (vecErr) {
      console.warn('Vector search failed, falling back to local text:', vecErr.message);
    }

    // 3. Fallback: use extractedText from db.json if vector search returned nothing
    if (!usedVectorSearch) {
      const docsWithText = authorizedDocs.filter(d => d.extractedText && d.extractedText.length > 0);
      if (docsWithText.length === 0) {
        return res.json({
          question,
          language,
          answer: "Your documents are still being processed. Please wait a moment and try again.",
          sources: []
        });
      }
      // Use extractedText directly, trimmed to a reasonable context window
      contextText = docsWithText.map(d => {
        const text = d.extractedText.substring(0, 3000);
        return `[Document: ${d.filename}]\n${text}`;
      }).join('\n\n---\n\n');

      sourceFiles = docsWithText.map(d => ({
        filename: d.filename,
        chunkIndex: 0,
        score: 1.0
      }));
    }

    // 4. Generate Answer using Context
    let answer = await llmService.generateAnswer(user.role, contextText, question, sessionId);

    try {
      const parsed = JSON.parse(answer);
      if (parsed.type === 'action' && parsed.action === 'generate_email') {
        answer = `Subject: ${parsed.email.subject}\n\n${parsed.email.body}`;
      } else if (parsed.type === 'action' && parsed.action === 'upload_document') {
        answer = `[ACTION REQUIRED] Upload Document.\nPlease provide: ${parsed.fields_required.join(', ')}`;
      } else if (parsed.type === 'password_required') {
        answer = `[LOCKED] ${parsed.response}`;
      } else if (parsed.type === 'clarification') {
        answer = parsed.response;
      } else if (parsed.type === 'answer') {
        answer = parsed.response;
        if (parsed.sources && parsed.sources.length > 0) {
          answer += `\n\n[Sources: ${parsed.sources.join(', ')}]`;
        }
        if (parsed.confidence) {
          answer += `\n[Confidence: ${parsed.confidence}]`;
        }
      }
    } catch(e) {
      // If parsing fails for some reason or it's raw text, fallback to `answer` itself
      console.warn('Failed to parse LLM JSON response or received raw text', e);
    }

    // 5. Translation Support
    if (language && language.toLowerCase() !== 'english') {
      const translationPrompt = `Translate the following text into ${language}. Keep the meaning and tone intact.\n\nText:\n${answer}`;
      answer = await llmService.generatePlainAnswer(translationPrompt, `translation-${sessionId}`);
    }

    console.log(`[QA] Sending answer for: "${question}"`);
    res.json({
      question,
      language: language || 'English',
      answer,
      sources: sourceFiles
    });
  } catch (error) {
    console.error('askQuestion error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getDocuments = async (req, res) => {
  const user = req.user;
  try {
    let documents;
    if (user.role === 'Admin') {
      documents = await db.find('documents', {});
    } else {
      // Manual filter for shared docs
      const sharedAccess = await db.find('shared_access', { userId: user.id });
      const sharedDocIds = sharedAccess.map(s => s.docId);
      const allDocs = await db.find('documents', {});
      documents = allDocs.filter(d => d.ownerId === user.id || sharedDocIds.includes(d.id));
    }
    res.json(documents.map(d => ({
      id: d.id,
      filename: d.filename,
      category: d.category,
      requiredRole: d.requiredRole,
      status: d.status,
      createdAt: d.createdAt
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  try {
    const doc = await db.findOne('documents', { id });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    
    if (doc.ownerId !== user.id && user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this document' });
    }

    // 1. Remove from database
    await db.remove('documents', { id });
    await db.remove('chunks', { docId: id });
    await db.remove('summaries', { docId: id });
    await db.remove('shared_access', { docId: id });

    // 2. Remove physical file
    if (doc.path) {
      try {
        await fs.unlink(doc.path);
        console.log(`[File] Deleted: ${doc.path}`);
      } catch (err) {
        console.warn(`[File] Could not delete ${doc.path}: ${err.message}`);
      }
    }

    // 3. Remove from Vector DB (Pinecone)
    try {
      await vectorDbService.deleteEmbeddings(id);
      console.log(`[Vector] Deleted embeddings for doc: ${id}`);
    } catch (err) {
      console.warn(`[Vector] Could not delete embeddings: ${err.message}`);
    }

    // 4. Remove pending queue jobs
    try {
      await removeDocumentJobs(id);
    } catch (err) {
      console.warn(`[Queue] Could not remove jobs: ${err.message}`);
    }
    
    await accessControlService.logActivity(user.id, 'DELETE_DOCUMENT', id, `Deleted document: ${doc.filename}`);
    res.json({ message: 'Document deleted successfully and all resources cleaned up' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
