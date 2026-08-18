import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from './ToastManager';
import { login, register, getRiverLevels, subscribeToAlerts } from '../api';

const SRI_LANKAN_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", 
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara", 
  "Kandy", "Matale", "Matara", "Moneragala", "Mullaitivu", "Nuwara Eliya", 
  "Polonnaruwa", "Puttalam", "Ratnapura", "Kegalle", "Kurunegala", "Trincomalee"
];

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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

  const [subscription, setSubscription] = useState(null);
  const [subscribing, setSubscribing] = useState(false);

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

  const handleSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      addToast('Push notifications are not supported by your browser.', 'High');
      return;
    }

    if (Notification.permission === 'denied') {
      addToast('Notification permission is blocked in browser settings. Please click the site settings icon in your browser address bar to allow notifications.', 'High');
      return;
    }

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (permission === 'denied') {
          addToast('Notification permission blocked. Please enable it in browser settings.', 'High');
        } else {
          addToast('Notification permission dismissed.', 'High');
        }
        setSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!publicVapidKey) {
        throw new Error('VAPID public key is missing in environment configuration.');
      }

      // Clear any existing subscription to avoid VAPID key mismatch/push service conflicts
      const oldSub = await registration.pushManager.getSubscription();
      if (oldSub) {
        await oldSub.unsubscribe();
      }

      const subscriptionOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      };

      const subscriptionObj = await registration.pushManager.subscribe(subscriptionOptions);
      setSubscription(subscriptionObj);
      addToast('Alerts will be enabled on this device upon successful registration!', 'Low');
    } catch (err) {
      console.error('Subscription error:', err);
      addToast('Failed to prepare subscription: ' + err.message, 'Critical');
    } finally {
      setSubscribing(false);
    }
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
        const { token, role: userRole, username: userName, id: userId } = res.data;
        loginUser(token, userRole, userName, userId);
        addToast(`Welcome back, ${userName}!`, 'Low');
        
        if (userRole === 'admin') {
          navigate('/admin');
        } else {
          navigate('/');
        }
      } else {
        // Register API Call
        const res = await register(
          username, 
          password, 
          role, 
          district, 
          nearestStationId ? parseInt(nearestStationId, 10) : null
        );

        const registeredUserId = res.data?.user_id;
        
        if (subscription && registeredUserId) {
          try {
            const payload = subscription.toJSON();
            await subscribeToAlerts({
              endpoint: payload.endpoint,
              p256dh: payload.keys?.p256dh,
              auth: payload.keys?.auth
            }, registeredUserId);
            console.log("Successfully subscribed user to early warnings upon registration.");
          } catch (pushErr) {
            console.error("Failed to register alert subscription after sign up:", pushErr);
          }
        }

        addToast('Registration successful! Please log in.', 'Low');
        setIsLogin(true);
        setPassword('');
        setDistrict('');
        setNearestStationId('');
        setSubscription(null);
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
      <div className={`glass-card login-page-card ${!isLogin ? 'register-mode' : ''}`}>
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

        <form onSubmit={handleSubmit} className={`login-form-grid ${!isLogin ? 'register-mode' : ''}`}>
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

              <div className="form-group" style={{ marginTop: 'var(--sp-2)' }}>
                <label className="form-label">Alert Subscription</label>
                <button
                  type="button"
                  className={`btn ${subscription ? 'btn-secondary' : 'btn-primary'} w-full justify-center`}
                  onClick={handleSubscribe}
                  disabled={subscribing}
                >
                  {subscribing ? '⌛ Requesting Permission...' : subscription ? '🔔 Early Warnings Enabled' : '🔔 Enable Early Warning Alerts'}
                </button>
                <p className="text-xs text-muted" style={{ marginTop: 'var(--sp-1)', textAlign: 'center' }}>
                  Enabling alerts configures Web Push notifications on this device.
                </p>
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full justify-center form-submit-btn"
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
                setSubscription(null);
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
