import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from './ToastManager';
import { subscribeToAlerts } from '../api';

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

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Check if browser supports service worker and push manager
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then(async (subscription) => {
          setIsSubscribed(!!subscription);
          
          // Sync with backend if subscription exists to ensure database integrity (e.g. after database seeding/resets)
          if (subscription) {
            try {
              const payload = subscription.toJSON();
              await subscribeToAlerts({
                endpoint: payload.endpoint,
                p256dh: payload.keys?.p256dh,
                auth: payload.keys?.auth
              }, user?.id || null);
              console.log('Push subscription successfully synchronized with database.');
            } catch (err) {
              console.error('Failed to sync existing push subscription with backend:', err);
            }
          }
        });
      });
    }
  }, [user]);

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
      // Request notification permission
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

      const subscriptionOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      };

      const subscription = await registration.pushManager.subscribe(subscriptionOptions);

      // Send to backend
      const payload = subscription.toJSON();
      await subscribeToAlerts({
        endpoint: payload.endpoint,
        p256dh: payload.keys?.p256dh,
        auth: payload.keys?.auth
      }, user?.id || null);

      setIsSubscribed(true);
      addToast('Successfully subscribed to early warning flood alerts!', 'Low');
    } catch (err) {
      console.error('Subscription error:', err);
      addToast('Failed to subscribe: ' + err.message, 'Critical');
    } finally {
      setSubscribing(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    addToast('Logged out successfully.', 'Low');
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        🌊 FloodWatch <span>SL</span>
      </div>

      <div className="navbar-live">
        <span className="live-dot"></span>
        Live Monitoring
      </div>

      <div className="navbar-nav">
        <button
          className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          📍 <span className="nav-btn-text">Map View</span>
        </button>

        {user?.role === 'admin' && (
          <button
            className={`nav-btn ${location.pathname === '/admin' ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            ⚙️ <span className="nav-btn-text">Admin Panel</span>
          </button>
        )}

        <button
          className={`btn ${isSubscribed ? 'btn-secondary' : 'btn-primary'} btn-sm`}
          onClick={handleSubscribe}
          disabled={subscribing || isSubscribed}
          style={{ marginRight: '10px' }}
        >
          {subscribing ? '⌛' : '🔔'} <span className="nav-btn-text">{subscribing ? 'Connecting...' : isSubscribed ? 'Subscribed' : 'Get Alerts'}</span>
        </button>

        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted" style={{ marginRight: '5px' }}>
              <span className="nav-user-welcome">Hi, </span><strong style={{ color: 'var(--clr-text-100)' }}>{user.username}</strong>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              🚪 <span className="nav-btn-text">Logout</span>
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>
            🔑 <span className="nav-btn-text">Login</span>
          </button>
        )}
      </div>
    </nav>
  );
}
