/**
 * Application Constants
 * Centralized location for configuration values
 */

// API URLs
export const API_URLS = {
  FITZ_NET_API: import.meta.env.VITE_API_BASE_URL || '/api',
  GAMERBELL: import.meta.env.VITE_GAMERBELL_URL || 'https://gamerbell.fitznet.org',
};

// Marine Park's Unity web build. Served from the site itself by default (drop the release zip's
// contents into public/marine-park/ locally); point it elsewhere with VITE_MARINE_PARK_URL.
export const MARINE_PARK_URL = import.meta.env.VITE_MARINE_PARK_URL || '/marine-park/index.html';

export const DEFAULT_BOARD_COLOR = 'hsl(200,72%,50%)';

// API Configurations for Status Dashboard
export const API_CONFIGS = [
  { name: 'fitz-net-website', url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000', local: true },
  { name: 'fitz-net-api', url: 'https://api.fitznet.org' },
  { name: 'gamerbell', url: 'https://gamerbell.fitznet.org' },
];

export default API_URLS;
