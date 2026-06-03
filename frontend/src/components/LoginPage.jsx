import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from './ToastManager';
import { login, register, getRiverLevels } from '../api';

const SRI_LANKAN_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", 
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara", 
  "Kandy", "Matale", "Matara", "Moneragala", "Mullaitivu", "Nuwara Eliya", 
  "Polonnaruwa", "Puttalam", "Ratnapura", "Kegalle", "Kurunegala", "Trincomalee"
];

export default function LoginPage() {
  const { loginUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('public');
  const [district, setDistrict] = useState('');
  const [nearestStationId, setNearestStationId] = useState('');
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await getRiverLevels();
        setStations(res.data);
      } catch (err) {
        console.error("Failed to load gauging stations:", err);
      }
    };
    fetchStations();
  }, []);

  const handleDistrictChange = (e) => {
    setDistrict(e.target.value);
    setNearestStationId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      addToast('Please enter both username and password.', 'Medium');
      return;
    }

    if (!isLogin && (!district || !nearestStationId)) {
      addToast('Please select your district and nearest gauging station.', 'Medium');
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
        await register(
          username, 
          password, 
          role, 
          district, 
          nearestStationId ? parseInt(nearestStationId, 10) : null
        );
        addToast('Registration successful! Please log in.', 'Low');
        setIsLogin(true);
        setPassword('');
        setDistrict('');
        setNearestStationId('');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.message || 'An error occurred';
      addToast(errMsg, 'Critical');
    } finally {
      setLoading(false);
    }
  };

  const filteredStations = stations.filter(s => s.district === district);

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
            <>
              <div className="form-group">
                <label className="form-label">District</label>
                <select
                  className="form-input"
                  value={district}
                  onChange={handleDistrictChange}
                  disabled={loading}
                  required
                >
                  <option value="">-- Select District --</option>
                  {SRI_LANKAN_DISTRICTS.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Nearest Gauging Station</label>
                <select
                  className="form-input"
                  value={nearestStationId}
                  onChange={(e) => setNearestStationId(e.target.value)}
                  disabled={loading || !district}
                  required
                >
                  <option value="">
                    {!district 
                      ? 'Select a district first' 
                      : filteredStations.length === 0 
                        ? 'No gauging stations in this district' 
                        : '-- Select Nearest Station --'}
                  </option>
                  {filteredStations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.station_name} ({station.river_name})
                    </option>
                  ))}
                </select>
              </div>

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
            </>
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
                setDistrict('');
                setNearestStationId('');
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
