'use strict';
/* Run: node --test tests/phase2-quick-practice.test.cjs
 * Fully local tests; no Supabase writes, browser storage mutations or network. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/quick_practice.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/learning_hub.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const environment={
  window:{},document:{addEventListener(){}},addEventListener(){}
};
vm.runInNewContext(source,environment);
const {select,resultRow,createSession}=environment.window.WTQuickLogic;
const p=(id,state,topic='t1',text='Question '+id)=>({
  id,topic_id:topic,number:1,unit_no:1,prompt:text,subtitle:id,
  answer:'Reference '+id,state
});
const bank=[p('weak','weak'),p('due','due'),p('new','new'),p('future','ok'),
  p('math-new','new','t2'),p('no-prompt','new','t1','')];
const status=item=>({code:item.state,due:item.state==='due'?new Date('2026-11-01'):null});
const subject=tid=>tid==='t1'?'languages':'maths';
const opts=(mode,minutes=10,topic='all',subjectId='all')=>({
  mode,minutes,subject:subjectId,topic
});
const ids=items=>Array.from(items,x=>x.id);
test('due mode includes only weak and due, weak/new modes are strict',()=>{
  assert.deepEqual(ids(select(bank,status,subject,opts('due'))),['weak','due']);
  assert.deepEqual(ids(select(bank,status,subject,opts('weak'))),['weak']);
  assert.deepEqual(ids(select(bank,status,subject,opts('new'))),['new','math-new']);
});
test('subject and topic filters never leak unrelated material',()=>{
  assert.deepEqual(ids(select(bank,status,subject,opts('new',10,'all','languages'))),['new']);
  assert.deepEqual(ids(select(bank,status,subject,opts('new',10,'t2','all'))),['math-new']);
});
test('session length caps questions and random mode respects the selected pool',()=>{
  const large=Array.from({length:30},(_,i)=>p('w'+i,'new'));
  for(const n of [5,10,20])assert.equal(select(large,status,subject,opts('new',n)).length,n);
  const shuffled=select(bank,status,subject,opts('random',20),()=>0);
  assert.equal(shuffled.length,5);
  assert.equal(new Set(ids(shuffled)).size,5);
});
test('sessions snapshot problems, retain account identity and unique submission IDs',()=>{
  let num=0;
  const s=createSession([p('a','new'),p('b','new')],opts('due',5),
    'user-1',()=>String(++num),123456789);
  assert.equal(s.owner,'user-1');assert.equal(s.id,'1');
  assert.equal(s.remainingSec,300);assert.equal(s.paused,false);
  assert.notEqual(s.items[0].attemptId,s.items[1].attemptId);
  assert.equal(s.items[0].answer,'Reference a');
  assert.equal(s.items[0].grade,null);
});
test('quick self-ratings have clear provenance and do not leak answer keys to notes',()=>{
  const item={id:'a',topic_id:'t1',attemptId:'uuid-1',
    grade:5,ratedAt:'2026-11-24T00:00:00Z',response:'My written attempt',
    answer:'PRIVATE ANSWER KEY'};
  const good=resultRow(item,'user-1',opts('new',5));
  assert.equal(good.correct,true);assert.equal(good.graded_by,'self');
  assert.equal(good.user_id,'user-1');assert.equal(good.id,'uuid-1');
  assert.match(good.notes,/My written attempt/);
  assert.doesNotMatch(good.notes,/PRIVATE ANSWER KEY/);
  item.grade=3;
  const almost=resultRow(item,'user-1',opts('due',5));
  assert.equal(almost.correct,false);assert.equal(almost.rating,3);
  item.grade=1;assert.equal(resultRow(item,'user-1',opts('due',5)).correct,false);
  item.grade=null;assert.equal(resultRow(item,'user-1',opts('due',5)),null);
});
function isolated(start,end,deps){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Cannot find '+start);
  const fn=source.slice(a,b);
  const names=Object.keys(deps);
  return new Function(...names,fn+'\nreturn endSession;')(...names.map(n=>deps[n]));
}
test('failed network save keeps a pending draft; retry reuses the same UUID',async()=>{
  const session={
    id:'session',owner:'user-1',phase:'active',paused:false,
    opts:opts('weak',5),items:[{id:'a',topic_id:'t1',attemptId:'stable-uuid',
      grade:5,response:'Four',ratedAt:'2026-11-24T00:00:00Z'}]
  };
  const Q={session,busy:false,finished:null,lastTick:1};
  let writes=0, persisted=0, rerenders=0, attempts=[], messages=[];
  const deps={
    Q,countRated:s=>s.items.filter(x=>x.grade!=null).length,
    ask:async()=>true,saveSnapshot:async()=>{persisted++;},
    renderQuickPractice:()=>{rerenders++;},DEMO:false,
    sb:{from:()=>({upsert:async rows=>{writes++;attempts.push(...rows);
      return {error:writes===1?new Error('Network unavailable'):null};}})},
    resultRow,ATTEMPTS:[],
    removeSnapshot:async()=>{},toast:message=>messages.push(message)
  };
  const fn=isolated('async function endSession(){','async function backupPending(){',deps);
  await fn();
  assert.equal(Q.session,session);
  assert.equal(Q.session.phase,'pending');
  assert.equal(Q.busy,false);
  assert.equal(persisted,1);
  assert.ok(rerenders>=1);
  assert.match(messages.at(-1),/NOT synced/);
  await fn();
  assert.equal(Q.session,null);
  assert.equal(Q.finished.count,1);
  assert.equal(attempts[0].id,'stable-uuid');
  assert.equal(attempts[1].id,'stable-uuid');
});
test('old routes and Ghost Test remain accessible, Quick reachable on iPad',()=>{
  assert.match(hub,/page==='quick'/);
  assert.match(hub,/href="#quick"/);
  assert.match(index,/js\/quick_practice\.js/);
  assert.match(index,/data-nav="ghost"/);
  assert.match(sw,/js\/quick_practice\.js/);
  assert.match(css,/\.nav-item\.qp-nav\{display:none!important\}/);
});
test('save paths include account-scoped draft, pending backup and visible-time pause',()=>{
  assert.match(source,/const key=\(\)=>draftKey\(owner\(\)\)/);
  assert.match(source,/draftKey\(Q\.session\.owner\)/);
  assert.match(source,/Q\.persistChain/);
  assert.match(source,/phase='pending'/);
  assert.match(source,/onConflict:'id'/);
  assert.match(source,/Export pending backup/);
  assert.match(source,/visibilitychange/);
  assert.match(source,/document\.hidden/);
});
test('Phase 2 scripts parse',()=>{
  assert.doesNotThrow(()=>new Function(source));
  assert.doesNotThrow(()=>new Function(hub));
});
