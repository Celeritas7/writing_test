/* Learning Hub · Phase 6 — offline packs on the same installed app origin.
   Reconciles the earlier offline draft; reuses its IndexedDB stores without
   deleting downloaded files, language packs, handwriting or Quick drafts.
   Offline storage is NOT encrypted and is NOT an authorization boundary. */
(function(){
  'use strict';
  const DB='wt-ipad-offline-v1',VERSION=1,PACK_VERSION=6;
  const CACHE='wt-ipad-assets-phase6';
  const AUTH_KEY='sb-wylxvmkcrexwfpjpbhyy-auth-token';
  const FILES=[
    './','index.html','manifest.webmanifest','css/learning_hub.css',
    'js/worksheet_handoff.js','js/learning_analytics.js','js/learning_hub.js',
    'js/analytics_view.js','js/quick_practice.js','js/multilingual_core.js',
    'js/ghost_test.js','js/japanese_source.js','js/multilingual_packs.js',
    'js/offline_store.js','icons/icon-192.png','icons/favicon-32.png',
    'icons/apple-touch-icon.png','fonts/NotoSansJP-Regular.ttf',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'
  ];
  let connection=null,downloading=false,offlineActive=false;
  const types=['meta','packs','japanese','pending'];
  function database(){
    if(!('indexedDB' in window))return Promise.reject(Error('IndexedDB is unavailable'));
    if(!connection)connection=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        for(const name of types)if(!db.objectStoreNames.contains(name))
          db.createObjectStore(name,{keyPath:'id'});
      };
      req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
      req.onerror=()=>reject(req.error);
      req.onblocked=()=>reject(Error('Offline storage is blocked in another tab'));
    }).catch(e=>{connection=null;throw e;});
    return connection;
  }
  async function op(store,method,value){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite');
      const req=method==='getAll'?tx.objectStore(store).getAll():tx.objectStore(store)[method](value);
      tx.oncomplete=()=>resolve(req.result);
      tx.onerror=()=>reject(tx.error||req.error||Error('Storage operation failed'));
      tx.onabort=()=>reject(tx.error||req.error||Error('Storage operation aborted'));
    });
  }
  function storedUser(){
    try{
      const raw=localStorage.getItem(AUTH_KEY);
      if(!raw)return null;
      const session=JSON.parse(raw);
      return session&&session.user&&typeof session.user.id==='string'?{
        id:session.user.id,email:session.user.email||''
      }:null;
    }catch(e){return null;}
  }
  const verifiedUser=()=>op('meta','get','last-verified-user');
  const pack=id=>op('packs','get',id);
  const japanese=id=>op('japanese','get',id);
  async function offlineOwner(){
    const proof=await verifiedUser(),local=storedUser();
    if(!proof||!proof.offlineAllowed||!proof.userId)return null;
    // A different signed-in user must never inherit the previous owner's pack.
    if(local&&local.id!==proof.userId)return null;
    return proof.userId;
  }
  async function enrolled(owner){
    const available=await offlineOwner(),p=owner&&await pack(owner);
    return !!(available===owner&&p&&p.id===owner&&p.version===PACK_VERSION&&
      p.verified&&Array.isArray(p.problems)&&Array.isArray(p.topics)&&
      Array.isArray(p.subjects)&&Array.isArray(p.attempts));
  }
  async function lockOffline(){
    const proof=await verifiedUser();
    if(proof)await op('meta','put',{...proof,offlineAllowed:false});
  }
  async function savePack(p){
    if(!p||!p.id||p.version!==PACK_VERSION||!p.verified||
       !Array.isArray(p.problems)||!Array.isArray(p.subjects)||
       !Array.isArray(p.topics)||!Array.isArray(p.attempts))
      throw Error('Only a complete online-verified study snapshot may be saved');
    const user=storedUser();
    if(!user||user.id!==p.id)throw Error('Signed-in local identity does not match the downloaded pack');
    // Write the owner pointer AFTER the complete pack. Partial downloads
    // never change which previously verified pack can be opened.
    await op('packs','put',p);
    await op('meta','put',{id:'last-verified-user',userId:p.id,
      email:p.email||user.email,role:p.role,savedAt:p.savedAt,
      offlineAllowed:true});
  }
  async function saveJapanese(owner,sheet){
    if(!owner||!sheet||!sheet.items||!Array.isArray(sheet.items)||!sheet.items.length)
      throw Error('No Japanese sheet to download');
    if(!storedUser()||storedUser().id!==owner)
      throw Error('This Japanese download belongs to a different signed-in account');
    const entry={id:owner,label:String(sheet.label||'Japanese writing'),
      items:sheet.items,savedAt:new Date().toISOString()};
    await op('japanese','put',entry);
    return entry;
  }
  async function pending(owner){
    if(!owner)return[];
    const jobs=await op('pending','getAll');
    return jobs.filter(j=>j.owner===owner)
      .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  }
  async function queue(entry){
    if(!entry||!entry.id||!entry.owner||!['hub','quick','japanese'].includes(entry.kind))
      throw Error('Invalid offline study result');
    if(!Array.isArray(entry.rows)&&!Array.isArray(entry.items))
      throw Error('Offline result requires reviewed rows or marks');
    const all=await pending(entry.owner);
    if(!all.some(j=>j.id===entry.id)&&all.length>=500)
      throw Error('500 pending sessions. Export a private backup before continuing; nothing was deleted.');
    await op('pending','put',entry);
    return entry;
  }
  async function queuedAttempts(owner){
    const jobs=await pending(owner);
    const ids=new Set(),out=[];
    for(const job of jobs){
      if(job.kind!=='hub'&&job.kind!=='quick')continue;
      for(const row of job.rows||[])if(row&&row.id&&!ids.has(row.id)){
        ids.add(row.id);out.push({...row,pending_local:true});
      }
    }
    return out;
  }
  async function assetsReady(){
    if(!('caches' in window))return false;
    const cache=await caches.open(CACHE);
    for(const path of FILES){
      const res=await cache.match(new URL(path,location.href).href);
      if(!res||!res.ok)return false;
    }
    return true;
  }
  async function cacheAssets(progress){
    if(downloading)throw Error('Another download is already running');
    if(!('caches' in window)||!('serviceWorker' in navigator))
      throw Error('This browser cannot store offline app files');
    if(!navigator.serviceWorker.controller)
      throw Error('Service worker is not controlling this app yet. Reopen it while online, then retry.');
    downloading=true;
    let done=0,bytes=0;
    try{
      const c=await caches.open(CACHE);
      for(const path of FILES){
        const url=new URL(path,location.href).href;
        let res=await c.match(url);
        if(!res||!res.ok){
          res=await fetch(url,{cache:'reload'});
          if(!res.ok||res.type==='opaque')throw Error('Could not download '+path+' (HTTP '+res.status+')');
          const ct=res.headers.get('content-type')||'';
          if((/\.js(?:\?|$)/.test(path)||/\.css(?:\?|$)/.test(path))&&/text\/html/i.test(ct))
            throw Error('App server returned HTML for '+path+'; offline pack incomplete');
          await c.put(url,res.clone());
        }
        bytes+=(await res.clone().blob()).size;
        done++;
        if(progress)progress({done,total:FILES.length,remaining:FILES.length-done,bytes,file:path});
      }
      if(!await assetsReady())throw Error('A required app asset is missing after download');
      return {files:done,bytes};
    }finally{downloading=false;}
  }
  function activate(){offlineActive=true;}
  function deactivate(){offlineActive=false;}
  function shouldQueue(){return offlineActive||navigator.onLine===false;}
  const downloadFiles=()=>FILES.slice();
  window.WTOffline={
    storedUser,verifiedUser,offlineOwner,enrolled,lockOffline,
    pack,japanese,savePack,saveJapanese,
    pending,queue,queuedAttempts,cacheAssets,assetsReady,downloadFiles,
    activate,deactivate,shouldQueue,isActive:()=>offlineActive,
    version:PACK_VERSION,cacheName:CACHE
  };
})();
