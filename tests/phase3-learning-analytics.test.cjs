'use strict';
/* Run: node --test tests/phase3-learning-analytics.test.cjs
 * No network calls, private credentials or production database writes. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const core=fs.readFileSync(path.join(root,'js/learning_analytics.js'),'utf8');
const view=fs.readFileSync(path.join(root,'js/analytics_view.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
const quick=fs.readFileSync(path.join(root,'js/quick_practice.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/learning_hub.css'),'utf8');
const env={window:{}};
vm.runInNewContext(core,env);
const {collect,report}=env.window.WTAnalytics;
const subjects=[{id:'math',name:'Mathematics'},{id:'lang',name:'Languages'}];
const topics=[{id:'t1',name:'Algebra',subject_id:'math'},
  {id:'t2',name:'Japanese Hub',subject_id:'lang'}];
const problems=[
  {id:'w',topic_id:'t1',subtitle:'Eliminate a variable'},
  {id:'due',topic_id:'t1',subtitle:'Quadratic roots'},
  {id:'old',topic_id:'t1',subtitle:'Old exercise'},
  {id:'new',topic_id:'t1',subtitle:'Never tried'},
  {id:'self',topic_id:'t2',subtitle:'Reading'},
  {id:'ghost',topic_id:'t2',subtitle:'Write a character'},
  {id:'other',topic_id:'t2',subtitle:'Legacy item'}
];
let seq=0;
function attempt(id,date,correct,graded_by,extras={}){
  return {id:'attempt-'+(++seq),problem_id:id,graded_at:date+'T12:00:00Z',
    correct,graded_by,...extras};
}
const attempts=[
  attempt('w','2026-11-21',false,'cowork',{rating:2,notes:'Recheck your algebra sign'}),
  attempt('w','2026-11-20',false,'cowork',{rating:1}),
  attempt('due','2026-11-01',true,'claude',{rating:4}),
  attempt('old','2026-10-15',true,'cowork',{rating:5}),
  attempt('self','2026-11-23',true,'self',{rating:5}),
  attempt('ghost','2026-11-22',false,'ghost',{rating:1}),
  attempt('other','2026-11-20',true,'legacy',{rating:5}),
  attempt('w','2026-12-01',true,'cowork',{rating:5}),
  attempt('external','2026-11-20',false,'cowork')
];
attempts.push({...attempts[0]}); // duplicate UUID must be counted once
const statusOf=(p,latest)=>{
  if(!latest[p.id])return {code:'new'};
  return {code:p.id==='w'||p.id==='ghost'?'weak':p.id==='due'?'due':'ok'};
};
const calc=(changes={})=>collect({
  problems,topics,subjects,attempts,days:30,now:new Date('2026-11-24T18:00:00Z'),
  statusOf,...changes
});
test('correct marks stay separate for Cowork, self, Ghost and legacy',()=>{
  const a=calc();
  assert.equal(a.attempts,6);
  assert.equal(a.methods.cowork.n,3);
  assert.equal(a.methods.cowork.correct,1);
  assert.equal(a.methods.self.n,1);
  assert.equal(a.methods.self.pct,100);
  assert.equal(a.methods.ghost.n,1);
  assert.equal(a.methods.ghost.pct,0);
  assert.equal(a.methods.other.n,1);
  assert.equal(a.methods.cowork.previous.n,1);
});
test('selected subject excludes other subjects and unknown problem IDs',()=>{
  const math=calc({subject:'math'});
  assert.equal(math.bankCount,4);
  assert.equal(math.attempts,3);
  assert.equal(math.methods.self.n,0);
  const lang=calc({subject:'lang'});
  assert.equal(lang.bankCount,3);
  assert.equal(lang.attempts,3);
  assert.equal(lang.methods.cowork.n,0);
});
test('latest state, repeat misses and actionable focus are correctly ordered',()=>{
  const a=calc();
  assert.equal(a.statuses.weak,2);
  assert.equal(a.statuses.due,1);
  assert.equal(a.statuses.new,1);
  assert.equal(a.repeated,1);
  assert.equal(a.focus[0].id,'w');
  assert.equal(a.focus[0].misses,2);
  assert.equal(a.focus[1].id,'ghost');
  assert.equal(a.focus[2].id,'due');
  assert.equal(a.focus[0].notes,'Recheck your algebra sign');
});
test('future, invalid and duplicate timestamps are excluded',()=>{
  const a=calc();
  assert.equal(a.attempts,6);
  assert.equal(a.distinctRecent,5);
  const empty=calc({attempts:[],now:new Date('2026-11-24T18:00:00Z')});
  assert.equal(empty.methods.cowork.pct,null);
  assert.equal(empty.statuses.new,problems.length);
  assert.equal(empty.focus.length,0);
});
test('time buckets sum exactly to the total attempt count for all periods',()=>{
  for(const days of [7,30,90]){
    const a=calc({days});
    assert.equal(a.series.reduce((n,b)=>n+b.count,0),a.attempts);
    assert.equal(a.series.reduce((n,b)=>n+b.cowork+b.self+b.ghost+b.other,0),a.attempts);
    assert.ok(a.series.length<=14);
  }
});
test('report avoids reference answers and freeform private feedback notes',()=>{
  const r=report(calc());
  assert.match(r,/LEARNING HUB/);
  assert.match(r,/Cowork graded/);
  assert.match(r,/Self-rated|Quick Practice/);
  assert.doesNotMatch(r,/Recheck your algebra sign/);
  assert.doesNotMatch(r,/answer:/);
  assert.match(r,/Japanese Study project data/);
});
test('analytics is accessible without adding a phone bottom tab',()=>{
  assert.match(index,/data-nav="analytics"/);
  assert.match(hub,/page==='analytics'/);
  assert.match(hub,/href="#analytics"/);
  assert.match(index,/js\/learning_analytics.js/);
  assert.match(index,/js\/analytics_view.js/);
  assert.match(sw,/js\/analytics_view.js/);
  assert.match(css,/\.nav-item\.an-nav\{display:none!important\}/);
});
test('refresh is read-only and prevents incomplete replacement',()=>{
  assert.match(view,/\.select\('\*'\)\.order\('graded_at'/);
  assert.match(view,/\.range\(offset,offset\+pageSize-1\)/);
  assert.match(view,/More than 10,000 attempts/);
  assert.match(view,/Account changed during refresh/);
  assert.doesNotMatch(view,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
});
test('analysis and presentation files parse',()=>{
  assert.doesNotThrow(()=>new Function(core));
  assert.doesNotThrow(()=>new Function(view));
  assert.doesNotThrow(()=>new Function(hub));
  assert.doesNotThrow(()=>new Function(quick));
  assert.doesNotThrow(()=>new Function(sw));
});
