import React from 'react';

const getStatusClass = (status) => {
  if (!status) return 'Low';
  const s = status.toLowerCase();
  if (s.includes('major')) return 'Critical';
  if (s.includes('minor')) return 'High';
  if (s.includes('alert') || s.includes('warning')) return 'Medium';
  return 'Low';
};

const getRateIndicator = (rate) => {
  if (!rate) return { text: 'Static', icon: '➖', color: 'var(--clr-text-300)', bg: 'rgba(255, 255, 255, 0.04)' };
  if (rate > 0) return { text: `Rising (+${rate.toFixed(2)} m/h)`, icon: '📈', color: 'var(--risk-critical)', bg: 'var(--risk-critical-bg)' };
  if (rate < 0) return { text: `Falling (${rate.toFixed(2)} m/h)`, icon: '📉', color: 'var(--risk-low)', bg: 'var(--risk-low-bg)' };
  return { text: 'Static', icon: '➖', color: 'var(--clr-text-300)', bg: 'rgba(255, 255, 255, 0.04)' };
};

export default function RiverPanel({ stations, loading, onStationClick, onRefresh, refreshing }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="section-header" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="section-title">
          🌊 River Telemetry Gauges
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={loading || refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {refreshing ? '🔄 Syncing...' : '🔄 Sync DMC'}
        </button>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : stations.length === 0 ? (
        <p className="text-sm text-muted text-center" style={{ padding: 'var(--sp-6)' }}>
          No gauging station data available.
        </p>
      ) : (
        <div className="panel-scroll flex-col flex gap-3.5" style={{ flex: 1, paddingRight: '4px' }}>
          {stations.map((station) => {
            const statusClass = getStatusClass(station.alert_status);
            const rateInfo = getRateIndicator(station.rate_of_rise);
            
            // Establish an estimated capacity indicator based on standard station level ratios
            // (e.g., most stations alert around 4-6m, minor flood around 8-10m, major at 10-12m)
            const estimatedMax = 12.0; 
            const levelPercentage = Math.min(100, Math.max(5, (station.current_level / estimatedMax) * 100));

            return (
              <div
                key={station.id}
                className="glass-card"
                style={{
                  padding: 'var(--sp-4)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-3)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => onStationClick(station)}
              >
                {/* Left vertical visual marker for quick risk parsing */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  backgroundColor: `var(--risk-${statusClass.toLowerCase()})`
                }}></div>

                <div className="flex justify-between items-start w-full">
                  <div>
                    <h4 className="text-sm font-bold font-display" style={{ color: 'var(--clr-text-100)', letterSpacing: '0.01em' }}>
                      📍 {station.station_name}
                    </h4>
                    <span 
                      className="text-xs text-muted" 
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        marginTop: '4px',
                        display: 'inline-block'
                      }}
                    >
                      {station.river_name} Basin
                    </span>
                  </div>
                  <span className={`risk-badge risk-badge-${statusClass}`}>
                    {station.alert_status || 'Normal'}
                  </span>
                </div>

                <div className="flex justify-between items-center w-full" style={{ marginTop: 'var(--sp-1)' }}>
                  <div>
                    <span className="text-xs text-muted" style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Current Level</span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--clr-text-100)', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                      {station.current_level?.toFixed(2)} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--clr-text-300)' }}>meters</span>
                    </strong>
                  </div>
                  <span
                    className="text-xs font-bold"
                    style={{ 
                      color: rateInfo.color, 
                      backgroundColor: rateInfo.bg,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: `1px solid ${rateInfo.bg}`
                    }}
                  >
                    {rateInfo.icon} {rateInfo.text}
                  </span>
                </div>

                {/* Level capacity progress bar */}
                <div style={{ marginTop: 'var(--sp-1)' }}>
                  <div className="flex justify-between" style={{ fontSize: '0.68rem', color: 'var(--clr-text-300)', marginBottom: '4px' }}>
                    <span>Gauge Capacity Indicator</span>
                    <span>{levelPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar-outer" style={{ height: '5px' }}>
                    <div
                      className={`progress-bar-inner risk-${statusClass}`}
                      style={{ width: `${levelPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-xs text-muted" style={{ fontSize: '0.68rem', textAlign: 'right', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Station Code: ST-0{station.id}</span>
                  <span>Updated: {new Date(station.last_updated).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
