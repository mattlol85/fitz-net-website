import React, {useEffect, useState} from 'react';
import '../css/StatusDashboard.css';
import {API_CONFIGS} from '../constants';
import {getActuatorHealth, getActuatorInfo} from '../services/actuatorService';
import AiNodesGraph from './AiNodesGraph';
import ArchitectureGraph from './ArchitectureGraph';
import EnrollmentTokenPanel from './EnrollmentTokenPanel';

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
      <h1>API Status Dashboard</h1>

      {error && (
        <div className="error-banner">
          <p>Error loading statuses: {error}</p>
        </div>
      )}

      <ArchitectureGraph apiStatuses={apiStatuses} />

      <EnrollmentTokenPanel />

      <div id="ai-worker-nodes">
        <AiNodesGraph />
      </div>
    </div>
  );
}

