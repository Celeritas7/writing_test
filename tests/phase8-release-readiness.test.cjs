'use strict';
/* node --test tests/phase8-release-readiness.test.cjs
 * Read-only hermetic release-gate checks. No live database, iPad or network. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'js/release_readiness.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
const offline=fs.readFileSync(path.join(root,'js/offline_store.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const env={window:{}};
vm.runInNewContext(core,env);
const {readCompleteSnapshot,audit,summarizeStatuses}=env.window.WTRelease;
const seq=(prefix,n)=>Array.from({length:n},(_,i)=>({id:prefix+i,
  prompt:prefix+' question '+i,graded_at:'2026-11-25T00:00:00Z'}));
const sources={
  written_test_subjects:seq('s',2),
  written_test_topics:seq('t',3),
  written_test_problems:seq('p',405),
  written_test_attempts:seq('a',4),
  written_test_batches:seq('b',1)
};
function mockDb(data=sources,options={}){
  const queries=[],counts=[];
  const client={from(table){
    if(!(table in data))throw Error('Wrong table '+table);
    return {
      select(columns,settings){
        if(settings&&settings.head){
          counts.push(table);
          return Promise.resolve({
            error:options.countError?.[table]?{message:'Denied'}:null,
            count:options.overrideCount?.[table]??data[table].length
          });
        }
        const ordered=[];
        return {
          order(name){ordered.push(name);return this;},
          range:async(start,end)=>{
            queries.push({table,start,end,ordered});
            if(options.pageError?.[table]===start)
              return {data:null,error:{message:'Connection lost'}};
            return {data:data[table].slice(start,end+1),error:null};
          }
        };
      }
    };
  }};
  return {client,queries,counts};
}
test('paged snapshot confirms all five table counts and includes rows past 1000 cap',async()=>{
  const data={...sources,written_test_problems:seq('p',1203)};
  const db=mockDb(data),events=[];
  const result=await readCompleteSnapshot(db.client,x=>events.push(x));
  assert.equal(result.completeSnapshot,true);
  assert.equal(result.problems.length,1203);
  assert.equal(result.counts.problems,1203);
  assert.equal(result.batches.length,1);
  assert.equal(result.subjects.length,2);
  assert.equal(db.counts.length,5);
  assert.deepEqual(db.queries.filter(x=>x.table==='written_test_problems')
    .map(x=>x.start),[0,400,800,1200]);
  assert.ok(events.some(x=>x.table==='problems'&&x.downloaded===1203));
  for(const query of db.queries){
    assert.deepEqual(query.ordered.slice(-1),['id']);
    assert.ok(query.end-query.start<400);
  }
});
test('mismatched count stops incomplete pack instead of silently marking Ready',async()=>{
  const db=mockDb(sources,{overrideCount:{written_test_problems:406}});
  await assert.rejects(readCompleteSnapshot(db.client),/received 405 of 406/);
});
test('duplicate or malformed IDs fail the snapshot and preserve the previous pack',async()=>{
  const corrupt={...sources,written_test_problems:[
    {id:'same'},{id:'same'}
  ]};
  await assert.rejects(readCompleteSnapshot(mockDb(corrupt).client),/duplicate ID/);
  const wrong={...sources,written_test_topics:[{id:1}]};
  await assert.rejects(readCompleteSnapshot(mockDb(wrong).client),/invalid or duplicate ID/);
});
test('source errors, unavailable counts and oversized sources fail closed',async()=>{
  await assert.rejects(readCompleteSnapshot(mockDb(sources,{
    pageError:{written_test_problems:400}
  }).client),/page 2 failed/);
  await assert.rejects(readCompleteSnapshot(mockDb(sources,{
    countError:{written_test_attempts:true}
  }).client),/count failed/);
  await assert.rejects(readCompleteSnapshot(mockDb(sources,{
    overrideCount:{written_test_problems:20001}
  }).client),/verified offline download limit/);
});
function diagnosticsSetup({complete=true,standalone=true,
  controlled=true,persisted=true,pending=false}={}){
  const p={id:'SECRET-ACCOUNT-ID',savedAt:'2026-11-25T00:00:00Z',
    completeSnapshot:complete,counts:{subjects:1,topics:1,problems:1,attempts:0,batches:0},
    subjects:[{id:'secret-subject'}],topics:[{id:'secret-topic'}],
    problems:[{id:'secret-problem',answer:'PRIVATE ANSWER CONTENT'}],
    attempts:[],batches:[]};
  const offline={
    assetsReady:async()=>true,enrolled:async()=>true,pack:async()=>p,
    pending:async()=>pending?[
      {id:'secret-job',kind:'quick',owner:'SECRET-ACCOUNT-ID',
        items:[{answer:'PRIVATE ANSWER CONTENT'}]},
      {id:'secret-jp',kind:'japanese',owner:'SECRET-ACCOUNT-ID',
        items:[{answer:'PRIVATE ANSWER CONTENT'}]}]:[],
    receipts:async()=>[{jobId:'secret-receipt',ids:['secret-uuid']}]
  };
  const nav={serviceWorker:{controller:controlled?{}:null},
    storage:{estimate:async()=>({usage:1048576*2,quota:1048576*120}),
      persisted:async()=>persisted}};
  return {offline,owner:'SECRET-ACCOUNT-ID',navigator:nav,
    storage:nav.storage,modeIsStandalone:standalone};
}
test('sanitized diagnostics never export owner, answers or queued handwriting',async()=>{
  const report=await audit(diagnosticsSetup({pending:true}));
  assert.equal(report.format,'wt-ipad-diagnostics-v8');
  assert.equal(report.pendingCounts.quick,1);
  assert.equal(report.pendingCounts.japanese,1);
  assert.equal(report.summary.deviceAcceptance,'not-verified');
  const json=JSON.stringify(report);
  assert.doesNotMatch(json,/SECRET-ACCOUNT-ID|PRIVATE ANSWER CONTENT|secret-receipt|secret-uuid|secret-job/);
  assert.equal(report.sensitiveFieldsIncluded,false);
  assert.ok(report.checks.some(x=>x.code==='queue'&&x.status==='warn'));
});
test('legacy pack, missing worker and nonpersistent storage are flagged clearly',async()=>{
  const report=await audit(diagnosticsSetup({complete:false,
    standalone:false,controlled:false,persisted:false}));
  assert.equal(report.checks.find(x=>x.code==='snapshot').status,'warn');
  assert.equal(report.checks.find(x=>x.code==='worker').status,'fail');
  assert.equal(report.checks.find(x=>x.code==='storage').status,'warn');
  assert.equal(report.summary.technicalStatus,'needs-attention');
});
test('release cannot be declared GO merely because automated checks passed',()=>{
  const x=summarizeStatuses([{status:'pass'},{status:'pass'}]);
  assert.equal(x.deviceAcceptance,'not-verified');
  assert.equal(x.technicalStatus,'technical-checks-pass');
});
test('offline readiness uses paginated verified snapshots and current cache assets',()=>{
  assert.match(hub,/WTRelease\.readCompleteSnapshot\(sb/);
  assert.match(hub,/WTOffline\.savePack\(p\)/);
  assert.ok(hub.indexOf('WTRelease.readCompleteSnapshot(sb')<
    hub.indexOf('await WTOffline.savePack(p)'));
  assert.match(offline,/wt-ipad-assets-phase8/);
  assert.match(offline,/js\/release_readiness\.js/);
  assert.match(worker,/lh-v2-phase8/);
  assert.match(worker,/js\/release_readiness\.js/);
  assert.match(index,/js\/release_readiness\.js/);
  assert.doesNotMatch(worker,/caches\.delete\(/);
});
test('device diagnostic UI is read-only and can export a safe summary',()=>{
  assert.match(hub,/Run iPad readiness checks/);
  assert.match(hub,/window\.runIpadDiagnostics=async/);
  assert.match(hub,/window\.exportIpadDiagnostics=/);
  assert.match(hub,/WTRelease\.audit\(/);
  assert.match(hub,/LAST_IPAD_DIAGNOSTIC/);
  assert.match(hub,/JSON.stringify\(report,null,2\)/);
});
test('all local scripts in index are included in both offline asset lists',()=>{
  const localScripts=[...index.matchAll(/<script src="(js\/[^"]+)"/g)].map(m=>m[1]);
  assert.ok(localScripts.length>=10,'expected all current study modules');
  for(const file of localScripts){
    assert.ok(offline.includes("'"+file+"'"),file+' missing from download manifest');
    assert.ok(worker.includes("'"+file+"'"),file+' missing from worker shell');
  }
  assert.ok(index.indexOf('js/release_readiness.js')>
    index.indexOf('js/offline_store.js'));
});
test('snapshot download checks live account and allowlist before saving',()=>{
  assert.match(hub,/const user=await sb\.auth\.getUser\(\)/);
  assert.match(hub,/const allowed=await authRole\(user\.data\.user\.email\)/);
  assert.match(hub,/Account or connection changed during download/);
});
test('source modules parse without a build step',()=>{
  assert.doesNotThrow(()=>new Function(core));
  assert.doesNotThrow(()=>new Function(hub));
  assert.doesNotThrow(()=>new Function(offline));
  assert.doesNotThrow(()=>new Function(worker));
});
