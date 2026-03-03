/**
 * Actuator Service
 * Simple in-app actuator that exposes project version and health status
 */

import packageJson from '../../package.json';

/**
 * Get actuator info with project version
 */
export const getActuatorInfo = async () => ({
  app: {
    name: 'fitz-net-website',
    description: 'Fitz-Net Frontend Application',
  },
  build: {
    artifact: 'fitz-net-website',
    name: 'fitz-net-website',
    time: new Date().toISOString(),
    version: packageJson.version,
    group: 'org.fitznet',
  },
  java: {
    version: 'N/A (frontend)',
  },
  os: {
    name: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
    version: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    arch: typeof navigator !== 'undefined' ? 'browser' : 'Unknown',
  },
});

/**
 * Get actuator health status
 */
export const getActuatorHealth = async () => ({
  status: 'UP',
  components: {
    frontend: {
      status: 'UP',
      details: {
        message: 'Frontend application is running',
      },
    },
  },
});

export default {
  getActuatorInfo,
  getActuatorHealth,
};

