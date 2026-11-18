// One build serves two sites: fitznet.org and lori.fitznet.org ("Lori-Net"). The variant is
// picked at runtime from the hostname, so the same image and nginx config serve both.
import fnLogo from './img/FN_Logo_Straight.png';
import fnAnimation from './img/FN_Logo_Animation_nonloop.gif';
import lnLogo from './img/LN_Logo_Straight.png';
import lnAnimation from './img/LN_Logo_Animation_nonloop.gif';

export const SITES = {
  fitznet: {
    id: 'fitznet',
    name: 'Fitz-Net',
    logo: fnLogo,
    animation: fnAnimation,
    footer: 'fitznet.org by Matthew Fitzgerald',
    themeColor: { light: '#ffffff', dark: '#1a1a1a' },
    // null: the site is public; individual pages still check their own permissions.
    requiredPermission: null,
  },
  lori: {
    id: 'lori',
    name: 'Lori-Net',
    logo: lnLogo,
    animation: lnAnimation,
    footer: 'lori.fitznet.org',
    themeColor: { light: '#fff5fa', dark: '#1f1018' },
    requiredPermission: 'LORINET_ACCESS',
  },
};

/**
 * Which site this page is. `lori.` hosts are Lori-Net; in development `?site=lori` (remembered
 * for the tab) or VITE_SITE=lori previews it on localhost.
 */
export function detectSiteId(location = window.location, env = import.meta.env) {
  const host = (location?.hostname || '').toLowerCase();
  if (host === 'lori.fitznet.org' || host.startsWith('lori.')) return 'lori';

  if (env?.DEV || env?.MODE === 'test') {
    const param = new URLSearchParams(location?.search || '').get('site');
    try {
      if (param) sessionStorage.setItem('site', param);
      const remembered = param || sessionStorage.getItem('site');
      if (remembered === 'lori') return 'lori';
      if (remembered) return 'fitznet';
    } catch {
      if (param === 'lori') return 'lori';
    }
  }
  if (env?.VITE_SITE === 'lori') return 'lori';
  return 'fitznet';
}

export function getSite() {
  return SITES[detectSiteId()];
}

/** Brand the document itself: data-site for the CSS tokens, plus title and icons for Lori-Net. */
export function applySiteToDocument(site = getSite(), doc = document) {
  doc.documentElement.setAttribute('data-site', site.id);
  if (site.id === 'fitznet') return;

  doc.title = site.name;
  const setHref = (selector, href) => doc.querySelector(selector)?.setAttribute('href', href);
  setHref('link[rel="icon"]', '/lori/favicon.ico');
  setHref('link[rel="apple-touch-icon"]', '/lori/logo192.png');
  setHref('link[rel="manifest"]', '/lori/manifest.json');
  setHref('link[rel="canonical"]', 'https://lori.fitznet.org/');
}
