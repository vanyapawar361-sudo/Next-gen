const db = require('../services/db.service');

exports.getStats = async (req, res) => {
  try {
    const documents = await db.find('documents', {});
    const summaries = await db.find('summaries', {});
    const logs = await db.find('audit_logs', {});

    // Detailed Document Breakdown
    const docBreakdown = {
      total: documents.length,
      byCategory: {},
      byStatus: {}
    };
    documents.forEach(doc => {
      docBreakdown.byCategory[doc.category] = (docBreakdown.byCategory[doc.category] || 0) + 1;
      docBreakdown.byStatus[doc.status] = (docBreakdown.byStatus[doc.status] || 0) + 1;
    });

    // Query Analysis
    const queryLogs = logs.filter(l => l.action === 'QUERY');
    const totalQueries = queryLogs.length;

    // "Most Searched Topics" - Simple frequency analysis of query strings
    const topicFrequency = {};
    queryLogs.forEach(log => {
      if (log.details) {
        // Extract query from "Asked: <query>"
        const queryText = log.details.replace('Asked: ', '').toLowerCase().trim();
        if (queryText) {
          topicFrequency[queryText] = (topicFrequency[queryText] || 0) + 1;
        }
      }
    });

    const hotTopics = Object.entries(topicFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Recent Activity Feed (last 20 logs)
    const recentActivity = logs.slice(-20).reverse().map(l => ({
      id: l.id,
      user: l.userId,
      action: l.action,
      details: l.details,
      timestamp: l.timestamp
    }));

    res.json({
      documents: {
        ...docBreakdown,
        list: documents.map(d => ({
          id: d.id,
          filename: d.filename,
          category: d.category,
          status: d.status,
          createdAt: d.createdAt
        }))
      },
      queries: {
        total: totalQueries,
        hotTopics
      },
      usage: {
        totalAIActions: totalQueries + summaries.length
      },
      recentActivity,
      status: 'success'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllDocuments = async (req, res) => {
  try {
    const documents = await db.find('documents', {});
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await db.find('audit_logs', {});
    // Sort logic handled in frontend or simple sort here
    res.json(logs.reverse().slice(0, 50)); 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
