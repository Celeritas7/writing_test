'use strict';
/* Run: node --test tests/phase0-safety.test.cjs
   Hermetic checks: no calls to Supabase or the network. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ghost=fs.readFileSync(path.join(root,'js/ghost_test.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
function excerpt(source,start,end){
  const a=source.indexOf(start), b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Missing function '+start);
  return source.slice(a,b);
}
function instantiate(source,name,dependencies){
  const args=Object.keys(dependencies);
  return new Function(...args,source+'\nreturn '+name+';')(...args.map(k=>dependencies[k]));
}
const updateSource=excerpt(ghost,'async function jpUpdateReviews(', '/* かな→kanji');
function rig(){
  let saved=[],sent=[];
  const deps={
    fetch:async()=>({ok:true,json:async()=>saved}),
    jpUserQ:()=> 'user_id=eq.verified&',
    ghRK:(k,d)=>k+'\u0001'+d,
    ghSlowLimit:()=>20,
    srsNext:()=>({days:3,step:2,lapses:0,halved:false}),
    ghDayPlus:()=> '2026-11-27',
    jpUser:()=> '5817df8a-043f-4aaf-9832-59ff82a6ae2e',
    ghWho:()=> 'verified',
    jpPostSplit:async(_endpoint,_headers,rows)=>{sent.push(rows);if(rows.length)saved=rows;}
  };
  return {deps,sent,get saved(){return saved;}};
}
test('Japanese retry counts a sheet only once',async()=>{
  const r=rig(),fn=instantiate(updateSource,'jpUpdateReviews',r.deps);
  const log=[{kanji:'犬',direction:'read',seconds:6,is_correct:true,rating:5,test_date:'2026-11-24'}];
  await fn(log,'https://example.test','test-key','session-123');
  assert.equal(r.sent[0].length,1);
  assert.equal(r.saved[0].history[0].sid,'session-123');
  assert.equal(r.saved[0].correct_count,1);
  await fn(log,'https://example.test','test-key','session-123');
  assert.equal(r.sent[1].length,0);
  assert.equal(r.saved[0].correct_count,1);
});
test('Failed review fetch refuses to write a fresh row',async()=>{
  const r=rig();let writes=0;
  const fn=instantiate(updateSource,'jpUpdateReviews',{...r.deps,
    fetch:async()=>({ok:false,status:403,json:async()=>({message:'Denied'})}),
    jpPostSplit:async()=>{writes++;},
  });
  await assert.rejects(fn([{kanji:'犬',direction:'read'}],'https://example.test','k','s'),/Denied/);
  assert.equal(writes,0);
});
test('Durable draft stores retry IDs, marks and pencil strokes',async()=>{
  let saved=null;
  const fn=instantiate(excerpt(ghost,'async function ghDraftPersist()', 'function ghDraftSave'),
    'ghDraftPersist',{
      GH:{locked:false,items:[{id:'x'}],topic:'jp',marks:{x:1},
        strokes:[{w:1,e:false,own:'x',ox:0,oy:0,p:[[0.5,0.5]]}],
        time:{x:8},sessionId:'stable',attemptIds:{x:'uuid-1'},
        attemptTime:'2026-11-24',savePrepared:true},
      idb:{set:async(_key,entry)=>{saved=entry;}},GH_DRAFT_KEY:'gh-draft',
      ghCurrentDraftKey:()=> 'gh-draft'
    });
  await fn();
  assert.equal(saved.sessionId,'stable');
  assert.equal(saved.attemptIds.x,'uuid-1');
  assert.equal(saved.savePrepared,true);
  assert.equal(saved.strokes.length,1);
});
test('Student download cannot automatically include grader answers',()=>{
  assert.match(hub,/download\(new Blob\(\[manifest\]/);
  assert.doesNotMatch(hub,/download\(new Blob\(\[key\]/);
  assert.match(hub,/window\.downloadGraderKey=async/);
  assert.match(hub,/\.grader\.json/);
});
test('Changed JavaScript parses',()=>{
  assert.doesNotThrow(()=>new Function(ghost));
  assert.doesNotThrow(()=>new Function(hub));
});
