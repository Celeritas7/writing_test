/* Learning Hub · iPad offline storage. No credentials or service-role keys are stored here. */
(function () {
  'use strict';
  const DB_NAME = 'wt-ipad-offline-v1';
  const DB_VERSION = 1;
  const CACHE_NAME = 'lh-ipad-v1';
  const ASSETS = [
    './', 'index.html', 'manifest.webmanifest', 'css/learning_hub.css',
    'js/offline_store.js', 'js/learning_hub.js', 'js/ghost_test.js',
    'js/japanese_source.js', 'fonts/NotoSansJP-Regular.ttf',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'
  ];
  let connection;
  function open() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is not available'));
    if (!connection) connection = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ['meta', 'packs', 'japanese', 'pending'])
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, {keyPath: 'id'});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(e => { connection = null; throw e; });
    return connection;
  }
  async function operation(store, method, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, method === 'get' || method === 'getAll' ? 'readonly' : 'readwrite');
      const req = method === 'getAll' ? tx.objectStore(store).getAll() : tx.objectStore(store)[method](value);
      tx.oncomplete = () => resolve(req.result);
      tx.onabort = () => reject(tx.error || req.error || new Error('Offline storage failed'));
      tx.onerror = () => reject(tx.error || req.error || new Error('Offline storage failed'));
    });
  }
  const account = () => operation('meta', 'get', 'last-verified-user');
  async function pack(owner) { return operation('packs', 'get', owner); }
  async function japanese(owner) { return operation('japanese', 'get', owner); }
  async function savePack(p) {
    if (!p || !p.id || !p.verified || !p.problems) throw new Error('Cannot store an unverified pack');
    await operation('packs', 'put', p);
    await operation('meta', 'put', {id:'last-verified-user', userId:p.id, email:p.email, role:p.role, savedAt:p.savedAt});
  }
  async function saveJapanese(owner, sheet) {
    if (!owner || !sheet || !Array.isArray(sheet.items) || !sheet.items.length) throw new Error('No Japanese sheet to download');
    const entry = {id:owner, savedAt:new Date().toISOString(), label:sheet.label, items:sheet.items, src:'jp'};
    await operation('japanese', 'put', entry);
    return entry;
  }
  async function pending(owner) {
    return (await operation('pending','getAll')).filter(x => x.owner === owner).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  }
  async function queue(entry) {
    if (!entry || !entry.id || !entry.owner || !['hub','jp'].includes(entry.kind)) throw new Error('Invalid pending result');
    await operation('pending','put',entry);
    return entry;
  }
  async function remove(id) { return operation('pending','delete',id); }
  async function assetsReady() {
    if (!('caches' in window)) return false;
    const c = await caches.open(CACHE_NAME);
    for (const u of ASSETS) if (!await c.match(new URL(u, location.href).href)) return false;
    return true;
  }
  async function cacheAssets(progress) {
    if (!navigator.onLine) throw new Error('Connect to the internet before downloading app files');
    if (!('caches' in window) || !('serviceWorker' in navigator)) throw new Error('Offline app files are unsupported in this browser');
    const c = await caches.open(CACHE_NAME);
    let total = 0;
    for (const [i, u] of ASSETS.entries()) {
      const url = new URL(u, location.href).href;
      const response = await fetch(url, {cache:'reload'});
      if (!response.ok) throw new Error('Could not download '+u+' (HTTP '+response.status+')');
      const body = await response.clone().arrayBuffer();
      total += body.byteLength;
      await c.put(url, response);
      if (progress) progress(i+1, ASSETS.length, total);
    }
    return total;
  }
  window.WTOffline = {account, pack, japanese, savePack, saveJapanese, pending, queue, remove, assetsReady, cacheAssets};
})();
