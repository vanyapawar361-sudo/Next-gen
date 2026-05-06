import { useState } from 'react';
import { LogIn } from 'lucide-react';
import './index.css';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      onLogin(username);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Welcome Back</h1>
        <p>Sign in to access Nova RAG system</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input 
            type="text" 
            placeholder="Username (e.g. admin)" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            required 
          />
          <input 
            type="password" 
            placeholder="Password (anything)" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <button type="submit" className="login-btn">
            <LogIn size={18} /> Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
