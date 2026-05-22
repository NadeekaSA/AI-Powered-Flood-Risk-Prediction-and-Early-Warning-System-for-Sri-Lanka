import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from './ToastManager';
import {
  getPredictions,
  getRiverLevels,
  getAlerts,
  createAlert,
  simulateRainfall,
  downloadReport
} from '../api';

const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Ratnapura', 'Galle', 
  'Matara', 'Kurunegala', 'Kegalle', 'Hambantota', 'Kandy', 
  'Moneragala', 'Badulla', 'Anuradhapura', 'Ampara', 'Polonnaruwa', 'Nuwara Eliya'
];

// Color mappings from CSS design system
const RISK_COLORS = {
  Low: '#22c55e',       // green
  Medium: '#eab308',    // yellow
  High: '#f97316',      // orange
  Critical: '#ef4444'   // red
};

const getStatusClass = (status) => {
  if (!status) return 'Low';
  const s = status.toLowerCase();
  if (s.includes('major')) return 'Critical';
  if (s.includes('minor')) return 'High';
  if (s.includes('alert') || s.includes('warning')) return 'Medium';
  return 'Low';
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Route protection check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      addToast('Access denied: Administrator privileges required.', 'Critical');
      navigate('/');
    }
  }, [user, navigate, addToast]);

  const [activeSubTab, setActiveSubTab] = useState('overview'); // overview, simulator, broadcast, stations, reports
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data states
  const [predictions, setPredictions] = useState([]);
  const [stations, setStations] = useState([]);
  const [alerts, setAlerts] = useState([]);

  // Simulation state
  const [simValues, setSimValues] = useState(() => {
    const vals = {};
    DISTRICTS.forEach((d) => {
      vals[d] = { daily: 15.0, cumulative: 45.0, trend: 2.0 };
    });
    return vals;
  });

  // Manual Alert state
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertRiskLevel, setAlertRiskLevel] = useState('Medium');
  const [alertDistrict, setAlertDistrict] = useState('All');

  // Load all dashboard statistics
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [predRes, stationRes, alertRes] = await Promise.all([
        getPredictions(),
        getRiverLevels(),
        getAlerts()
      ]);
      setPredictions(predRes.data);
      setStations(stationRes.data);
      setAlerts(alertRes.data);
    } catch (err) {
      console.error(err);
      addToast('Failed to load admin console data: ' + err.message, 'Critical');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadDashboardData();
    }
  }, [user]);

  // Derived counts for overview cards
  const stats = React.useMemo(() => {
    const totalGrids = predictions.length;
    const critical = predictions.filter((p) => p.predicted_risk === 'Critical').length;
    const high = predictions.filter((p) => p.predicted_risk === 'High').length;
    const medium = predictions.filter((p) => p.predicted_risk === 'Medium').length;
    const low = predictions.filter((p) => p.predicted_risk === 'Low').length;

    return { totalGrids, critical, high, medium, low };
  }, [predictions]);

  // Handler for Rainfall Simulation Run
  const handleSimulationSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await simulateRainfall(simValues);
      const { critical_cells, predictions: updatedPreds } = res.data;
      setPredictions(updatedPreds);
      
      if (critical_cells > 0) {
        addToast(
          `Simulation completed! Warning: ${critical_cells} zones entered Critical Risk. Early warnings broadcasted.`,
          'Critical'
        );
      } else {
        addToast('Simulation completed. All zones remain within stable parameters.', 'Low');
      }
    } catch (err) {
      console.error(err);
      addToast('Rainfall simulation execution failed: ' + err.message, 'Critical');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimValueChange = (district, field, value) => {
    setSimValues((prev) => ({
      ...prev,
      [district]: {
        ...prev[district],
        [field]: parseFloat(value)
      }
    }));
  };

  // Handler to broadcast manual alert
  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!alertTitle || !alertMessage) {
      addToast('Please fill out all alert fields.', 'Medium');
      return;
    }

    setSubmitting(true);
    try {
      const dist = alertDistrict === 'All' ? null : alertDistrict;
      await createAlert(alertTitle, alertMessage, alertRiskLevel, dist);
      addToast('Alert published and broadcast to all push subscribers!', 'Low');
      setAlertTitle('');
      setAlertMessage('');
      setAlertRiskLevel('Medium');
      setAlertDistrict('All');
      // Refresh alerts list
      const alertRes = await getAlerts();
      setAlerts(alertRes.data);
    } catch (err) {
      console.error(err);
      addToast('Alert broadcast transmission failed: ' + err.message, 'Critical');
    } finally {
      setSubmitting(false);
    }
  };

  // Sync DMC stations live
  const handleSyncDMC = async () => {
    setSubmitting(true);
    try {
      const stationRes = await getRiverLevels(true);
      setStations(stationRes.data);
      addToast('Live hydrological records synced from DMC.', 'Low');
    } catch (err) {
      console.error(err);
      addToast('Failed to scrape DMC data: ' + err.message, 'Critical');
    } finally {
      setSubmitting(false);
    }
  };

  // Download CSV report
  const handleDownloadReport = async () => {
    try {
      const res = await downloadReport();
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `floodwatch_risk_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      addToast('CSV Export downloaded successfully.', 'Low');
    } catch (err) {
      console.error(err);
      addToast('Failed to compile report: ' + err.message, 'Critical');
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="admin-layout flex-1">
      {/* Admin Sidebar Navigation */}
      <aside className="admin-sidebar">
        <h3
          className="font-display font-bold text-sm text-muted"
          style={{ padding: 'var(--sp-2) var(--sp-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Console Modules
        </h3>
        <div
          className={`admin-nav-item ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
        >
          📊 Risk Overview
        </div>
        <div
          className={`admin-nav-item ${activeSubTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('simulator')}
        >
          🌦️ Monsoon Simulator
        </div>
        <div
          className={`admin-nav-item ${activeSubTab === 'broadcast' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('broadcast')}
        >
          📢 Alert Dispatcher
        </div>
        <div
          className={`admin-nav-item ${activeSubTab === 'stations' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('stations')}
        >
          🌊 Station Manager
        </div>
        <div
          className={`admin-nav-item ${activeSubTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('reports')}
        >
          📥 Reports & Exports
        </div>
      </aside>

      {/* Main Admin Content Container */}
      <main className="admin-content">
        {loading ? (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Initializing Administrative console modules...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeSubTab === 'overview' && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="font-display font-bold">Risk Management Overview</h2>
                  <p className="text-sm text-muted">Summary metrics calculated from live spatial grid predictions.</p>
                </div>

                <div className="grid grid-4 gap-4">
                  <div className="stat-card">
                    <span className="stat-icon">🗺️</span>
                    <div className="stat-value">{stats.totalGrids}</div>
                    <div className="stat-label">Total Grids Monitored</div>
                  </div>
                  <div className="stat-card" style={{ borderColor: 'var(--risk-critical)' }}>
                    <span className="stat-icon">🔴</span>
                    <div className="stat-value" style={{ color: 'var(--risk-critical)' }}>{stats.critical}</div>
                    <div className="stat-label">Critical Risk Zones</div>
                  </div>
                  <div className="stat-card" style={{ borderColor: 'var(--risk-high)' }}>
                    <span className="stat-icon">🟠</span>
                    <div className="stat-value" style={{ color: 'var(--risk-high)' }}>{stats.high}</div>
                    <div className="stat-label">High Risk Zones</div>
                  </div>
                  <div className="stat-card" style={{ borderColor: 'var(--risk-medium)' }}>
                    <span className="stat-icon">🟡</span>
                    <div className="stat-value" style={{ color: 'var(--risk-medium)' }}>{stats.medium}</div>
                    <div className="stat-label">Medium Risk Zones</div>
                  </div>
                </div>

                {/* ML Models Card */}
                <div className="glass-card" style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-2)' }}>
                  <h3 className="font-display font-bold" style={{ marginBottom: 'var(--sp-4)' }}>
                    🧠 Machine Learning Model Status
                  </h3>
                  <div className="grid grid-2 gap-6">
                    <div style={{ borderRight: '1px solid var(--border-subtle)', paddingRight: 'var(--sp-6)' }}>
                      <h4 className="text-sm font-bold text-primary" style={{ marginBottom: 'var(--sp-2)' }}>
                        Random Forest Classifier (Risk Level)
                      </h4>
                      <p className="text-xs text-muted" style={{ marginBottom: 'var(--sp-4)' }}>
                        Predicts flood risk categories (Low, Medium, High, Critical) using a 15-tree ensemble model.
                      </p>
                      <div className="flex justify-between text-sm" style={{ marginBottom: 'var(--sp-2)' }}>
                        <span>Validation Accuracy:</span>
                        <strong style={{ color: 'var(--risk-low)' }}>88.12%</strong>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>F1-Score (Weighted):</span>
                        <strong>0.879</strong>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-primary" style={{ marginBottom: 'var(--sp-2)' }}>
                        Linear Regression Model (Inundation Depth)
                      </h4>
                      <p className="text-xs text-muted" style={{ marginBottom: 'var(--sp-4)' }}>
                        Forecasts numerical maximum inundation depth (m) using stochastic gradient descent.
                      </p>
                      <div className="flex justify-between text-sm" style={{ marginBottom: 'var(--sp-2)' }}>
                        <span>Root Mean Square Error:</span>
                        <strong style={{ color: 'var(--risk-low)' }}>0.1427 m</strong>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Mean Absolute Error:</span>
                        <strong>0.0984 m</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MONSOON SIMULATOR TAB */}
            {activeSubTab === 'simulator' && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="font-display font-bold">🌦️ Monsoon Rainfall Simulator</h2>
                  <p className="text-sm text-muted">
                    Alter district-level rainfall features to evaluate spatial risk changes via the ML inference pipeline.
                  </p>
                </div>

                <form onSubmit={handleSimulationSubmit} className="flex flex-col gap-6 w-full">
                  <div className="grid grid-2 gap-6 w-full">
                    {DISTRICTS.map((d) => (
                      <div key={d} className="glass-card" style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                        <h4 className="text-sm font-bold" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                          📍 {d} District
                        </h4>
                        
                        {/* Daily Rainfall Slider */}
                        <div className="slider-group">
                          <div className="slider-label-row">
                            <span className="slider-label">Daily Rainfall (24h)</span>
                            <span className="slider-val">{simValues[d].daily.toFixed(1)} mm</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="300"
                            step="0.5"
                            value={simValues[d].daily}
                            onChange={(e) => handleSimValueChange(d, 'daily', e.target.value)}
                          />
                        </div>

                        {/* Cumulative Rainfall Slider */}
                        <div className="slider-group">
                          <div className="slider-label-row">
                            <span className="slider-label">Cumulative Rainfall (3-Day)</span>
                            <span className="slider-val">{simValues[d].cumulative.toFixed(1)} mm</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="600"
                            step="1.0"
                            value={simValues[d].cumulative}
                            onChange={(e) => handleSimValueChange(d, 'cumulative', e.target.value)}
                          />
                        </div>

                        {/* Weekly Trend Slider */}
                        <div className="slider-group">
                          <div className="slider-label-row">
                            <span className="slider-label">Weekly Rain Trend</span>
                            <span className="slider-val">{simValues[d].trend.toFixed(1)} mm</span>
                          </div>
                          <input
                            type="range"
                            min="-10"
                            max="50"
                            step="0.5"
                            value={simValues[d].trend}
                            onChange={(e) => handleSimValueChange(d, 'trend', e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg justify-center w-full"
                    disabled={submitting}
                    style={{ marginTop: 'var(--sp-4)' }}
                  >
                    {submitting ? '⌛ Processing ML Rescoring...' : '🌦️ Run Rainfall Simulation Model'}
                  </button>
                </form>
              </div>
            )}

            {/* ALERT DISPATCHER TAB */}
            {activeSubTab === 'broadcast' && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="font-display font-bold">📢 Early Warning Alert Dispatcher</h2>
                  <p className="text-sm text-muted">
                    Broadcast a manual warning alert. Logged in users and active push subscribers will receive notifications.
                  </p>
                </div>

                <div className="grid grid-2 gap-6 w-full">
                  {/* Broadcast Form */}
                  <div className="glass-card" style={{ padding: 'var(--sp-6)' }}>
                    <h3 className="font-display font-bold" style={{ marginBottom: 'var(--sp-4)', fontSize: '1.1rem' }}>
                      Publish New Broadcast
                    </h3>
                    
                    <form onSubmit={handleCreateAlert} className="flex flex-col gap-4">
                      <div className="form-group">
                        <label className="form-label">Alert Title</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Kelani Ganga Basin Inundation Warning"
                          value={alertTitle}
                          onChange={(e) => setAlertTitle(e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Warning Message</label>
                        <textarea
                          className="form-input"
                          style={{ minHeight: '100px', resize: 'vertical' }}
                          placeholder="Provide evacuation instructions or warning details..."
                          value={alertMessage}
                          onChange={(e) => setAlertMessage(e.target.value)}
                          required
                        ></textarea>
                      </div>

                      <div className="grid grid-2 gap-4">
                        <div className="form-group">
                          <label className="form-label">Risk Severity</label>
                          <select
                            className="form-input"
                            value={alertRiskLevel}
                            onChange={(e) => setAlertRiskLevel(e.target.value)}
                          >
                            <option value="Low">Low Risk</option>
                            <option value="Medium">Medium Warning</option>
                            <option value="High">High Danger</option>
                            <option value="Critical">Critical Evacuation</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Target District</label>
                          <select
                            className="form-input"
                            value={alertDistrict}
                            onChange={(e) => setAlertDistrict(e.target.value)}
                          >
                            <option value="All">All Sri Lanka (Global)</option>
                            {DISTRICTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary w-full justify-center"
                        style={{ marginTop: 'var(--sp-2)' }}
                        disabled={submitting}
                      >
                        {submitting ? '⌛ Transmitting...' : '📢 Broadcast Alert'}
                      </button>
                    </form>
                  </div>

                  {/* Active Alerts List */}
                  <div className="glass-card" style={{ padding: 'var(--sp-6)', display: 'flex', flexDirection: 'column' }}>
                    <h3 className="font-display font-bold" style={{ marginBottom: 'var(--sp-4)', fontSize: '1.1rem' }}>
                      Active Logged Alerts
                    </h3>
                    
                    <div className="panel-scroll flex flex-col gap-3" style={{ flex: 1, maxHeight: '380px' }}>
                      {alerts.length === 0 ? (
                        <p className="text-xs text-muted text-center" style={{ padding: 'var(--sp-4)' }}>
                          No broadcast warning logs on file.
                        </p>
                      ) : (
                        alerts.map((al) => (
                          <div
                            key={al.id}
                            style={{
                              padding: 'var(--sp-3)',
                              background: 'var(--clr-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                              borderLeft: `4px solid ${RISK_COLORS[al.risk_level]}`
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <strong className="text-sm" style={{ color: 'var(--clr-text-100)' }}>
                                {al.title}
                              </strong>
                              <span className={`risk-badge risk-badge-${al.risk_level}`} style={{ fontSize: '0.65rem', padding: '0 4px' }}>
                                {al.risk_level}
                              </span>
                            </div>
                            <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
                              {al.message}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--clr-text-400)', marginTop: '6px' }}>
                              <span>📍 District: {al.district || 'Global'}</span>
                              <span>{new Date(al.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STATION MANAGER TAB */}
            {activeSubTab === 'stations' && (
              <div className="flex flex-col gap-6 w-full">
                <div className="flex justify-between items-center w-full">
                  <div>
                    <h2 className="font-display font-bold">🌊 River Gauging Station Manager</h2>
                    <p className="text-sm text-muted">
                      Monitor live water heights and rate of rises fetched from DMC table logs.
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleSyncDMC}
                    disabled={submitting}
                  >
                    {submitting ? '🔄 Ingesting...' : '🔄 Pull Live DMC Levels'}
                  </button>
                </div>

                <div className="glass-card overflow-hidden">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Station Name</th>
                        <th>River</th>
                        <th>Basin</th>
                        <th>Water Height</th>
                        <th>Rate of Rise</th>
                        <th>DMC Alert Status</th>
                        <th>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stations.map((st) => (
                        <tr key={st.id}>
                          <td><strong>{st.station_name}</strong></td>
                          <td>{st.river_name}</td>
                          <td>{st.basin_name}</td>
                          <td style={{ color: 'var(--clr-primary)', fontWeight: 'bold' }}>
                            {st.current_level.toFixed(2)}m
                          </td>
                          <td
                            style={{
                              color: st.rate_of_rise > 0 ? 'var(--risk-critical)' : st.rate_of_rise < 0 ? 'var(--risk-low)' : 'var(--clr-text-300)',
                              fontWeight: 'bold'
                            }}
                          >
                            {st.rate_of_rise > 0 ? `+${st.rate_of_rise.toFixed(2)}m/h` : st.rate_of_rise < 0 ? `${st.rate_of_rise.toFixed(2)}m/h` : 'Static'}
                          </td>
                          <td>
                            <span className={`risk-badge risk-badge-${getStatusClass(st.alert_status)}`}>
                              {st.alert_status || 'Normal'}
                            </span>
                          </td>
                          <td className="text-muted text-xs">
                            {new Date(st.last_updated).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REPORTS TAB */}
            {activeSubTab === 'reports' && (
              <div className="flex flex-col gap-6 w-full">
                <div>
                  <h2 className="font-display font-bold">📥 Reports & Data Center</h2>
                  <p className="text-sm text-muted">Export prediction history and hydrological records.</p>
                </div>

                <div className="glass-card" style={{ padding: 'var(--sp-8)', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--sp-4)' }}>📊</span>
                  <h3 className="font-display font-bold" style={{ marginBottom: 'var(--sp-2)', fontSize: '1.25rem' }}>
                    Sri Lanka Spatial Flood Risk Data Report
                  </h3>
                  <p className="text-sm text-muted" style={{ marginBottom: 'var(--sp-6)' }}>
                    Download a comprehensive CSV summary of flood predictions across all 108 grid cells, containing geographical coordinate boundaries, nasa elevation matrices, topographical slopes, nearest station data, and final Random Forest risk probabilities.
                  </p>
                  <button
                    className="btn btn-primary btn-lg"
                    style={{ margin: '0 auto' }}
                    onClick={handleDownloadReport}
                  >
                    📥 Download CSV Dataset Report
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
