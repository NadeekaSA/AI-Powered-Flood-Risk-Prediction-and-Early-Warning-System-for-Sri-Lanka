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
  if (!rate) return { text: 'Static', icon: '➖', color: 'var(--clr-text-300)' };
  if (rate > 0) return { text: `Rising (+${rate.toFixed(2)} m/h)`, icon: '📈', color: 'var(--risk-critical)' };
  if (rate < 0) return { text: `Falling (${rate.toFixed(2)} m/h)`, icon: '📉', color: 'var(--risk-low)' };
  return { text: 'Static', icon: '➖', color: 'var(--clr-text-300)' };
};

export default function RiverPanel({ stations, loading, onStationClick, onRefresh, refreshing }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="section-header" style={{ marginBottom: 'var(--sp-3)' }}>
        <div className="section-title">
          🌊 River Water Levels
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={loading || refreshing}
        >
          {refreshing ? '🔄 Scraping...' : '🔄 Sync DMC'}
        </button>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : stations.length === 0 ? (
        <p className="text-sm text-muted text-center" style={{ padding: 'var(--sp-4)' }}>
          No gauging station data available.
        </p>
      ) : (
        <div className="panel-scroll flex-col flex gap-3" style={{ flex: 1, paddingRight: '2px' }}>
          {stations.map((station) => {
            const statusClass = getStatusClass(station.alert_status);
            const rateInfo = getRateIndicator(station.rate_of_rise);
            
            return (
              <div
                key={station.id}
                className="glass-card"
                style={{
                  padding: 'var(--sp-4)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-2)',
                  transition: 'transform var(--transition-fast)'
                }}
                onClick={() => onStationClick(station)}
              >
                <div className="flex justify-between items-start w-full">
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: 'var(--clr-text-100)' }}>
                      {station.station_name}
                    </h4>
                    <p className="text-xs text-muted">
                      {station.river_name} Basin
                    </p>
                  </div>
                  <span className={`risk-badge risk-badge-${statusClass}`}>
                    {station.alert_status || 'Normal'}
                  </span>
                </div>

                <div className="flex justify-between items-center w-full" style={{ marginTop: 'var(--sp-2)' }}>
                  <div>
                    <span className="text-xs text-muted">Water Level: </span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--clr-primary)' }}>
                      {station.current_level?.toFixed(2)}m
                    </strong>
                  </div>
                  <span
                    className="text-xs font-bold"
                    style={{ color: rateInfo.color, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {rateInfo.icon} {rateInfo.text}
                  </span>
                </div>

                <div className="text-xs text-muted" style={{ fontSize: '0.7rem', textAlign: 'right', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-1)' }}>
                  Updated: {new Date(station.last_updated).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
