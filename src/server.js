const express = require('express');
const cors = require('cors');
const config = require('./config');
const documentRoutes = require('./routes/document.routes');
const adminRoutes = require('./routes/admin.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Main Routes
app.use('/auth', authRoutes);
app.use('/api', documentRoutes);
app.use('/api/admin', adminRoutes);

// Health Check / Root
app.get('/', (req, res) => {
  res.json({
    status: 'Nova RAG Knowledge Base API is online',
    version: '2.0.0 (Knowledge Base)',
    endpoints: {
      upload: 'POST /api/upload',
      ask: 'POST /api/ask',
      summary: 'GET /api/summary/:id',
      documents: 'GET /api',
      adminStats: 'GET /api/admin/stats'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start Server
if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`Server starting on port ${config.PORT}`);
    console.log(`Environment config: Redis at ${config.REDIS_URL}`);
  });
}

module.exports = app;
