/* Learning Hub · Phase 6 iPad offline shell.
 * Never cache Supabase API data, tokens or user-owned answers in the worker.
 * Keep older cache namespaces, IndexedDB and study drafts untouched.
 * A completed user-requested download uses a versioned cache namespace. */
const VERSION='lh-v2-phase8';
const OFFLINE_CACHE='wt-ipad-assets-phase8';
const SHELL=[
  './','index.html','manifest.webmanifest','css/learning_hub.css',
  'js/multilingual_core.js','js/multilingual_packs.js',
  'js/worksheet_handoff.js','js/learning_analytics.js','js/offline_store.js','js/offline_sync.js','js/release_readiness.js',
  'js/learning_hub.js','js/analytics_view.js','js/quick_practice.js',
  'js/ghost_test.js','js/japanese_source.js',
  'icons/icon-192.png','icons/favicon-32.png','icons/apple-touch-icon.png'
];
const PINNED=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'fonts/NotoSansJP-Regular.ttf'
];
const networkTimeout=4500;
const indexUrl=new URL('index.html',self.registration.scope).href;
const localAssetUrls=new Set([...SHELL,...PINNED.filter(p=>!/^https:/.test(p))]
  .map(p=>new URL(p,self.registration.scope).href));
const pinnedUrls=new Set(PINNED.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION)
    .then(c=>c.addAll(SHELL)
      .then(()=>Promise.allSettled(PINNED.map(u=>c.add(u)))))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  // Previous versions deleted every other cache, including manual downloads.
  // Never remove old study packs or cache namespaces during an app update.
  event.waitUntil(self.clients.claim());
});
async function fromCache(req){
  const current=await caches.open(VERSION);
  const fresh=await current.match(req,{ignoreSearch:true});
  if(fresh)return fresh;
  const packs=await caches.open(OFFLINE_CACHE);
  return packs.match(req,{ignoreSearch:true});
}
async function navigation(req){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),networkTimeout);
  try{
    const res=await fetch(req,{signal:controller.signal});
    if(!res.ok)throw Error('Navigation unavailable');
    const c=await caches.open(VERSION);
    await c.put(indexUrl,res.clone());
    return res;
  }catch(e){
    const cached=await fromCache(req)||await fromCache(indexUrl);
    return cached||Response.error();
  }finally{clearTimeout(timeout);}
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(pinnedUrls.has(url.href)){
    event.respondWith((async()=>{
      const cached=await fromCache(req);
      if(cached)return cached;
      const res=await fetch(req);
      if(res.ok&&res.type!=='opaque'){
        const c=await caches.open(VERSION);
        await c.put(req,res.clone());
      }
      return res;
    })());
    return;
  }
  // External APIs, OAuth and all user/project data remain network-only.
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(navigation(req));
    return;
  }
  if(!localAssetUrls.has(url.href))return;
  event.respondWith((async()=>{
    const cached=await fromCache(req);
    if(cached)return cached;
    try{
      const res=await fetch(req);
      if(res.ok){
        const c=await caches.open(VERSION);
        await c.put(req,res.clone());
      }
      return res;
    }catch(e){return Response.error();}
  })());
});
