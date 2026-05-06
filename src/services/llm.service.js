const Groq = require('groq-sdk');
const config = require('../config');

const groq = new Groq({
  apiKey: config.GROQ_API_KEY
});

// We use llama-3.1-8b-instant for high-speed robust performance
const MODEL = "llama-3.1-8b-instant";

async function generateSummary(text) {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are an assistant that summarizes text. Provide a JSON response with two keys: 'shortSummary' (2-3 lines) and 'detailedSummary' (1 full paragraph)."
        },
        {
          role: "user",
          content: text.slice(0, 15000) // Slice to prevent exceeding token limits
        }
      ],
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error in Groq Chat (Summary):', error.message);
    throw error;
  }
}

async function answerQuestionWithContext(question, contextChunks, language) {
  const contextText = contextChunks.map(c => c.metadata.text).join('\n---\n');
  const systemPrompt = `You are a helpful assistant. Answer the user's question using ONLY the provided context. If the context does not contain the answer, say "I cannot find the answer in the provided document".
  
You MUST translate your final answer to the requested language: ${language || 'English'}.`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Context:\n${contextText}\n\nQuestion: ${question}` }
      ]
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in Groq Chat (QA):', error.message);
    throw error;
  }
}
async function generateAnswer(role, contextText, query, sessionId = 'default') {
  const systemPrompt = `You are an AI Enterprise Assistant for [Company Name], integrated into a secure internal web application.

Your responsibilities include:
1. Answering user queries using company documents (RAG)
2. Enforcing strict role-based access control
3. Handling password-protected documents
4. Assisting with document-related actions (admin only)

----------------------------------------
🔐 DOCUMENT VISIBILITY RULE
----------------------------------------
- Documents are stored internally and must NEVER be listed or shown on the home page.
- Users can only access information via search/query.
- Do NOT reveal document lists, storage details, or file system structure.

----------------------------------------
🧠 KNOWLEDGE USAGE (RAG)
----------------------------------------
- Use ONLY the retrieved context to answer queries.
- Do NOT hallucinate or generate outside knowledge.
- If no relevant info is found, respond:
  "I could not find relevant information in the company documents."

----------------------------------------
👥 ROLE-BASED ACCESS CONTROL
----------------------------------------
User roles: employee, hr, admin

Rules:
- Employee:
  → Give simple and limited information
  → Avoid internal details

- HR:
  → Provide detailed explanations
  → Include policy rules and conditions

- Admin:
  → Provide full information
  → Include complete data if available

If a query involves restricted data:
→ Respond:
"You do not have permission to access this information."

----------------------------------------
🔒 PASSWORD-PROTECTED DOCUMENTS
----------------------------------------
- Some documents require a password before access.
- If relevant info exists in a protected document:
  → Ask user for password first

Return:
{
  "type": "password_required",
  "response": "This information is protected. Please provide the document password."
}

- Only after correct password verification, include that document in context.

----------------------------------------
📤 ADMIN ACTION: DOCUMENT UPLOAD
----------------------------------------
If user role is admin and intent is to upload document:

Return:
{
  "type": "action",
  "action": "upload_document",
  "fields_required": [
    "document_name",
    "file",
    "access_level (employee/hr/admin)",
    "optional_password"
  ]
}

----------------------------------------
💬 NORMAL QUERY RESPONSE FORMAT
----------------------------------------
Return:
{
  "type": "answer",
  "response": "...",
  "sources": ["doc1", "doc2"],
  "confidence": "high | medium | low"
}

----------------------------------------
❓ CLARIFICATION HANDLING
----------------------------------------
If query is unclear:

{
  "type": "clarification",
  "response": "Please clarify your request."
}

----------------------------------------
📊 CONFIDENCE RULES
----------------------------------------
- high → exact info in documents
- medium → partial match
- low → weak context`;

  const userPrompt = `Ensure your output is valid JSON. 
------------------------
INPUTS:
------------------------
User Role: ${role}
Context: ${contextText}
User Query: ${query}`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in Groq Chat (generateAnswer):', error.message);
    throw error;
  }
}

async function generatePlainAnswer(prompt, sessionId = 'default') {
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a helpful, intelligent enterprise knowledge assistant." },
        { role: "user", content: prompt }
      ]
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in Groq Chat (generatePlainAnswer):', error.message);
    throw error;
  }
}

module.exports = { generateSummary, answerQuestionWithContext, generateAnswer, generatePlainAnswer };
