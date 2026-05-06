/**
 * Simple in-memory session manager for chat history.
 * In production, this would use Redis for persistence.
 */
const sessions = new Map();

const getSession = (sessionId) => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
};

const addExchange = (sessionId, question, answer) => {
  const history = getSession(sessionId);
  history.push({ role: 'user', content: question });
  history.push({ role: 'assistant', content: answer });
  
  // Keep only last 5 exchanges (10 messages) to manage context length
  if (history.length > 10) {
    sessions.set(sessionId, history.slice(-10));
  }
};

const formatHistory = (sessionId) => {
  const history = getSession(sessionId);
  return history.map(m => `${m.role === 'user' ? 'Question' : 'Answer'}: ${m.content}`).join('\n');
};

module.exports = {
  getSession,
  addExchange,
  formatHistory
};
