const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const accessController = require('../controllers/access.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate, authorize } = require('../middlewares/auth');

router.post('/upload', authenticate, authorize(['Admin', 'Employee']), upload.single('file'), documentController.uploadDocument);
router.post('/ask', authenticate, authorize(['Admin', 'Employee']), documentController.askQuestion);
router.get('/summary/:id', authenticate, authorize(['Admin', 'Employee']), documentController.getSummary);
router.get('/', authenticate, authorize(['Admin', 'Employee']), documentController.getDocuments);
router.delete('/:id', authenticate, authorize(['Admin', 'Employee']), documentController.deleteDocument);

// ACCESS CONTROL ROUTES
router.post('/share', authenticate, authorize(['Admin', 'Employee']), accessController.shareDocument);
router.post('/access', authenticate, authorize(['Admin', 'Employee']), accessController.accessDocument);

module.exports = router;
