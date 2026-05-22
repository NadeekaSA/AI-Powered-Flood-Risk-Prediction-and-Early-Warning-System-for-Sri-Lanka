import React from 'react';

export default function AlertPanel({ alerts, loading }) {
  const activeAlerts = alerts.filter(a => a.is_active);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="section-header" style={{ marginBottom: 'var(--sp-3)' }}>
        <div className="section-title">
          📢 Active Broadcast Alerts
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : activeAlerts.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: 'var(--sp-4)',
            textAlign: 'center',
            color: 'var(--clr-text-300)'
          }}
        >
          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}>🟢</span>
          <p className="text-sm font-bold">No Active Flood Alerts</p>
          <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
            All systems normal. River basins are within safe hydrological levels.
          </p>
        </div>
      ) : (
        <div className="panel-scroll flex flex-col gap-3" style={{ flex: 1, paddingRight: '2px' }}>
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`alert-banner alert-banner-${alert.risk_level}`}
            >
              <div className="w-full">
                <div className="flex justify-between items-center w-full">
                  <span className="alert-banner-title">{alert.title}</span>
                  {alert.district && (
                    <span
                      className="text-xs font-bold"
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}
                    >
                      📍 {alert.district}
                    </span>
                  )}
                </div>
                <p className="alert-banner-message">{alert.message}</p>
                <div
                  className="text-xs text-muted"
                  style={{
                    marginTop: 'var(--sp-2)',
                    fontSize: '0.7rem',
                    textAlign: 'right',
                    opacity: 0.8
                  }}
                >
                  Broadcast: {new Date(alert.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
