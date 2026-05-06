const accessControlService = require('../services/accessControlService');

exports.shareDocument = async (req, res) => {
  const { docId, password } = req.body;
  const ownerId = req.user.id;

  if (!docId || !password) {
    return res.status(400).json({ error: 'docId and password are required' });
  }

  try {
    await accessControlService.setSharingPassword(docId, ownerId, password);
    res.json({ message: 'Sharing password set successfully' });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

exports.accessDocument = async (req, res) => {
  const { docId, password } = req.body;
  const userId = req.user.id;

  if (!docId || !password) {
    return res.status(400).json({ error: 'docId and password are required' });
  }

  try {
    const granted = await accessControlService.validateAccess(docId, userId, password);
    if (!granted) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    res.json({ message: 'Access granted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
