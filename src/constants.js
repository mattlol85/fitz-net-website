/**
 * Application Constants
 * Centralized location for configuration values
 */

// API URLs
export const API_URLS = {
  FITZ_NET_API: import.meta.env.VITE_API_BASE_URL || '/api',
  GAMERBELL: import.meta.env.VITE_GAMERBELL_URL || 'https://gamerbell.fitznet.doomdns.org',
};

// API Configurations for Status Dashboard
export const API_CONFIGS = [
  { name: 'fitz-net-website', url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000', local: true },
  { name: 'fitz-net-api', url: 'https://api.fitznet.doomdns.org' },
  { name: 'gamerbell', url: 'https://gamerbell.fitznet.doomdns.org' },
];

export default API_URLS;
