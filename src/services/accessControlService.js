const bcrypt = require('bcryptjs');
const db = require('./db.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Service to manage document-level access and audit logs.
 */

exports.setSharingPassword = async (docId, ownerId, password) => {
  const document = await db.findOne('documents', { id: docId });
  
  if (!document) throw new Error('Document not found');
  if (document.ownerId !== ownerId) throw new Error('Unauthorized: Only the owner can share this document');

  const hashedPassword = bcrypt.hashSync(password, 10);
  
  await db.update('documents', { id: docId }, { 
    sharePassword: hashedPassword,
    isShared: true 
  });

  await this.logActivity(ownerId, 'SHARE_SET', docId, 'Password-protected sharing enabled');
  return true;
};

exports.validateAccess = async (docId, userId, password) => {
  const document = await db.findOne('documents', { id: docId });
  
  if (!document || !document.sharePassword) {
    throw new Error('Document not found or not shared with a password');
  }

  const isMatch = await bcrypt.compare(password, document.sharePassword);
  if (!isMatch) {
    await this.logActivity(userId, 'ACCESS_DENIED', docId, 'Incorrect password provided');
    return false;
  }

  // Grant temporary access by storing in shared_access table
  await db.insert('shared_access', {
    id: uuidv4(),
    userId,
    docId,
    grantedAt: new Date().toISOString()
  });

  await this.logActivity(userId, 'ACCESS_GRANTED', docId, 'Access granted via password');
  return true;
};

exports.hasAccess = async (docId, user) => {
  if (user.role === 'Admin') return true;

  const document = await db.findOne('documents', { id: docId });
  if (!document) return false;

  // Owner access
  if (document.ownerId === user.id) return true;

  // Shared access check
  const access = await db.findOne('shared_access', { userId: user.id, docId });
  return !!access;
};

exports.logActivity = async (userId, action, docId = null, details = '') => {
  await db.insert('audit_logs', {
    id: uuidv4(),
    userId,
    action,
    docId,
    details,
    timestamp: new Date().toISOString()
  });
};
