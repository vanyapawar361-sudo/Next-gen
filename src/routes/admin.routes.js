const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middlewares/auth');

// Only Admins can see stats
router.get('/stats', authenticate, authorize(['Admin']), adminController.getStats);
router.get('/documents', authenticate, authorize(['Admin']), adminController.getAllDocuments);
router.get('/logs', authenticate, authorize(['Admin']), adminController.getAuditLogs);

module.exports = router;
