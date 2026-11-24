'use strict';
/* Run: node --test tests/phase0_safety.test.cjs
   Tests intentionally use a mocked PostgREST server. No live DB writes. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ghost=fs.readFileSync(path.join(__dirname,'../js/ghost_test.js'),'utf8');
const hub=fs.readFileSync(path.join(__dirname,'../js/learning_hub.js'),'utf8');
const src=ghost.slice(ghost.indexOf('/* ladder:'),ghost.indexOf('/* かな→kanji'));
const USER='5817df8a-043f-4aaf-9832-59ff82a6ae2e';
function updater(fetcher,poster,user=USER){
  const factory=new Function('fetch','jpUser','jpUserQ','ghRK','ghSlowLimit','ghDayPlus','jpPostSplit',
    src+'\nreturn jpUpdateReviews;');
  return factory(fetcher,()=>user,()=> 'user_id=eq.'+user+'&',
    (k,d)=>k+'\u0001'+d,()=>20,()=> '2026-11-25',poster);
}
const entry=(kanji,correct=true)=>({
  kanji,direction:'read',is_correct:correct,rating:correct?5:1,
  seconds:8,test_date:'2026-11-24'
});
test('modified JS is syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(ghost));
  assert.doesNotThrow(()=>new Function(hub));
});
test('same Japanese sheet is not counted twice; later sheet is counted',async()=>{
  const rows=new Map();let sent=0;
  const read=async()=>({ok:true,json:async()=>[...rows.values()]});
  const post=async(url,headers,items)=>{
    sent+=items.length;
    for(const x of items)rows.set(x.kanji+'\u0001'+x.direction,x);
  };
  const save=updater(read,post);
  await save([entry('花')],'https://example.invalid','test-key','sheet-1');
  await save([entry('花')],'https://example.invalid','test-key','sheet-1');
  assert.equal(sent,1);
  assert.equal(rows.get('花\u0001read').correct_count,1);
  assert.equal(rows.get('花\u0001read').history[0].sid,'sheet-1');
  await save([entry('花')],'https://example.invalid','test-key','sheet-2');
  assert.equal(rows.get('花\u0001read').correct_count,2);
});
test('read errors abort before any inserts or upserts',async()=>{
  let wrote=false;
  const save=updater(async()=>({ok:false,status:403,json:async()=>({message:'Denied'})}),
    async()=>{wrote=true;});
  await assert.rejects(save([entry('花')],'https://example.invalid','test-key','sheet-1'),/Denied/);
  assert.equal(wrote,false);
});
test('partial write retries only missing Japanese review rows',async()=>{
  const rows=new Map();let call=0;
  const save=updater(
    async()=>({ok:true,json:async()=>[...rows.values()]}),
    async(url,headers,items)=>{
      call++;
      if(call===1){
        rows.set(items[0].kanji+'\u0001'+items[0].direction,items[0]);
        throw new Error('Network dropped after partial commit');
      }
      for(const x of items)rows.set(x.kanji+'\u0001'+x.direction,x);
    });
  const marks=[entry('花'),entry('月',false)];
  await assert.rejects(save(marks,'https://example.invalid','test-key','sheet-1'));
  await save(marks,'https://example.invalid','test-key','sheet-1');
  assert.equal(rows.get('花\u0001read').correct_count,1);
  assert.equal(rows.get('月\u0001read').wrong_count,1);
});
test('invalid Japanese user ID is rejected',async()=>{
  const save=updater(async()=>({ok:true,json:async()=>[]}),async()=>{},'invalid');
  await assert.rejects(save([entry('花')],'https://example.invalid','test-key','sheet-1'),/valid Japanese user_id/);
});
test('student fallback downloads the answer-free manifest, never the key',()=>{
  assert.match(hub,/download\(new Blob\(\[manifest\]/);
  assert.doesNotMatch(hub,/if\(!written\)\s*\{[^}]*download\(new Blob\(\[key\]/);
  assert.match(hub,/async function downloadPrivateGraderKey\(\)/);
  assert.match(hub,/filename:fname\.replace\(\/\\\.pdf\$\/,'-grader\.json'\)/);
});
test('saved drafts persist their attempt and account ID',()=>{
  assert.match(ghost,/saveId:GH\.saveId\|\|null/);
  assert.match(ghost,/ownerId:SESSION&&SESSION\.user/);
  assert.match(ghost,/d\.ownerId&&\(!SESSION/);
});
