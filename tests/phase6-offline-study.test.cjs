'use strict';
/* Run: node --test tests/phase6-offline-study.test.cjs
 * Hermetic tests: no real Supabase calls, no storage deletion or real iPad. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const store=fs.readFileSync(path.join(root,'js/offline_store.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
const ghost=fs.readFileSync(path.join(root,'js/ghost_test.js'),'utf8');
const quick=fs.readFileSync(path.join(root,'js/quick_practice.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const analytics=fs.readFileSync(path.join(root,'js/analytics_view.js'),'utf8');
function section(src,start,end){
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Missing function '+start);
  return src.slice(a,b);
}
function isolated(src,name,deps){
  const keys=Object.keys(deps);
  return new Function(...keys,src+'\nreturn '+name+';')(...Object.values(deps));
}
function rig(){
  const maps=new Map(),records=new Map(),fetched=[],failOnce=new Set();
  let dbInitialized=false;
  const db={
    objectStoreNames:{contains:name=>records.has(name)},
    createObjectStore:name=>{records.set(name,new Map());},
    transaction(name){
      const tx={oncomplete:null,onabort:null,onerror:null};
      tx.objectStore=()=>({
        get(key){const req={result:records.get(name).get(key)};
          Promise.resolve().then(()=>tx.oncomplete&&tx.oncomplete());return req;},
        getAll(){const req={result:[...records.get(name).values()]};
          Promise.resolve().then(()=>tx.oncomplete&&tx.oncomplete());return req;},
        put(value){const req={result:value.id};
          records.get(name).set(value.id,value);
          Promise.resolve().then(()=>tx.oncomplete&&tx.oncomplete());return req;},
        delete(key){const req={result:undefined};
          records.get(name).delete(key);
          Promise.resolve().then(()=>tx.oncomplete&&tx.oncomplete());return req;}
      });
      return tx;
    }
  };
  const idb={open:(_name,_v)=>{
    const r={result:db};
    Promise.resolve().then(()=>{
      if(!dbInitialized){dbInitialized=true;r.onupgradeneeded();}
      r.onsuccess();
    });
    return r;
  }};
  class FakeResponse{
    constructor(url){this.url=url;this.ok=true;this.status=200;this.type='basic';
      this.headers={get:()=>url.includes('.js')?'application/javascript':'text/plain'};}
    clone(){return new FakeResponse(this.url);}
    async blob(){return {size:120};}
  }
  const caches={open:async name=>{
    if(!maps.has(name))maps.set(name,new Map());
    const m=maps.get(name);
    return {match:async url=>m.get(url)||null,
      put:async(url,res)=>{m.set(url,res);}};
  }};
  class FakeURL{
    constructor(url,base){
      const raw=String(url),prefix=String(base||'https://example.test/app/index.html');
      this.href=raw.startsWith('https://')?raw:raw==='./'?
        'https://example.test/app/':'https://example.test/app/'+raw.replace(/^\.\//,'');
      if(!base)this.href=prefix;
    }
  }
  let session={user:{id:'alice',email:'a@example.test'}};
  const localStorage={getItem:k=>k==='sb-wylxvmkcrexwfpjpbhyy-auth-token'&&session?
    JSON.stringify(session):null};
  const navigator={onLine:true,serviceWorker:{controller:{}}};
  const env={
    window:{indexedDB:idb,caches},indexedDB:idb,navigator,localStorage,caches,
    location:{href:'https://example.test/app/index.html'},URL:FakeURL,
    fetch:async(url)=>{
      fetched.push(url);
      if(failOnce.has(url)){failOnce.delete(url);throw Error('Network failure');}
      return new FakeResponse(url);
    }
  };
  vm.runInNewContext(store,env);
  return {
    WT:env.window.WTOffline,records,maps,fetched,failOnce,navigator,
    setSession:v=>{session=v;},cacheSize:()=>maps.get('wt-ipad-assets-phase6')?.size||0
  };
}
test('Phase 6 asset manifest covers all new study screens and dependencies',()=>{
  const r=rig(),files=r.WT.downloadFiles();
  for(const item of ['index.html','js/learning_hub.js','js/quick_practice.js',
    'js/multilingual_packs.js','js/multilingual_core.js','js/learning_analytics.js',
    'js/analytics_view.js','js/ghost_test.js','js/japanese_source.js',
    'js/offline_store.js','css/learning_hub.css']){
    assert.ok(files.includes(item),item+' not available offline');
  }
  assert.equal(new Set(files).size,files.length);
  assert.match(index,/js\/offline_store\.js/);
  assert.match(worker,/wt-ipad-assets-phase6/);
});
test('broken downloads resume missing assets and never activate a partial pack',async()=>{
  const r=rig(),p='https://example.test/app/';
  r.failOnce.add(p+'css/learning_hub.css');
  let failed=false;
  try{await r.WT.cacheAssets();}catch(e){failed=true;}
  assert.equal(failed,true);
  assert.equal(await r.WT.assetsReady(),false);
  const size=r.cacheSize();assert.ok(size>0);
  const before=r.fetched.length;
  const events=[];
  await r.WT.cacheAssets(x=>events.push(x));
  assert.equal(await r.WT.assetsReady(),true);
  assert.equal(events.length,r.WT.downloadFiles().length);
  assert.equal(events.at(-1).remaining,0);
  assert.ok(r.fetched.length-before<r.WT.downloadFiles().length);
});
test('only explicitly enrolled owner opens local study, even if session expired',async()=>{
  const r=rig(),WT=r.WT;
  const pack={version:6,id:'alice',email:'a@example.test',role:'student',
    verified:true,savedAt:new Date().toISOString(),
    subjects:[],topics:[],problems:[{id:'1'}],attempts:[],batches:[]};
  assert.equal(await WT.enrolled('alice'),false);
  await WT.savePack(pack);
  assert.equal(await WT.enrolled('alice'),true);
  r.setSession(null); // expired Supabase auth: the on-device opt-in survives
  assert.equal(await WT.offlineOwner(),'alice');
  assert.equal(await WT.enrolled('alice'),true);
  r.setSession({user:{id:'bob',email:'b@example.test'}});
  assert.equal(await WT.enrolled('alice'),false);
  r.setSession(null);
  await WT.lockOffline();
  assert.equal(await WT.enrolled('alice'),false);
  assert.ok(await WT.pack('alice')); // signout doesn't destroy the downloaded pack
});
test('full pack replacement fails closed for mismatched identity',async()=>{
  const r=rig();r.setSession({user:{id:'bob'}});
  await assert.rejects(r.WT.savePack({
    version:6,id:'alice',verified:true,subjects:[],topics:[],problems:[],attempts:[]
  }),/does not match/);
});
test('pending Hub and Quick sessions remain idempotent and owner-scoped',async()=>{
  const r=rig(),WT=r.WT;
  const job={id:'session-1',owner:'alice',kind:'quick',
    createdAt:'2026-11-24T00:00:00Z',rows:[{id:'stable',problem_id:'p1',correct:true}]};
  await WT.queue(job);await WT.queue(job);
  await WT.queue({id:'session-2',owner:'bob',kind:'japanese',createdAt:'2026-11-24T01:00:00Z',items:[{id:'jp1'}]});
  assert.equal((await WT.pending('alice')).length,1);
  assert.equal((await WT.pending('bob')).length,1);
  const attempts=await WT.queuedAttempts('alice');
  assert.equal(attempts[0].pending_local,true);
  assert.equal(attempts[0].id,'stable');
});
test('manual offline sign-out locks access without deleting data',()=>{
  assert.match(hub,/WTOffline\.lockOffline\(\)/);
  assert.match(hub,/WTOffline\.deactivate\(\)/);
  assert.match(hub,/Offline access locked/);
  assert.match(store,/offlineAllowed:false/);
  assert.doesNotMatch(worker,/caches\.delete\(/);
  assert.doesNotMatch(worker,/caches\.keys\(\).*delete/);
});
test('offline startup never fabricates a live allowlist verification',()=>{
  const area=section(hub,'async function offlineEntry(manual=false){','window.openOfflineStudy=');
  assert.match(area,/WTOffline\.enrolled\(owner\)/);
  assert.match(area,/WTOffline\.assetsReady\(\)/);
  assert.match(area,/WTOffline\.queuedAttempts\(owner\)/);
  assert.doesNotMatch(area,/sb\.from\(/);
  assert.match(hub,/setTimeout\(\(\)=>\{if\(!LOADED\)offlineEntry\(\);\},6500\)/);
});
test('offline handwriting and Quick Practice explicitly queue unsynced work',()=>{
  const queue=section(ghost,'async function ghQueueOfflineSession(rows){','async function ghSaveNow(){');
  assert.match(queue,/WTOffline\.queue\(record\)/);
  assert.match(queue,/strokes:GH\.strokes\.map/);
  assert.match(queue,/pending_local:true/);
  assert.doesNotMatch(queue,/sb\.from\(/);
  assert.match(quick,/window\.WTOffline\.shouldQueue\(\)/);
  assert.match(quick,/savedLocally=true/);
  assert.match(quick,/sync pending/);
  assert.match(hub,/Export pending results/);
});
test('offline view refuses live batch/export and analytics update operations',()=>{
  assert.match(hub,/if\(OFFLINE_MODE\)\{toast\('PDF batch tracking requires/);
  assert.match(hub,/if\(OFFLINE_MODE\)\{toast\('Changing batch status requires/);
  assert.match(analytics,/WTOffline\.isActive\(\)/);
});
test('optional third-party scripts cannot block cached app startup',()=>{
  assert.match(index,/script async src="https:\/\/celeritas7.github.io\/Akatsuki/);
  assert.match(index,/fonts.googleapis.com[^"\n]*" rel="stylesheet" media="print"/);
  assert.match(hub,/maybeStartBroadcaster/);
  assert.match(hub,/BROADCAST_STARTED/);
});
test('late live database replies cannot replace an opened offline workspace',()=>{
  assert.match(hub,/async function boot\(\)\{\s*if\(OFFLINE_MODE\)return/);
  assert.match(hub,/if\(OFFLINE_MODE\)return; \/\/ offline fallback may have started during the requests/);
});
test('all updated JavaScript parses',()=>{
  assert.doesNotThrow(()=>new Function(store));
  assert.doesNotThrow(()=>new Function(hub));
  assert.doesNotThrow(()=>new Function(ghost));
  assert.doesNotThrow(()=>new Function(quick));
  assert.doesNotThrow(()=>new Function(worker));
});
