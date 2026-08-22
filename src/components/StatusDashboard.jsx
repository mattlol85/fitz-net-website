import React, {useEffect, useState} from 'react';
import '../css/StatusDashboard.css';
import {API_CONFIGS} from '../constants';
import {getActuatorHealth, getActuatorInfo} from '../services/actuatorService';
import AiNodesGraph from './AiNodesGraph';

export default function StatusDashboard() {
  const [apiStatuses, setApiStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchApiStatus = async () => {
      try {
        // List of APIs to check
        const statuses = await Promise.all(
          API_CONFIGS.map(async (api) => {
            try {
              let info;
              let health;

              // Handle local frontend app with simple actuator
              if (api.local) {
                info = await getActuatorInfo();
                health = await getActuatorHealth();
              } else {
                // Use proxy paths for development, full URLs for production
                const proxyPath = api.name === 'fitz-net-api' ? '/actuator-fitz' : '/actuator-gamerbell';
                const infoUrl = import.meta.env.PROD ? `${api.url}/actuator/info` : `${proxyPath}/info`;
                const healthUrl = import.meta.env.PROD ? `${api.url}/actuator/health` : `${proxyPath}/health`;

                // Fetch info
                const infoResponse = await fetch(infoUrl, {
                  headers: { 'Accept': 'application/json' },
                });
                info = infoResponse.ok ? await infoResponse.json() : null;

                // Fetch health
                const healthResponse = await fetch(healthUrl, {
                  headers: { 'Accept': 'application/json' },
                });
                health = healthResponse.ok ? await healthResponse.json() : null;
              }

              return {
                name: api.name,
                url: api.url,
                online: true,
                info: info,
                health: health,
                error: null,
              };
            } catch (err) {
              return {
                name: api.name,
                url: api.url,
                online: false,
                info: null,
                health: null,
                error: err.message,
              };
            }
          })
        );

        setApiStatuses(statuses);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApiStatus();
    // Refresh every 30 seconds
    const interval = setInterval(fetchApiStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (status) => {
    if (!status) return '#999';
    switch (status.toLowerCase()) {
      case 'up':
        return '#10b981'; // green
      case 'down':
        return '#ef4444'; // red
      default:
        return '#f59e0b'; // amber
    }
  };

  const getHealthIcon = (status) => {
    if (!status) return '⚠️';
    switch (status.toLowerCase()) {
      case 'up':
        return '✅';
      case 'down':
        return '❌';
      default:
        return '⚠️';
    }
  };

  if (loading) {
    return (
      <div className="status-dashboard">
        <h1>API Status Dashboard</h1>
        <div className="loading">Loading API statuses...</div>
      </div>
    );
  }

  return (
    <div className="status-dashboard">
      <h1>🚀 API Status Dashboard</h1>

      {error && (
        <div className="error-banner">
          <p>Error loading statuses: {error}</p>
        </div>
      )}

      <div className="status-grid">
        {apiStatuses.map((api) => (
          <div
            key={api.name}
            className={`status-card ${api.online ? 'online' : 'offline'}`}
          >
            <div className="card-header">
              <h2>{api.name}</h2>
              <div
                className="status-indicator"
                style={{ backgroundColor: getHealthColor(api.health?.status) }}
                title={api.health?.status || 'Unknown'}
              >
                {getHealthIcon(api.health?.status)}
              </div>
            </div>

            {api.online ? (
              <>
                {/* Health Status */}
                <div className="status-section">
                  <h3>Health Status</h3>
                  {api.health ? (
                    <div className="info-grid">
                      <div className="info-row">
                        <span className="label">Status:</span>
                        <span
                          className="value status-badge"
                          style={{ color: getHealthColor(api.health.status) }}
                        >
                          {api.health.status?.toUpperCase()}
                        </span>
                      </div>
                      {api.health.components?.mongo && (
                        <div className="info-row">
                          <span className="label">MongoDB:</span>
                          <span
                            className="value status-badge"
                            style={{
                              color: getHealthColor(api.health.components.mongo.status),
                            }}
                          >
                            {api.health.components.mongo.status?.toUpperCase()}
                          </span>
                        </div>
                      )}
                      {api.health.components?.mongoHealth && (
                        <div className="info-row">
                          <span className="label">Mongo Health:</span>
                          <span
                            className="value status-badge"
                            style={{
                              color: getHealthColor(api.health.components.mongoHealth.status),
                            }}
                          >
                            {api.health.components.mongoHealth.status?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="unavailable">Health info unavailable</p>
                  )}
                </div>

                {/* Build Information */}
                {api.info?.build && (
                  <div className="status-section">
                    <h3>Build Information</h3>
                    <div className="info-grid">
                      <div className="info-row">
                        <span className="label">Application:</span>
                        <span className="value">{api.info.build.name}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Version:</span>
                        <span className="value">{api.info.build.version}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Artifact:</span>
                        <span className="value">{api.info.build.artifact}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Built:</span>
                        <span className="value">
                          {new Date(api.info.build.time).toLocaleString()}
                        </span>
                      </div>
                      {api.info.build.group && (
                        <div className="info-row">
                          <span className="label">Group:</span>
                          <span className="value">{api.info.build.group}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Java Information */}
                {api.info?.java && (
                  <div className="status-section">
                    <h3>Java Environment</h3>
                    <div className="info-grid">
                      <div className="info-row">
                        <span className="label">Java Version:</span>
                        <span className="value">{api.info.java.version}</span>
                      </div>
                      {api.info.java.vendor && (
                        <div className="info-row">
                          <span className="label">Vendor:</span>
                          <span className="value">
                            {api.info.java.vendor.name}
                            {api.info.java.vendor.version && ` (${api.info.java.vendor.version})`}
                          </span>
                        </div>
                      )}
                      {api.info.java.jvm && (
                        <div className="info-row">
                          <span className="label">JVM:</span>
                          <span className="value">{api.info.java.jvm.name}</span>
                        </div>
                      )}
                      {api.info.java.runtime && (
                        <div className="info-row">
                          <span className="label">Runtime:</span>
                          <span className="value">{api.info.java.runtime.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Operating System Information */}
                {api.info?.os && (
                  <div className="status-section">
                    <h3>Operating System</h3>
                    <div className="info-grid">
                      <div className="info-row">
                        <span className="label">OS:</span>
                        <span className="value">{api.info.os.name}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Version:</span>
                        <span className="value">{api.info.os.version}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Architecture:</span>
                        <span className="value">{api.info.os.arch}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="offline-message">
                <p>❌ API is currently offline or unreachable</p>
                <p className="error-detail">{api.error}</p>
              </div>
            )}

            <div className="card-footer">
              {api.local ? (
                <span style={{ color: '#666', fontSize: '0.9em' }}>Embedded actuator</span>
              ) : (
                <a href={`${api.url}/actuator/info`} target="_blank" rel="noopener noreferrer">
                  View Full Actuator →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <AiNodesGraph />
    </div>
  );
}

