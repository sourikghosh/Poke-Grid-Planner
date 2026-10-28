// Runs in the PAGE world (injected via manifest world: MAIN)
// Retrieves the Wayfarer map through its React ref and relays map data to the content script via CustomEvents
(function() {
  if (window.__s2BridgeInstalled) return;
  window.__s2BridgeInstalled = true;

function getMap() {
  const host = document.querySelector(
    '[data-testid="base-map-root"]'
  );

  if (!host) return null;

  const fiberKey = Object.keys(host).find(
    key => key.startsWith('__reactFiber$')
  );

  if (!fiberKey) return null;

  let fiber = host[fiberKey];

  while (fiber) {
    const mapRef = fiber.ref;

    if (mapRef?.current && typeof mapRef.current.getMap === 'function') {
      try {
        const map = mapRef.current.getMap();

        if (
          map &&
          typeof map.getBounds === 'function' &&
          typeof map.getZoom === 'function'
        ) {
          return map;
        }
      } catch (_) {
        
      }
    }

    fiber = fiber.return;
  }

  return null;
}


  function serializeBounds(map) {
    const b = map.getBounds();
    if (!b) return null;
    const sw = b.getSouthWest(), ne = b.getNorthEast();
    return { swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng(), zoom: map.getZoom() };
  }

  let dataTimer = null;
  function requestMapData(bounds) {
    if (!bounds) return;
    const query = `ne=(${bounds.neLat},${bounds.neLng})&sw=(${bounds.swLat},${bounds.swLng})&cellLevel=14`;
    fetch(`${S2Wayfarer.mapDataPath}?${query}`, { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => { if (payload) dispatch({ type: 'map-data', data: payload }); })
      .catch(() => dispatch({ type: 'map-data-error' }));
  }

  function scheduleMapData(map) {
    clearTimeout(dataTimer);
    dataTimer = setTimeout(() => requestMapData(serializeBounds(map)), 200);
  }

  function dispatch(detail) {
    window.dispatchEvent(new CustomEvent('s2:response', { detail }));
  }

  window.addEventListener('s2:request', function() {
    const map = getMap();
    if (!map) { dispatch({ type: 'nomap' }); return; }
    const bounds = serializeBounds(map);
    dispatch({ type: 'bounds', bounds });
  });

  // The isolated-world analyzer can request the exact selected L14 bounds.
  window.addEventListener('s2:data-request', function(event) {
    requestMapData(event.detail);
  });

  let attached = false;
  function attachListeners(map) {
    if (attached) return;
    attached = true;
    ['bounds_changed', 'zoom_changed', 'idle'].forEach(evt => {
      map.addListener(evt, function() {
        const bounds = serializeBounds(map);
        if (bounds) {
          dispatch({ type: 'bounds', bounds });
          if (evt === 'idle') scheduleMapData(map);
        }
      });
    });

    // Relay map clicks (used by the "future nomination" pin picker)
    map.addListener('click', function(e) {
      if (!e || !e.latLng) return;
      dispatch({ type: 'click', lat: e.latLng.lat(), lng: e.latLng.lng() });
    });

    // Pan/zoom to a saved nomination
    window.addEventListener('s2:panto', function(ev) {
      const d = ev.detail || {};
      if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
      map.panTo({ lat: d.lat, lng: d.lng });
      if (typeof d.zoom === 'number') map.setZoom(d.zoom);
    });
  }

  function waitAndAttach(attempts) {
    if (attempts > 120) return;
    const map = getMap();
    if (map) {
      attachListeners(map);
      const bounds = serializeBounds(map);
      dispatch({ type: 'bounds', bounds });
      requestMapData(bounds);
      return;
    }
    setTimeout(() => waitAndAttach(attempts + 1), 250);
  }
  waitAndAttach(0);
})();
