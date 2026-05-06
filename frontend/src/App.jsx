import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [question, setQuestion] = useState('');
  const [language, setLanguage] = useState('English');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('Employee');
  const [uploadPassword, setUploadPassword] = useState('');
  const [requiredRole, setRequiredRole] = useState('Employee');
  const [deleteSearchQuery, setDeleteSearchQuery] = useState('');
  const [foundDocToDelete, setFoundDocToDelete] = useState(null);
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'dashboard'
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showDocManager, setShowDocManager] = useState(false);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('https://next-gen-lb2i.onrender.com/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSearchDelete = (e) => {
    e.preventDefault();
    if (!deleteSearchQuery) return;
    const match = documents.find(d => d.filename.toLowerCase() === deleteSearchQuery.toLowerCase());
    if (match) {
      setFoundDocToDelete(match);
    } else {
      alert('Document not found in your accessible nodes.');
      setFoundDocToDelete(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`https://next-gen-lb2i.onrender.com/api/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Document deleted successfully');
        setFoundDocToDelete(null);
        setDeleteSearchQuery('');
        fetchDocuments();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete document');
      }
    } catch(err) {
      alert('Network error while deleting');
    }
  };
  
  const chatEndRef = useRef(null);

  const processingDoc = documents.find(d => d.status === 'processing');
  const isBackgroundProcessing = !!processingDoc;
  const isSystemBusy = loading || isBackgroundProcessing;
  const busyText = processingDoc ? `Processing ${processingDoc.filename}...` : 'Processing Node...';

  useEffect(() => {
    let intervalId;
    if (token) {
      fetchDocuments();
      intervalId = setInterval(fetchDocuments, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [token]);

  useEffect(() => {
    if (activeView === 'dashboard') {
      fetchStats();
      const interval = setInterval(fetchStats, 10000); // UI updates every 10s
      return () => clearInterval(interval);
    }
  }, [activeView, token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('https://next-gen-lb2i.onrender.com/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setUser(data.user);
        setQaCategory(data.user.role); // Auto-detect category from role
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('loginCategory', data.user.role);
      } else {
        alert(data.error || 'Access Denied');
      }
    } catch (err) {
      alert('Network Error');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken('');
    setUser(null);
    window.location.reload();
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('https://next-gen-lb2i.onrender.com/api', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch failed');
    }
  };

  const handleUpload = async (e) => {
    if (e) e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('requiredRole', requiredRole);
    if (uploadPassword) formData.append('password', uploadPassword);

    try {
      setLoading(true);
      const res = await fetch('https://next-gen-lb2i.onrender.com/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setChat(prev => [...prev, { type: 'bot', text: `System: Processing ${data.filename}...` }]);
        setFile(null);
        setUploadPassword('');
        fetchDocuments();
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('[UPLOAD_ERROR]', err);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const [qaCategory, setQaCategory] = useState(localStorage.getItem('loginCategory') || '');
  const [sharingDoc, setSharingDoc] = useState(null);
  const [sharePasswordVal, setSharePasswordVal] = useState('');
  const [accessDoc, setAccessDoc] = useState(null);
  const [accessPasswordVal, setAccessPasswordVal] = useState('');

  const handleShare = async (docId) => {
    if (!sharePasswordVal) return alert('Enter a password');
    try {
      const res = await fetch('https://next-gen-lb2i.onrender.com/api/share', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ docId, password: sharePasswordVal })
      });
      const data = await res.json();
      alert(data.message || 'Shared');
      setSharingDoc(null);
      setSharePasswordVal('');
      fetchDocuments();
    } catch (err) { alert('Share failed'); }
  };

  const handleAccess = async () => {
    if (!accessPasswordVal) return;
    try {
      const res = await fetch('https://next-gen-lb2i.onrender.com/api/access', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ docId: accessDoc.id, password: accessPasswordVal })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Access granted! Refreshing...');
        setAccessDoc(null);
        setAccessPasswordVal('');
        fetchDocuments();
      } else {
        alert(data.error || 'Invalid password');
      }
    } catch (err) { alert('Access failed'); }
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question) return;

    const userMsg = question;
    setChat(prev => [...prev, { type: 'user', text: userMsg }]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('https://next-gen-lb2i.onrender.com/api/ask', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: userMsg, language, category: qaCategory })
      });
      const data = await res.json();

      if (data.status === 'PASSWORD_REQUIRED') {
        setAccessDoc({ id: data.docId, filename: data.filename });
        setChat(prev => [...prev, { 
          type: 'bot', 
          text: `The information requested is contained in a secure document: "${data.filename}". Please enter the passphrase in the prompt to decrypt.` 
        }]);
        return;
      }

      setChat(prev => [...prev, { 
        type: 'bot', 
        text: data.answer, 
        sources: data.sources || [] 
      }]);
    } catch (err) {
      setChat(prev => [...prev, { type: 'bot', text: 'Knowledge core offline.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card glass">
          <h1>AURA <span>Knowledge</span></h1>
          <p>Next-Gen Enterprise Intelligence</p>
           <form onSubmit={handleLogin} className="login-form">
            <input type="text" placeholder="Identity" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" placeholder="Passphrase" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* MODALS */}
      {sharingDoc && (
        <div className="modal-overlay">
          <div className="modal glass">
            <h3>Secure Document Share</h3>
            <p>Set a passphrase for <strong>{sharingDoc.filename}</strong></p>
            <input type="password" placeholder="Passphrase" value={sharePasswordVal} onChange={e => setSharePasswordVal(e.target.value)} />
            <div className="modal-actions">
              <button onClick={() => handleShare(sharingDoc.id)}>Enable Secure Share</button>
              <button onClick={() => setSharingDoc(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {accessDoc && (
        <div className="modal-overlay">
          <div className="modal glass">
            <h3>Unauthorized Access</h3>
            <p>This document is locked. Enter passphrase to decrypt.</p>
            <input type="password" placeholder="Identity Passphrase" value={accessPasswordVal} onChange={e => setAccessPasswordVal(e.target.value)} />
            <div className="modal-actions">
              <button onClick={handleAccess}>Unlock Node</button>
              <button onClick={() => setAccessDoc(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar glass">
        <div className="logo">AURA <span>KB</span></div>
        
        <div className="nav-section">
          <h3>Knowledge Hub</h3>
          <div className="nav-links">
            <button 
              className={`nav-link ${activeView === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveView('chat')}
            >
              Knowledge Stream
            </button>
            {user?.role === 'Admin' && (
              <button 
                className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveView('dashboard')}
              >
                Admin Dashboard
              </button>
            )}
          </div>
          <div style={{fontSize:'0.7rem', color:'var(--text-secondary)', padding:'1rem 0', opacity:0.6}}>
            RESTRICTED ACCESS POLICY ACTIVE
          </div>
        </div>

        <div className="nav-section">
          <h3>Manage Documents</h3>
          <form onSubmit={handleSearchDelete} className="sidebar-form">
            <input 
              type="text" 
              placeholder="Exact filename..." 
              value={deleteSearchQuery} 
              onChange={e => setDeleteSearchQuery(e.target.value)}
            />
            <button type="submit" className="action-btn">Find</button>
          </form>
          {foundDocToDelete && (
            <div className="found-doc-pill">
               <div style={{marginBottom:'0.5rem'}}>Found: <strong>{foundDocToDelete.filename}</strong></div>
               <button onClick={() => handleDelete(foundDocToDelete.id)} className="delete-node-btn">Delete Node</button>
            </div>
          )}
        </div>

        <div className="nav-section">
          <h3>Ingest Node</h3>
          {documents.filter(d => d.status === 'failed').length > 0 && (
            <div style={{marginBottom:'0.8rem', padding:'0.5rem', background:'var(--error, #fef2f2)', border:'1px solid #fca5a5', borderRadius:'0.5rem', color:'#991b1b', fontSize:'0.75rem', overflowWrap:'break-word', wordWrap:'break-word', whiteSpace:'normal', overflow:'hidden', maxWidth:'100%'}}>
              <strong>Extraction Error:</strong>
              <ul style={{margin:'0.3rem 0 0 1rem', padding:0, wordBreak:'break-word', maxHeight:'120px', overflowY:'auto'}}>
                {documents.filter(d => d.status === 'failed').map(d => (
                  <li key={d.id} style={{marginBottom:'0.4rem'}}>
                    <strong>{d.filename}</strong><br/>
                    <em style={{opacity:0.8}}>{d.error || 'Unknown error'}</em>
                  </li>
                ))}
              </ul>
              <div style={{marginTop:'0.3rem', fontSize:'0.7rem'}}>These PDFs could not be read. Please remove them via Manage Documents.</div>
            </div>
          )}
          <div className="upload-zone" onClick={() => document.getElementById('file-input').click()}>
            <div style={{fontSize:'0.8rem', color:'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {file ? file.name : "Drop Secure PDF"}
            </div>
            <input 
              id="file-input" 
              type="file" 
              style={{display:'none'}} 
              onChange={e => { setFile(e.target.files[0]); }} 
            />
          </div>
          {file && (
            <div style={{display:'flex', flexDirection:'column', gap:'0.5rem', marginTop:'0.5rem'}}>
              {user?.role === 'Admin' && (
                <>
                  <input 
                    type="password" 
                    placeholder="Security Password (Optional)" 
                    value={uploadPassword} 
                    onChange={e => setUploadPassword(e.target.value)} 
                  />
                </>
              )}
              <button onClick={handleUpload} className="glass action-btn">Process Node</button>
            </div>
          )}
        </div>

        <div style={{marginTop:'auto', padding:'1rem', borderTop:'1px solid var(--glass-border)'}}>
           <div style={{fontSize:'0.8rem'}}>{user?.username}</div>
           <div style={{fontSize:'0.7rem', color:'var(--accent-secondary)'}}>{user?.role}</div>
           <button onClick={handleLogout} style={{background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', padding:'0', marginTop:'0.5rem', fontSize:'0.8rem'}}>Deauthenticate</button>
        </div>
      </aside>

      <main className="chat-main">
        {activeView === 'chat' ? (
          <>
            <div className="top-bar glass">
              <div style={{fontWeight:600}}>Knowledge Stream</div>
              <div style={{display:'flex', gap:'1rem', fontSize:'0.8rem'}}>
                <span style={{color: isSystemBusy ? 'var(--accent-secondary)' : '#4ade80'}}>● {isSystemBusy ? busyText : 'Core Ready'}</span>
              </div>
            </div>

            <div className="chat-history">
              {chat.length === 0 && (
                <div className="welcome-screen">
                  <h2>Awaiting Query...</h2>
                  <p>Ask Aura global intelligence about company knowledge.</p>
                </div>
              )}
              {chat.map((msg, i) => (
                <div key={i} className={`bubble ${msg.type}`}>
                  <div className="bubble-label">
                    {msg.type === 'user' ? 'YOU' : 'AURA'}
                  </div>
                  <div className="bubble-text">{msg.text}</div>
                  {msg.sources?.length > 0 && (
                    <div className="sources">
                      Nodes: {msg.sources.map(s => s.filename).join(' | ')}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="input-area">
              <form className="input-wrapper" onSubmit={handleAsk}>
                <input 
                  type="text" 
                  placeholder="Query the node..." 
                  value={question} 
                  onChange={e => setQuestion(e.target.value)} 
                />
                <select value={language} onChange={e => setLanguage(e.target.value)}>
                  <option value="English">EN</option>
                  <option value="Spanish">ES</option>
                  <option value="French">FR</option>
                  <option value="German">DE</option>
                </select>
                <button type="submit" className="send-btn" disabled={loading}>→</button>
              </form>
            </div>
          </>
        ) : (
          <div className="dashboard-container">
            <header className="dashboard-header">
              <div>
                <h2>Enterprise Intelligence Dashboard</h2>
                <p>Real-time insights and system metrics</p>
              </div>
              <button className="primary-glass-btn" onClick={() => setShowDocManager(true)}>
                Manage Knowledge Nodes
              </button>
            </header>

            {statsLoading && !stats ? (
              <div className="loader">Decrypting Metrics...</div>
            ) : (
              <>
                <div className="stats-grid">
                  <div className="stat-card glass">
                    <div className="stat-label">📄 Documents Uploaded</div>
                    <div className="stat-value">{stats?.documents?.total || 0}</div>
                    <div className="stat-sub">{Object.entries(stats?.documents?.byCategory || {}).map(([c, n]) => `${c}: ${n}`).join(' • ')}</div>
                  </div>
                  <div className="stat-card glass">
                    <div className="stat-label">🔍 Queries Asked</div>
                    <div className="stat-value">{stats?.queries?.total || 0}</div>
                    <div className="stat-sub">Across all authorized nodes</div>
                  </div>
                  <div className="stat-card glass">
                    <div className="stat-label">⚡ AI Usage</div>
                    <div className="stat-value">{stats?.usage?.totalAIActions || 0}</div>
                    <div className="stat-sub">RAG Responses Generated</div>
                  </div>

                  <div className="stat-card glass topics-card">
                    <div className="stat-label">🔥 Most Searched Topics</div>
                    <div className="topics-list">
                      {stats?.queries?.hotTopics?.length > 0 ? stats.queries.hotTopics.map((t, i) => (
                        <div key={i} className="topic-item">
                          <span>{t.topic}</span>
                          <span className="topic-count">{t.count}</span>
                        </div>
                      )) : <div style={{opacity:0.5}}>No data yet</div>}
                    </div>
                  </div>

                  <div className="stat-card glass activity-card">
                    <div className="stat-label">🕒 Recent Activity Stream</div>
                    <div className="activity-list">
                      {stats?.recentActivity?.length > 0 ? stats.recentActivity.map((l, i) => (
                        <div key={i} className="activity-item">
                          <div style={{fontWeight:600, fontSize:'0.8rem'}}>{l.details}</div>
                          <div style={{fontSize:'0.7rem', opacity:0.6}}>
                            {l.user} • {new Date(l.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      )) : <div style={{opacity:0.5}}>No activity recorded</div>}
                    </div>
                  </div>
                </div>

                {showDocManager && (
                  <div className="modal-overlay">
                    <div className="doc-manager-modal glass">
                      <div className="modal-header">
                        <h3>Knowledge Node Management</h3>
                        <button className="close-btn" onClick={() => setShowDocManager(false)}>×</button>
                      </div>
                      <div className="management-table-wrapper">
                        <table className="management-table">
                          <thead>
                            <tr>
                              <th>Filename</th>
                              <th>Category</th>
                              <th>Status</th>
                              <th>Uploaded</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats?.documents?.list?.map(doc => (
                              <tr key={doc.id}>
                                <td className="doc-name">{doc.filename}</td>
                                <td><span className="badge">{doc.category}</span></td>
                                <td>
                                  <span className={`status-dot ${doc.status}`}></span>
                                  {doc.status}
                                </td>
                                <td style={{fontSize:'0.8rem'}}>{new Date(doc.createdAt).toLocaleDateString()}</td>
                                <td>
                                  <button 
                                    className="delete-node-btn"
                                    onClick={() => {
                                      if(window.confirm(`Delete document "${doc.filename}" permanently?`)) {
                                        handleDelete(doc.id).then(() => fetchStats());
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
