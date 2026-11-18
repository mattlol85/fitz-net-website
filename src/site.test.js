import { afterEach, describe, expect, it } from 'vitest';
import { SITES, applySiteToDocument, detectSiteId } from './site';

const loc = (hostname, search = '') => ({ hostname, search });
const PROD = { DEV: false, MODE: 'production' };
const DEV = { DEV: true, MODE: 'development' };

describe('detectSiteId', () => {
  afterEach(() => sessionStorage.clear());

  it('should pick Lori-Net on lori.fitznet.org', () => {
    expect(detectSiteId(loc('lori.fitznet.org'), PROD)).toBe('lori');
    expect(detectSiteId(loc('LORI.fitznet.org'), PROD)).toBe('lori');
  });

  it('should pick Fitz-Net on the main hosts', () => {
    expect(detectSiteId(loc('fitznet.org'), PROD)).toBe('fitznet');
    expect(detectSiteId(loc('www.fitznet.org'), PROD)).toBe('fitznet');
    expect(detectSiteId(loc('fitznet.doomdns.org'), PROD)).toBe('fitznet');
  });

  it('should ignore ?site= in production builds', () => {
    expect(detectSiteId(loc('fitznet.org', '?site=lori'), PROD)).toBe('fitznet');
  });

  it('should preview Lori-Net with ?site=lori in development and remember it for the tab', () => {
    expect(detectSiteId(loc('localhost', '?site=lori'), DEV)).toBe('lori');
    expect(detectSiteId(loc('localhost'), DEV)).toBe('lori');
    expect(detectSiteId(loc('localhost', '?site=fitznet'), DEV)).toBe('fitznet');
    expect(detectSiteId(loc('localhost'), DEV)).toBe('fitznet');
  });

  it('should honour VITE_SITE=lori', () => {
    expect(detectSiteId(loc('localhost'), { ...PROD, VITE_SITE: 'lori' })).toBe('lori');
  });
});

describe('applySiteToDocument', () => {
  it('should brand the document for Lori-Net', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico"><link rel="manifest" href="/manifest.json">';
    applySiteToDocument(SITES.lori, document);

    expect(document.documentElement.getAttribute('data-site')).toBe('lori');
    expect(document.title).toBe('Lori-Net');
    expect(document.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/lori/favicon.ico');
    expect(document.querySelector('link[rel="manifest"]').getAttribute('href')).toBe('/lori/manifest.json');
  });

  it('should only set data-site for Fitz-Net', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico">';
    document.title = 'Fitz-Net';
    applySiteToDocument(SITES.fitznet, document);

    expect(document.documentElement.getAttribute('data-site')).toBe('fitznet');
    expect(document.title).toBe('Fitz-Net');
    expect(document.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/favicon.ico');
  });

  it('should require LORINET_ACCESS only on Lori-Net', () => {
    expect(SITES.lori.requiredPermission).toBe('LORINET_ACCESS');
    expect(SITES.fitznet.requiredPermission).toBeNull();
  });
});
