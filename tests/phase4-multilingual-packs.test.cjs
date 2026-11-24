'use strict';
/* Run: node --test tests/phase4-multilingual-packs.test.cjs
 * Hermetic: does not use Supabase, remote language tables or live site storage. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const coreJs=fs.readFileSync(path.join(root,'js/multilingual_core.js'),'utf8');
const packsJs=fs.readFileSync(path.join(root,'js/multilingual_packs.js'),'utf8');
const ghostJs=fs.readFileSync(path.join(root,'js/ghost_test.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/learning_hub.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const state={window:{}};
vm.runInNewContext(coreJs,state);
const core=state.window.WTMultiCore;
const sample={format:'wt-writing-pack-v1',language_code:'my',name:'Burmese practice',
  items:[{id:'w1',form:'မင်္ဂလာပါ',reading:'mingalaba',meaning:'hello',script:'Mymr',
    source:{project:'Technical',app:'Burmese',table:'words',id:'10',pk_type:'integer'}},
    {id:'w2',form:'ရေ',reading:'ye',meaning:'water',script:'Mymr'}]};
const uuid='f725896c-fc1e-4cdf-b90b-dae4f4c7e018';
function stored(data){return {...core.normalize(data),pack_key:uuid};}
test('Unicode Burmese, Chinese, Japanese, Marathi forms remain intact',()=>{
  for(const [code,form,reading] of [
    ['my','မင်္ဂလာပါ','mingalaba'],['zh','你好','nǐ hǎo'],['ja','水','みず'],
    ['mr','नमस्कार','namaskār']]){
    const p=core.normalize({format:'wt-writing-pack-v1',language_code:code,
      name:code,items:[{id:'1',form,reading,meaning:'greeting'}]});
    assert.equal(p.items[0].form,form);
    assert.equal(p.items[0].reading,reading);
  }
});
test('shared public vocabulary mappings retain immutable source IDs',()=>{
  const input={format:'lex-v1-public-export',language_code:'zh',name:'Chinese trial',
    records:[{id:'record1',form_text:'水',reading:'shuǐ',gloss_text:'water',
      source_project:'Technical',source_app:'Chinese Study',
      source_table:'chinese_study_app_words',source_pk:'23',
      source_pk_type:'integer',entry_id:'entry-uuid',form_id:'form-uuid',
      sense_id:'sense-uuid',script_code:'Hani'}]};
  const entry=core.normalize(input).items[0];
  assert.equal(entry.provenance.source_pk,'23');
  assert.equal(entry.provenance.source_pk_type,'integer');
  assert.equal(entry.provenance.entry_id,'entry-uuid');
  assert.equal(entry.provenance.sense_id,'sense-uuid');
  assert.equal(entry.form,'水');
});
test('invalid or sensitive exports never enter the pack',()=>{
  const clone=()=>JSON.parse(JSON.stringify(sample));
  const withToken=clone();withToken.access_token='secret';
  assert.throws(()=>core.normalize(withToken),/not permitted/);
  const withUser=clone();withUser.items[0].user_id='somebody';
  assert.throws(()=>core.normalize(withUser),/not permitted/);
  const sameIds=clone();sameIds.items[1].id='w1';
  assert.throws(()=>core.normalize(sameIds),/Duplicate/);
  const noAnswer=clone();delete noAnswer.items[0].reading;delete noAnswer.items[0].meaning;
  assert.throws(()=>core.normalize(noAnswer),/needs a reading or meaning/);
  const tooMany=clone();tooMany.items=Array.from({length:501},(_,i)=>({...sample.items[0],id:String(i)}));
  assert.throws(()=>core.normalize(tooMany),/1–500/);
});
test('script-neutral directions never fabricate transliterations',()=>{
  const pack=stored(sample);
  const read=core.sheet(pack,'reading',20);
  const write=core.sheet(pack,'write',20);
  const meaning=core.sheet(pack,'meaning',20);
  assert.equal(read[0].prompt,'မင်္ဂလာပါ');
  assert.equal(read[0].answer,'mingalaba');
  assert.equal(write[0].prompt,'hello');
  assert.equal(write[0].answer,'မင်္ဂလာပါ');
  assert.equal(meaning[0].answer,'hello');
  assert.match(write[0].id,/^ml-[a-zA-Z0-9]+-0-write$/);
  assert.equal(write[0].source_record.source_pk,'10');
  assert.equal(write[0].rev,true);
});
test('portable evidence preserves raw labels and correct skill scope',()=>{
  const pack=stored(sample),items=core.sheet(pack,'write');
  const saved=core.evidence({sessionId:'session1',owner:'alice',pack,mode:'write',
    items,marks:{[items[0].id]:1,[items[1].id]:2},when:'2026-11-24T13:00:00Z'});
  assert.equal(saved.answers.length,2);
  assert.equal(saved.answers[0].skill,'writing');
  assert.equal(saved.answers[0].source_app,'writing_test');
  assert.equal(saved.answers[1].raw_label,'partial');
  assert.equal(saved.answers[1].correct,false);
  assert.equal(saved.answers[0].source_event_key,'session1:'+items[0].id);
  const recognized=core.evidence({sessionId:'session2',owner:'alice',pack,mode:'meaning',
    items:core.sheet(pack,'meaning'),marks:{[core.sheet(pack,'meaning')[0].id]:3}});
  assert.equal(recognized.answers[0].skill,'recognition');
});
test('account-scoped local pack and evidence never leak into another user',async()=>{
  const storage=new Map();let account='alice',wrote=0;
  const pack=stored(sample);
  storage.set('wt-language-packs-v1:alice',[pack]);
  const ghostItems=core.sheet(pack,'write');
  const env={
    window:{WTMultiCore:core},DEMO:false,
    SESSION:{user:{id:'alice'}},GH:{ext:{src:'lex_import',owner:'alice',
      pack_key:pack.pack_key,mode:'write'},sessionId:'session-1',
      attemptTime:'2026-11-24T13:00:00Z',
      items:ghostItems,marks:{[ghostItems[0].id]:1}},
    idb:{get:async k=>storage.get(k)||null,set:async(k,v)=>{wrote++;storage.set(k,v);}},
    crypto:{randomUUID:()=>uuid},esc:s=>String(s),
    toast:()=>{},ask:async()=>true,renderGhost:()=>{},
    document:{createElement:()=>({}),getElementById:()=>null},
    Blob:class{},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}}
  };
  vm.runInNewContext(packsJs,env);
  const api=env.window.WTMulti;
  assert.equal((await api.readPacks()).length,1);
  assert.equal(await api.saveGhostEvidence(),true);
  assert.equal(await api.saveGhostEvidence(),false); // idempotent session
  assert.equal((await api.readEvidence()).length,1);
  account='bob';env.SESSION.user.id=account;
  assert.equal((await api.readPacks()).length,0);
  assert.equal((await api.readEvidence()).length,0);
  await assert.rejects(api.saveGhostEvidence(),/owner mismatch/i);
  assert.equal(storage.get('wt-language-evidence-v1:alice').length,1);
  assert.ok(wrote>=1);
});
test('old Japanese draft key stays in place and imported draft is owner-scoped',()=>{
  assert.match(ghostJs,/const GH_DRAFT_KEY='gh-draft'/);
  assert.match(ghostJs,/GH_LEX_DRAFT_KEY\(owner\)/);
  assert.match(ghostJs,/if\(d.ext&&d.ext.src==='lex_import'\)/);
  assert.match(packsJs,/gh-draft-lex-/);
  assert.match(packsJs,/ghResumeLanguageSheet/);
});
test('imported Ghost Test saves are local-only, not sent as Japanese reviews',()=>{
  const first=ghostJs.indexOf("if(GH.ext&&GH.ext.src==='lex_import'){",ghostJs.indexOf('async function ghSaveNow()'));
  const second=ghostJs.indexOf("const hub=!GH.ext||GH.ext.src==='hub';",first);
  assert.ok(first>=0&&second>first);
  const body=ghostJs.slice(first,second);
  assert.match(body,/WTMulti\.saveGhostEvidence\(\)/);
  assert.doesNotMatch(body,/japanese_user_reviews|written_test_attempts|jpUpdateReviews/);
});
test('modules are cache-listed and preserve Ghost, Japanese and mobile styling',()=>{
  assert.match(index,/js\/multilingual_core\.js/);
  assert.match(index,/js\/multilingual_packs\.js/);
  assert.match(index,/js\/japanese_source\.js/);
  assert.match(sw,/js\/multilingual_core\.js/);
  assert.match(sw,/js\/multilingual_packs\.js/);
  assert.match(css,/\.ml-packs/);
  assert.match(ghostJs,/ghToggleLanguagePacks/);
});
test('new JavaScript modules parse without bundling',()=>{
  assert.doesNotThrow(()=>new Function(coreJs));
  assert.doesNotThrow(()=>new Function(packsJs));
  assert.doesNotThrow(()=>new Function(ghostJs));
});
