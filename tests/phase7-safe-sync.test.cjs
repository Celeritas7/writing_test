'use strict';
/* Run: node --test tests/phase7-safe-sync.test.cjs
 * Hermetic tests. No production Supabase calls or storage changes. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'js/offline_sync.js'),'utf8');
const store=fs.readFileSync(path.join(root,'js/offline_store.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const analytics=fs.readFileSync(path.join(root,'js/analytics_view.js'),'utf8');
const OWNER='11111111-1111-4111-8111-111111111111';
const ID1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function row(id=ID1,kind='quick'){
  return {id,user_id:OWNER,problem_id:'problem-1',topic_id:'topic-1',
    correct:true,rating:5,graded_by:kind==='hub'?'ghost':'self',
    graded_at:'2026-11-25T00:00:00.000Z',
    notes:'Local practice result',score:1,max_score:1};
}
function job(id='job-1',kind='quick',rows=[row(ID1,kind)]){
  return {id,kind,owner:OWNER,rows,createdAt:'2026-11-25T00:00:00.000Z'};
}
function rig(options={}){
  const cache=new Map((options.existing||[]).map(x=>[x.id,{...x}]));
  const pending=new Map((options.jobs||[job()]).map(j=>[j.id,j]));
  const receipts=[],state={read:0,writes:0,requests:0,authorizations:0};
  const settings={auto:false,identity:OWNER,allow:true,insertError:null,
    insertErrorAfterCommit:false,readFailureAt:0,...options};
  const WTOffline={
    pending:async user=>[...pending.values()].filter(x=>x.owner===user),
    acknowledge:async(user,id,proof)=>{
      assert.equal(user,OWNER);assert.ok(pending.has(id));
      assert.ok(proof.ids.length);
      receipts.push({id,proof});
      pending.delete(id);
    },
    getSyncPreference:async()=>!!settings.auto
  };
  const selectApi={
    in(field,ids){
      assert.equal(field,'id');
      return {eq:async(field2,user)=>{
        assert.equal(field2,'user_id');assert.equal(user,OWNER);
        state.read++;
        if(settings.readFailureAt===state.read)return {data:null,error:new Error('Connection dropped')};
        return {data:ids.map(id=>cache.get(id)).filter(Boolean),error:null};
      }};
    }
  };
  const sb={
    auth:{getUser:async()=>{
      state.authorizations++;
      return {data:{user:{id:settings.identity,email:'student@example.com'}},error:null};
    }},
    from:table=>{
      assert.equal(table,'written_test_attempts');
      return {
        select:()=>selectApi,
        insert:async rows=>{
          state.writes++;state.requests++;
          if(settings.insertError&&!settings.insertErrorAfterCommit)
            return {error:new Error(settings.insertError)};
          for(const row of rows){
            if(cache.has(row.id))return {error:new Error('duplicate key')};
            cache.set(row.id,{...row,max_score:row.max_score??1,score:row.score??null});
          }
          return {error:settings.insertErrorAfterCommit?new Error('Lost response'):null};
        }
      };
    }
  };
  const env={
    window:{WTOffline},WTOffline,SESSION:{user:{id:OWNER}},OFFLINE_MODE:false,
    DEMO:false,navigator:{onLine:true},location:{hash:'#setup'},
    authRole:async()=>settings.allow?{role:'student'}:null,
    sb,document:{getElementById:()=>null},ATTEMPTS:[],
    Date
  };
  vm.runInNewContext(code,env);
  return {api:env.window.WTOfflineSync,logic:env.window.WTOfflineSyncLogic,
    cache,pending,receipts,state,settings,env};
}
test('validates signed-in owner, UUIDs and grading source before any upload',()=>{
  const r=rig(),logic=r.logic;
  assert.equal(logic.payloads(job(),OWNER).length,1);
  assert.throws(()=>logic.payloads(job('bad','japanese',[]),OWNER),/Invalid/);
  assert.throws(()=>logic.payloads(job('bad','quick',[{...row(),user_id:'other'}]),OWNER),/Invalid/);
  assert.throws(()=>logic.payloads(job('bad','quick',[{...row(),id:'not-uuid'}]),OWNER),/Invalid/);
  assert.throws(()=>logic.payloads(job('bad','quick',[{...row(),graded_by:'cowork'}]),OWNER),/Invalid/);
  assert.throws(()=>logic.payloads(job('bad','quick',[row(ID1),row(ID1)]),OWNER),/Invalid/);
});
test('matching server row uses exact marks, owner, method and timestamps',()=>{
  const logic=rig().logic,r=row();
  assert.equal(logic.matches(r,{...r}),true);
  assert.equal(logic.matches(r,{...r,graded_at:'2026-11-25T09:00:00+09:00'}),true);
  assert.equal(logic.matches(r,{...r,correct:false}),false);
  assert.equal(logic.matches(r,{...r,graded_by:'cowork'}),false);
  assert.equal(logic.matches(r,{...r,notes:'Changed feedback'}),false);
  assert.equal(logic.matches(r,{...r,user_id:'other'}),false);
});
test('first upload is insert-only, read back and atomically acknowledged',async()=>{
  const r=rig();
  const result=await r.api.sync();
  assert.equal(result.synced,1);assert.equal(result.rows,1);
  assert.equal(r.state.writes,1);
  assert.ok(r.state.read>=2);
  assert.equal(r.cache.size,1);assert.equal(r.pending.size,0);
  assert.equal(r.receipts.length,1);assert.equal(r.receipts[0].proof.ids[0],ID1);
  assert.equal(r.env.ATTEMPTS[0].pending_local,undefined);
});
test('previously committed result is verified, not overwritten on retry',async()=>{
  const r=rig({existing:[row()]});
  const result=await r.api.sync();
  assert.equal(result.synced,1);assert.equal(r.state.writes,0);
  assert.equal(r.receipts.length,1);
});
test('lost insert response but confirmed server write is safe to acknowledge',async()=>{
  const r=rig({insertErrorAfterCommit:true});
  const result=await r.api.sync();
  assert.equal(result.synced,1);assert.equal(r.state.writes,1);
  assert.equal(r.pending.size,0);
});
test('failed upload or failed read-back leaves all local marks intact',async()=>{
  const r1=rig({insertError:'Internet unavailable'});
  const fail=await r1.api.sync();
  assert.equal(fail.synced,0);assert.equal(fail.blocked,1);
  assert.equal(r1.pending.size,1);assert.equal(r1.receipts.length,0);
  const r2=rig({readFailureAt:2});
  const interrupted=await r2.api.sync();
  assert.equal(interrupted.synced,0);assert.equal(interrupted.blocked,1);
  assert.equal(r2.pending.size,1);
  r2.settings.readFailureAt=0;
  const retry=await r2.api.sync();
  assert.equal(retry.synced,1);assert.equal(r2.state.writes,1);
  assert.equal(r2.receipts.length,1);
});
test('server conflict never overwrites a Cowork grade or deletes local job',async()=>{
  const r=rig({existing:[{...row(),graded_by:'cowork',rating:4,notes:'External grader'}]});
  const result=await r.api.sync();
  assert.equal(result.synced,0);assert.equal(result.blocked,1);
  assert.equal(r.state.writes,0);assert.equal(r.receipts.length,0);
  assert.equal(r.cache.get(ID1).notes,'External grader');
  assert.equal(r.pending.size,1);
});
test('wrong signed-in identity or revoked allowlist never syncs',async()=>{
  const a=rig({identity:'22222222-2222-4222-8222-222222222222'});
  await assert.rejects(a.api.sync(),/could not be verified/);
  assert.equal(a.state.writes,0);
  const b=rig({allow:false});
  await assert.rejects(b.api.sync(),/not verified on the access list/);
  assert.equal(b.state.writes,0);
});
test('Japanese sessions stay local and are never sent to Technical Supabase',async()=>{
  const japanese={id:'japanese-1',kind:'japanese',owner:OWNER,
    items:[{id:'jp1',raw_mark:3}],rows:[],createdAt:'2026-11-25T00:00:00Z'};
  const r=rig({jobs:[job(),japanese]});
  const result=await r.api.sync();
  assert.equal(result.synced,1);assert.equal(result.japanese,1);
  assert.equal(r.pending.size,1);assert.ok(r.pending.has('japanese-1'));
});
test('optional auto-sync refuses to run during active handwriting or without opt-in',async()=>{
  const r=rig();
  assert.equal(await r.api.autoSyncIfEnabled(),null);
  assert.equal(r.state.writes,0);
  r.settings.auto=true;r.env.location.hash='#ghost';
  assert.equal(await r.api.autoSyncIfEnabled(),null);
  r.env.location.hash='#quick';
  assert.equal(await r.api.autoSyncIfEnabled(),null);
  r.env.location.hash='#home';
  const result=await r.api.autoSyncIfEnabled();
  assert.equal(result.synced,1);
});
test('readback receipt and pending deletion require the same transaction',()=>{
  assert.match(store,/db\.transaction\(\['pending','meta'\],'readwrite'\)/);
  assert.match(store,/meta\.put\(/);
  assert.match(store,/store\.delete\(id\)/);
  assert.match(store,/Acknowledgement was not committed/);
  assert.doesNotMatch(code,/\.upsert\(/);
  assert.match(code,/await WTOffline\.acknowledge\(/);
});
test('UI offers manual sync, explicit auto opt-in, backup and separate Japanese status',()=>{
  assert.match(hub,/Sync pending Hub \/ Quick results/);
  assert.match(hub,/toggleOfflineAutoSync/);
  assert.match(hub,/exportSyncReceipts/);
  assert.match(hub,/Japanese held locally/);
  assert.match(hub,/WTOffline\.queuedAttempts/);
  assert.match(index,/js\/offline_sync\.js/);
  assert.match(worker,/js\/offline_sync\.js/);
  assert.match(analytics,/WTOffline\.queuedAttempts/);
});
test('Phase 7 modules parse with previous offline app',()=>{
  assert.doesNotThrow(()=>new Function(code));
  assert.doesNotThrow(()=>new Function(store));
  assert.doesNotThrow(()=>new Function(hub));
  assert.doesNotThrow(()=>new Function(worker));
});
