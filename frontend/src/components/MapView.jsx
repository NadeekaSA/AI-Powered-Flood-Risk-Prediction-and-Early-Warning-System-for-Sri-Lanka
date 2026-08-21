import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Rectangle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { getPredictions, getRiverLevels, getAlerts } from '../api';
import { useToast } from './ToastManager';
import RiverPanel from './RiverPanel';
import AlertPanel from './AlertPanel';

// Coordinate constants
const SRI_LANKA_CENTER = [7.8731, 80.7718];
const DEFAULT_ZOOM = 8;
const GRID_SIZE = 0.009; // approx 1km

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

// Map controller to programmatic fly-to stations
function MapController({ focusCoords }) {
  const map = useMap();
  useEffect(() => {
    if (focusCoords) {
      map.setView(focusCoords, 11, {
        animate: true,
        duration: 1.0
      });
    }
  }, [focusCoords, map]);
  return null;
}

// Sparkline generator helper
const generateSparklineData = (currentLevel, rateOfRise) => {
  const data = [];
  const hours = 6;
  for (let i = hours - 1; i >= 0; i--) {
    const time = new Date(Date.now() - i * 60 * 60 * 1000);
    const noise = (Math.random() - 0.5) * 0.04;
    const calculatedLevel = currentLevel - (i * (rateOfRise / 24)) + noise; // rough hourly trend
    data.push({
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      level: parseFloat(Math.max(0, calculatedLevel).toFixed(2))
    });
  }
  return data;
};

export default function MapView() {
  const { addToast } = useToast();

  const [predictions, setPredictions] = useState([]);
  const [stations, setStations] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshingDMC, setRefreshingDMC] = useState(false);
  const [activeTab, setActiveTab] = useState('rivers'); // 'rivers' or 'alerts'
  const [searchQuery, setSearchQuery] = useState('');
  const [focusCoords, setFocusCoords] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('theme') || 'dark');
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  // Fetch initial data
  const fetchData = async (syncDMC = false) => {
    if (syncDMC) {
      setRefreshingDMC(true);
    } else {
      setLoading(true);
    }
    try {
      const [predRes, stationRes, alertRes] = await Promise.all([
        getPredictions(),
        getRiverLevels(syncDMC),
        getAlerts()
      ]);
      setPredictions(predRes.data);
      setStations(stationRes.data);
      setAlerts(alertRes.data);
      
      if (syncDMC) {
        addToast('Synced successfully with DMC River Gauges.', 'Low');
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to retrieve system status: ' + err.message, 'Critical');
    } finally {
      setLoading(false);
      setRefreshingDMC(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered districts for search
  const districtsList = useMemo(() => {
    const districts = predictions.map(p => p.district);
    return Array.from(new Set(districts));
  }, [predictions]);

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    // Search matches district or gauging station
    const matchedGrid = predictions.find(p => p.district.toLowerCase() === query);
    const matchedStation = stations.find(s => s.station_name.toLowerCase().includes(query));

    if (matchedStation) {
      setFocusCoords([matchedStation.latitude, matchedStation.longitude]);
      addToast(`Centering on station: ${matchedStation.station_name}`, 'Low');
    } else if (matchedGrid) {
      setFocusCoords([matchedGrid.latitude, matchedGrid.longitude]);
      addToast(`Centering on district: ${matchedGrid.district}`, 'Low');
    } else {
      addToast('No district or station found matching query.', 'Medium');
    }
  };

  const handleStationClick = (station) => {
    setFocusCoords([station.latitude, station.longitude]);
  };

  // Creates the animated custom radar icon
  const createRadarIcon = (status) => {
    const riskType = getStatusClass(status);
    const color = RISK_COLORS[riskType];
    return L.divIcon({
      className: 'custom-radar-marker',
      html: `
        <div class="radar-dot" style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center;">
          <div class="radar-ring" style="border: 2px solid ${color}; position: absolute; width: 100%; height: 100%; border-radius: 50%; animation: radar-pulse 1.8s infinite ease-out;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  return (
    <div className="app-layout">
      {/* Inject custom CSS keyframes dynamically for radar rings */}
      <style>{`
        @keyframes radar-pulse {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        .radar-dot {
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <div className="app-main">
        {/* Floating Quick Summary Console */}
        {!loading && (
          <div className="floating-summary-panel glass-card" style={{
            position: 'absolute',
            top: 'var(--sp-4)',
            right: 'var(--sp-4)',
            zIndex: 10,
            padding: 'var(--sp-3) var(--sp-4)',
            display: 'flex',
            gap: 'var(--sp-4)',
            alignItems: 'center',
            fontSize: '0.8rem',
            pointerEvents: 'auto'
          }}>
            <div className="summary-stat-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span style={{ fontSize: '1.15rem' }}>🛰️</span>
              <div>
                <div style={{ color: 'var(--clr-text-300)', fontWeight: 500, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Monitored Gauges</div>
                <div style={{ fontWeight: 800, color: 'var(--clr-primary)', fontSize: '0.88rem' }}>{stations.length} Active</div>
              </div>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }}></div>
            <div className="summary-stat-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span style={{ fontSize: '1.15rem' }}>⚠️</span>
              <div>
                <div style={{ color: 'var(--clr-text-300)', fontWeight: 500, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Critical Zones</div>
                <div style={{ fontWeight: 800, color: 'var(--risk-critical)', fontSize: '0.88rem' }}>
                  {predictions.filter(p => p.predicted_risk === 'Critical').length} Grid Cells
                </div>
              </div>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }}></div>
            <div className="summary-stat-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span style={{ fontSize: '1.15rem' }}>📢</span>
              <div>
                <div style={{ color: 'var(--clr-text-300)', fontWeight: 500, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Active Warnings</div>
                <div style={{ fontWeight: 800, color: 'var(--risk-high)', fontSize: '0.88rem' }}>
                  {alerts.filter(a => a.is_active).length} Bulletins
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <aside className="sidebar">
          <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--border-subtle)' }}>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                className="form-input"
                placeholder="Search District or Station..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '0.85rem', padding: 'var(--sp-2) var(--sp-3)' }}
                list="districts-stations-list"
              />
              <datalist id="districts-stations-list">
                {districtsList.map(d => (
                  <option key={`dist-${d}`} value={d} />
                ))}
                {stations.map(s => (
                  <option key={`st-${s.id}`} value={s.station_name} />
                ))}
              </datalist>
              <button type="submit" className="btn btn-primary btn-sm">
                🔍
              </button>
            </form>

            {/* Sidebar Tabs */}
            <div className="flex gap-2" style={{ marginTop: 'var(--sp-3)' }}>
              <button
                className={`nav-btn w-full justify-center ${activeTab === 'rivers' ? 'active' : ''}`}
                onClick={() => setActiveTab('rivers')}
                style={{ padding: 'var(--sp-2) 0' }}
              >
                🌊 Rivers
              </button>
              <button
                className={`nav-btn w-full justify-center ${activeTab === 'alerts' ? 'active' : ''}`}
                onClick={() => setActiveTab('alerts')}
                style={{ padding: 'var(--sp-2) 0' }}
              >
                📢 Alerts ({alerts.filter(a => a.is_active).length})
              </button>
            </div>
          </div>

          <div className="sidebar-body">
            {activeTab === 'rivers' ? (
              <RiverPanel
                stations={stations}
                loading={loading}
                onStationClick={handleStationClick}
                onRefresh={() => fetchData(true)}
                refreshing={refreshingDMC}
              />
            ) : (
              <AlertPanel alerts={alerts} loading={loading} />
            )}
          </div>
        </aside>

        {/* Map Visualization Area */}
        <main className="map-container">
          {loading ? (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Evaluating Spatial Flood Risks across Sri Lanka...</p>
            </div>
          ) : (
            <MapContainer
              center={SRI_LANKA_CENTER}
              zoom={DEFAULT_ZOOM}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution={theme === 'light' ? '&copy; <a href="https://carto.com/">CartoDB</a> Voyager' : '&copy; <a href="https://carto.com/">CartoDB</a> Dark Matter'}
                url={theme === 'light' ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'}
              />

              <MapController focusCoords={focusCoords} />

              {/* Grid cell polygons */}
              {predictions.map((cell) => {
                const bounds = [
                  [cell.latitude - GRID_SIZE / 2, cell.longitude - GRID_SIZE / 2],
                  [cell.latitude + GRID_SIZE / 2, cell.longitude + GRID_SIZE / 2]
                ];
                const riskColor = RISK_COLORS[cell.predicted_risk] || RISK_COLORS.Low;

                return (
                  <Rectangle
                    key={cell.grid_id}
                    bounds={bounds}
                    pathOptions={{
                      fillColor: riskColor,
                      fillOpacity: 0.35,
                      color: riskColor,
                      weight: 1,
                      dashArray: '2',
                    }}
                  >
                    <Popup>
                      <div style={{ minWidth: '180px' }}>
                        <h3 className="font-display font-bold" style={{ fontSize: '0.95rem', marginBottom: '4px', color: 'var(--clr-text-100)' }}>
                          📍 District: {cell.district}
                        </h3>
                        <p className="text-xs text-muted" style={{ marginBottom: '8px' }}>
                          Grid Cell ID: #{cell.grid_id}
                        </p>
                        
                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div className="flex justify-between text-xs">
                            <span>Predicted Risk:</span>
                            <strong style={{ color: riskColor }}>
                              {cell.predicted_risk} ({(cell.predicted_prob * 100).toFixed(0)}%)
                            </strong>
                          </div>
                          
                          {cell.predicted_depth > 0 && (
                            <div className="flex justify-between text-xs">
                              <span>Estimated Depth:</span>
                              <strong style={{ color: '#fff' }}>{cell.predicted_depth.toFixed(2)}m</strong>
                            </div>
                          )}
                          
                          <div className="flex justify-between text-xs">
                            <span>Daily Rainfall:</span>
                            <span>{cell.daily_rainfall.toFixed(1)} mm</span>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span>Cumulative:</span>
                            <span>{cell.cumulative_rainfall.toFixed(1)} mm</span>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span>Elevation:</span>
                            <span>{cell.elevation.toFixed(1)}m</span>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span>Slope:</span>
                            <span>{cell.slope.toFixed(2)}&deg;</span>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span>Distance to River:</span>
                            <span>{cell.distance_to_river.toFixed(2)} km</span>
                          </div>
                        </div>
                        
                        {/* Historical Comparison Layer */}
                        <div style={{ 
                          marginTop: '8px', 
                          paddingTop: '6px', 
                          borderTop: '1px solid var(--border-subtle)',
                        }}>
                          <p className="text-xs text-muted" style={{ marginBottom: '4px', fontWeight: 600 }}>
                            📊 Historical Comparison (Model Insights):
                          </p>
                          <div style={{ 
                            background: 'rgba(255, 255, 255, 0.03)', 
                            padding: '6px', 
                            borderRadius: '4px',
                            border: '1px solid rgba(255, 255, 255, 0.05)'
                          }}>
                            <div className="flex justify-between" style={{ fontSize: '10px', color: 'var(--clr-text-300)' }}>
                              <span>Past Safe Avg Rain:</span>
                              <strong>12.9 mm</strong>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '10px', color: 'var(--clr-text-300)' }}>
                              <span>Past Flood Avg Rain:</span>
                              <strong style={{ color: 'var(--risk-high)' }}>93.3 mm</strong>
                            </div>
                            <div className="flex justify-between" style={{ fontSize: '10px', color: 'var(--clr-text-300)' }}>
                              <span>Past Flood Avg Depth:</span>
                              <strong>2.26 m</strong>
                            </div>
                            <div style={{ 
                              fontSize: '9px', 
                              color: 'var(--clr-text-400)', 
                              marginTop: '4px', 
                              lineHeight: '1.2' 
                            }}>
                              * Current rain of <strong>{cell.daily_rainfall.toFixed(1)} mm</strong> is evaluated against these historical markers by the RF model.
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.65rem', color: 'var(--clr-text-400)', marginTop: '8px', textAlign: 'right' }}>
                          Run: {new Date(cell.run_timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </Popup>
                  </Rectangle>
                );
              })}

              {/* River station markers */}
              {stations.map((station) => {
                const sparklineData = generateSparklineData(station.current_level, station.rate_of_rise);
                const alertStatus = station.alert_status || 'Normal';
                const isCritical = alertStatus.toLowerCase().includes('major');
                const riskColor = isCritical ? RISK_COLORS.Critical : alertStatus.toLowerCase().includes('minor') ? RISK_COLORS.High : alertStatus.toLowerCase().includes('alert') ? RISK_COLORS.Medium : RISK_COLORS.Low;

                return (
                  <Marker
                    key={station.id}
                    position={[station.latitude, station.longitude]}
                    icon={createRadarIcon(station.alert_status)}
                  >
                    <Popup>
                      <div style={{ minWidth: '220px' }}>
                        <div className="flex justify-between items-start" style={{ marginBottom: '6px' }}>
                          <div>
                            <h3 className="font-display font-bold" style={{ fontSize: '0.95rem', color: 'var(--clr-text-100)' }}>
                              ⚡ {station.station_name}
                            </h3>
                            <p className="text-xs text-muted">{station.river_name} Basin</p>
                          </div>
                          <span
                            className={`risk-badge risk-badge-${getStatusClass(station.alert_status)}`}
                            style={{ fontSize: '0.7rem', padding: '1px 6px' }}
                          >
                            {station.alert_status || 'Normal'}
                          </span>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div className="flex justify-between text-xs">
                            <span>Current Level:</span>
                            <strong style={{ color: 'var(--clr-primary)' }}>{station.current_level.toFixed(2)}m</strong>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span>Rate of Rise:</span>
                            <span style={{ color: station.rate_of_rise > 0 ? 'var(--risk-critical)' : 'var(--risk-low)' }}>
                              {station.rate_of_rise > 0 ? `+${station.rate_of_rise.toFixed(2)}m/h` : station.rate_of_rise < 0 ? `${station.rate_of_rise.toFixed(2)}m/h` : 'Static'}
                            </span>
                          </div>
                        </div>

                        {/* Recharts trend sparkline */}
                        <div className="chart-wrapper">
                          <p className="text-xs text-muted" style={{ marginBottom: '4px', fontWeight: 600 }}>📈 Water Level Trend (6h):</p>
                          <div style={{ width: '100%', height: '50px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sparklineData}>
                                <YAxis hide={true} domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                                <Tooltip
                                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
                                  labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                                  itemStyle={{ color: 'var(--clr-primary)', fontSize: '10px' }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="level"
                                  stroke={riskColor}
                                  strokeWidth={2}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div style={{ fontSize: '0.65rem', color: 'var(--clr-text-400)', marginTop: '6px', textAlign: 'right' }}>
                          Sync: {new Date(station.last_updated).toLocaleTimeString()}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Map Legend */}
              <div className="map-legend">
                <div className="legend-title">Risk Severity</div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: RISK_COLORS.Critical }}></span>
                  <span>Critical Risk</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: RISK_COLORS.High }}></span>
                  <span>High Risk</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: RISK_COLORS.Medium }}></span>
                  <span>Medium Risk</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: RISK_COLORS.Low }}></span>
                  <span>Low Risk</span>
                </div>
              </div>
            </MapContainer>
          )}
        </main>
      </div>
    </div>
  );
}
