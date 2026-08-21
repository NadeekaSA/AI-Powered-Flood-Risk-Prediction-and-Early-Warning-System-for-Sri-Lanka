import React, { useState } from 'react';

export default function AlertPanel({ alerts, loading }) {
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');

  const activeAlerts = alerts.filter(a => a.is_active);

  // Extract unique districts from active alerts
  const uniqueDistricts = Array.from(new Set(activeAlerts.map(a => a.district).filter(Boolean)));

  const filteredAlerts = activeAlerts.filter(a => {
    const matchesLevel = filterLevel === 'All' || a.risk_level === filterLevel;
    const matchesDistrict = filterDistrict === 'All' || a.district === filterDistrict;
    return matchesLevel && matchesDistrict;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="section-header" style={{ marginBottom: 'var(--sp-2)' }}>
        <div className="section-title">
          📢 Active Warnings Feed
        </div>
      </div>

      {/* Filter Control Board */}
      <div style={{
        padding: '0 0 var(--sp-3) 0',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 'var(--sp-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-2)'
      }}>
        <div className="flex gap-2">
          <div className="w-half">
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Severity</label>
            <select
              className="form-input"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
            >
              <option value="All">All Warnings</option>
              <option value="Critical">🔴 Critical</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🟢 Low</option>
            </select>
          </div>
          <div className="w-half">
            <label className="form-label" style={{ fontSize: '0.65rem' }}>District</label>
            <select
              className="form-input"
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
            >
              <option value="All">All Districts</option>
              {uniqueDistricts.map(dist => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : activeAlerts.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: 'var(--sp-6) var(--sp-4)',
            textAlign: 'center',
            color: 'var(--clr-text-300)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--sp-2)'
          }}
        >
          <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 10px rgba(74, 222, 128, 0.2))' }}>🟢</span>
          <h4 className="text-sm font-bold font-display" style={{ color: 'var(--clr-text-100)' }}>All Clear</h4>
          <p className="text-xs text-muted" style={{ lineHeight: '1.4' }}>
            No active hydrological or meteorological warning bulletins are broadcast in monitored regions.
          </p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center text-xs text-muted" style={{ padding: 'var(--sp-6)' }}>
          No warning bulletins match the selected filters.
        </div>
      ) : (
        <div className="panel-scroll flex flex-col gap-3.5" style={{ flex: 1, paddingRight: '4px' }}>
          {filteredAlerts.map((alert) => {
            const riskColors = {
              Low: 'var(--risk-low)',
              Medium: 'var(--risk-medium)',
              High: 'var(--risk-high)',
              Critical: 'var(--risk-critical)'
            };
            const alertColor = riskColors[alert.risk_level] || 'var(--clr-text-300)';

            return (
              <div
                key={alert.id}
                className={`alert-banner alert-banner-${alert.risk_level}`}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  paddingLeft: 'var(--sp-4)'
                }}
              >
                {/* Left indicator accent strip */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '3.5px',
                  backgroundColor: alertColor
                }}></div>

                <div className="w-full">
                  <div className="flex justify-between items-center w-full" style={{ marginBottom: '6px' }}>
                    <span 
                      className="alert-banner-title" 
                      style={{ 
                        color: alertColor,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      {alert.title}
                    </span>
                    {alert.district && (
                      <span
                        className="text-xs font-bold"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          fontSize: '0.65rem',
                          color: 'var(--clr-text-200)'
                        }}
                      >
                        📍 {alert.district}
                      </span>
                    )}
                  </div>
                  <p className="alert-banner-message" style={{ margin: 0, lineHeight: 1.4 }}>
                    {alert.message}
                  </p>
                  <div
                    className="text-xs text-muted"
                    style={{
                      marginTop: 'var(--sp-2.5)',
                      fontSize: '0.68rem',
                      textAlign: 'right',
                      opacity: 0.75,
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      paddingTop: '6px'
                    }}
                  >
                    Broadcast: {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
