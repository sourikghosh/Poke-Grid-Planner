// The one runtime source of truth for the Wayfarer website.
(function (global) {
  'use strict';

  const host = 'wayfarer.scopely.com';
  const origin = `https://${host}`;
  const mapPath = '/mapview';
  const mapDataPath = '/api/v1/vault/mapview/gcs';

  function parseUrl(value) {
    try {
      return new URL(value);
    } catch (_) {
      return null;
    }
  }

  const WAYFARER_CONFIG = Object.freeze({
    host,
    origin,
    mapPath,
    mapDataPath,
    matchPattern: `*://${host}/*`,
    isWayfarerUrl(url) {
      const parsed = parseUrl(url);
      return !!parsed && parsed.protocol === 'https:' && parsed.hostname === host;
    },
    isWayfarerMapUrl(url) {
      const parsed = parseUrl(url);
      return !!parsed && parsed.protocol === 'https:' && parsed.hostname === host && parsed.pathname === mapPath;
    },
    getMapUrl() {
      return `${origin}${mapPath}`;
    }
  });

  global.S2Wayfarer = WAYFARER_CONFIG;
})(globalThis);
