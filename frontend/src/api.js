import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE });

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fw_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const login = (username, password) =>
  api.post('/auth/login', { username, password });
export const register = (username, password, role, district = null, nearestStationId = null) =>
  api.post('/auth/register', { username, password, role, district, nearest_station_id: nearestStationId });

// Hydrology
export const getRiverLevels = (refresh = false) =>
  api.get(`/river-levels?refresh=${refresh}`);

// Predictions
export const getPredictions = () => api.get('/predictions');

// Alerts
export const getAlerts = () => api.get('/alerts');
export const subscribeToAlerts = (subscriptionObj, userId = null) =>
  api.post('/alerts/subscribe', { ...subscriptionObj, user_id: userId });

// Admin
export const createAlert = (title, message, riskLevel, district) =>
  api.post('/admin/alerts', { title, message, risk_level: riskLevel, district });
export const simulateRainfall = (districtRain) =>
  api.post('/admin/simulate', { district_rain: districtRain });

// Reports
export const downloadReport = () =>
  api.get('/reports', { responseType: 'blob' });

export default api;
