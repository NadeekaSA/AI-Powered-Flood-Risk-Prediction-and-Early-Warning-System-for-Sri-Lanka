import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from './ToastManager';
import { login, register } from '../api';

export default function LoginPage() {
  const { loginUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('public');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      addToast('Please enter both username and password.', 'Medium');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Login API Call
        const res = await login(username, password);
        const { token, role: userRole, username: userName } = res.data;
        loginUser(token, userRole, userName);
        addToast(`Welcome back, ${userName}!`, 'Low');
        
        if (userRole === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      } else {
        // Register API Call
        await register(username, password, role);
        addToast('Registration successful! Please log in.', 'Low');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.message || 'An error occurred';
      addToast(errMsg, 'Critical');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="glass-card login-page-card">
        <div style={{ textAlign: 'center' }}>
          <h2 className="font-display font-bold" style={{ fontSize: '1.8rem', color: 'var(--clr-text-100)' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-muted" style={{ marginTop: 'var(--sp-1)' }}>
            {isLogin
              ? 'Access the FloodWatch SL Command Console'
              : 'Sign up for early warning push notifications'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Role Privilege</label>
              <select
                className="form-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
              >
                <option value="public">🌍 Public User (Alert Subscriptions)</option>
                <option value="admin">⚙️ Administrator (Full System Access)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full justify-center"
            style={{ marginTop: 'var(--sp-2)' }}
            disabled={loading}
          >
            {loading ? '⌛ Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-4)' }}>
          <p className="text-sm text-muted">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <span
              style={{
                color: 'var(--clr-primary)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              onClick={() => {
                setIsLogin(!isLogin);
                setUsername('');
                setPassword('');
              }}
            >
              {isLogin ? 'Register Here' : 'Log In Here'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
