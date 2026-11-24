'use strict';
/* Phase 5 checks: node --test tests/phase5-ipad-accessibility.test.cjs
 * Hermetic pointer/UI checks; no production data, Safari automation or network. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ghost=fs.readFileSync(path.join(root,'js/ghost_test.js'),'utf8');
const quick=fs.readFileSync(path.join(root,'js/quick_practice.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/learning_hub.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function section(src,start,end){
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert.ok(a>=0&&b>a,'Cannot find '+start);
  return src.slice(a,b);
}
function isolated(src,name,deps,locals=''){
  return new Function(...Object.keys(deps),locals+'\n'+src+'\nreturn '+name+';')(
    ...Object.values(deps));
}
function rig(){
  let captures=[],saved=0,redrawn=0,prevented=0;
  const canvas={
    getContext:()=>({}),
    setPointerCapture:id=>captures.push(id)
  };
  const GH={locked:false,savePrepared:false,wi:1,tool:'pen',strokes:[],
    drawer:false,boxes:true,paper:'warm',more:false,items:[],finger:false};
  const deps={
    GH,GH_W:[1,2,3],GH_RAF_LIMIT:0,
    $:id=>id==='gh-ink'?canvas:null,
    document:{body:{classList:{toggle(){}}}},
    window:{_ghResizeBound:true},addEventListener:()=>{},
    ghResize:()=>{},ghPos:e=>[e.clientX,e.clientY],ghOwner:()=>null,
    ghFocus:()=>{},ghPing:()=>{},ghPaintTail:()=>{},
    ghDraftSave:()=>{saved++;},ghRedraw:()=>{redrawn++;},
    ghApplyFinger:()=>{},ghInitUndoTap:()=>{},ghInitBrush:()=>{},
    ghScore:()=>{},ghSyncA11yControls:()=>{},ghStartClock:()=>{},
    ghLoadLimits:async()=>{},ghClock:()=>{},
    requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}
  };
  const init=isolated(section(ghost,'function ghInit(){','/* marking drawer.'),
    'ghInit',deps,'let ghCv=null,ghCtx=null,ghCur=null,ghRaf=0;');
  init();
  const pointer=(pointerId,clientX=12,clientY=13,pointerType='pen')=>
    ({pointerId,clientX,clientY,pointerType,cancelable:true,
      preventDefault(){prevented++;}});
  return {GH,canvas,pointer,
    get captures(){return captures},get saved(){return saved},
    get redrawn(){return redrawn},get prevented(){return prevented}};
}
test('Pencil stroke ignores unrelated palm pointer moves and pointerup',()=>{
  const r=rig();
  r.canvas.onpointerdown(r.pointer(7));
  r.canvas.onpointermove(r.pointer(3,200,250,'touch'));
  r.canvas.onpointerup(r.pointer(3,200,250,'touch'));
  assert.equal(r.GH.strokes.length,0);
  r.canvas.onpointermove(r.pointer(7,20,21));
  r.canvas.onpointerup(r.pointer(7,21,22));
  assert.equal(r.GH.strokes.length,1);
  assert.deepEqual(r.GH.strokes[0].p,[12,13,20,21]);
  assert.equal(r.saved,1);
  assert.equal(r.prevented,1);
});
test('iPad canceled empty touch does not manufacture a dot, but meaningful ink remains',()=>{
  const r=rig();r.GH.finger=true;
  r.canvas.onpointerdown(r.pointer(1,4,5,'touch'));
  r.canvas.onpointercancel(r.pointer(1,4,5,'touch'));
  assert.equal(r.GH.strokes.length,0);
  r.canvas.onpointerdown(r.pointer(2,6,7,'touch'));
  r.canvas.onpointermove(r.pointer(2,12,14,'touch'));
  r.canvas.onpointercancel(r.pointer(2,12,14,'touch'));
  assert.equal(r.GH.strokes.length,1);
  assert.equal(r.saved,1);
});
test('Pencil cannot mutate a locked sheet or one awaiting save acknowledgement',()=>{
  const r=rig();
  r.GH.savePrepared=true;
  r.canvas.onpointerdown(r.pointer(1));
  r.GH.savePrepared=false;r.GH.locked=true;
  r.canvas.onpointerdown(r.pointer(2));
  assert.equal(r.captures.length,0);
});
test('undo is blocked while the handwriting save is pending',()=>{
  const GH={strokes:[{p:[1,2,3,4]}],savePrepared:true,locked:false};
  let redraws=0,notices=0;
  const fn=isolated(section(ghost,'window.ghUndo=()=>{','window.ghClear=async'),
    'window.ghUndo',{
      window:{},GH,toast:()=>{notices++;},
      ghRedraw:()=>{redraws++;},ghDraftSave:()=>{}
    });
  fn();assert.equal(GH.strokes.length,1);assert.equal(notices,1);
  GH.savePrepared=false;fn();assert.equal(GH.strokes.length,0);assert.equal(redraws,1);
});
test('marking updates VoiceOver label after each changed rating',()=>{
  let label='',score=0;
  const el={className:'',textContent:''};
  const number={className:'',setAttribute:(name,v)=>{if(name==='aria-label')label=v;}};
  const cell={querySelector:q=>q==='.gh-mk'?el:number};
  const GH={locked:false,savePrepared:false,marks:{},items:[{id:'p1'}],seq:false};
  const fn=isolated(section(ghost,'function ghSetMark(id, m){','window.ghBrush=(b)=>'),
    'ghSetMark',{GH,document:{querySelector:()=>cell},
      ghScore:()=>{score++;},ghDraftSave:()=>{},ghRequeue:()=>{},toast:()=>{}});
  fn('p1',2);assert.match(label,/Item 1: partly correct/);
  fn('p1',3);assert.match(label,/Item 1: wrong/);
  assert.equal(score,2);
});
test('Ghost marks use native buttons for VoiceOver activation',()=>{
  assert.match(ghost,/<button type="button" class="gh-n/);
  assert.match(ghost,/onclick="ghMark\(event/);
  assert.doesNotMatch(ghost,/role="button" tabindex="0" aria-label="Item/);
  assert.match(css,/\.gh-n\{[^}]*appearance:none/);
});
test('toggle controls expose their current pressed and expanded state',()=>{
  const values={};
  const control=key=>({setAttribute:(k,v)=>{values[key+':'+k]=v;}});
  const buttons={};
  for(const k of ['#gh-pen','#gh-erase','#gh-finger','.gh-boxes-b','.gh-paper-b',
    '.gh-open','.gh-more'])buttons[k]=control(k);
  const brushClass={c1:true,c2:false,c3:false};
  const brush={classList:{contains:k=>brushClass[k]||false},
    setAttribute:(k,v)=>{values['brush:'+k]=v;}};
  const fn=isolated(section(ghost,'function ghSyncA11yControls(){','function ghInit(){'),
    'ghSyncA11yControls',{
      GH:{tool:'pen',finger:false,boxes:true,paper:'plain',ghost:true,
        drawer:true,more:true,brush:1},
      document:{
        querySelector:q=>buttons[q]||null,
        querySelectorAll:q=>q==='.gh-ghost'?[control('ghost')]:
          q==='.gh-mk-b'?[brush]:[]
      }
    });
  fn();
  assert.equal(values['#gh-pen:aria-pressed'],'true');
  assert.equal(values['#gh-erase:aria-pressed'],'false');
  assert.equal(values['#gh-finger:aria-pressed'],'false');
  assert.equal(values['.gh-open:aria-expanded'],'true');
  assert.equal(values['.gh-more:aria-expanded'],'true');
  assert.equal(values['ghost:aria-pressed'],'true');
  assert.equal(values['brush:aria-pressed'],'true');
});
test('Quick Practice refocuses headings and answer reveal after navigation',()=>{
  let focused=0;
  const fn=isolated(section(quick,'function focusPractice(id){','function applyHandlers(map){'),
    'focusPractice',{
      $:id=>id==='qp-revealed-answer'?{focus:()=>{focused++;}}:null,
      onPage:()=>true
    });
  fn('qp-revealed-answer');assert.equal(focused,1);
  assert.match(quick,/id="qp-current-step" tabindex="-1"/);
  assert.match(quick,/id="qp-revealed-answer" role="region"/);
  assert.match(quick,/aria-labelledby="qp-mode-label"/);
});
test('Ghost source switcher and Japanese panel pills remain accessible on phones',()=>{
  assert.match(ghost,/gh-source-mobile/);
  assert.match(ghost,/aria-label="Choose writing source"/);
  assert.match(ghost,/id="gh-mobile-topic"/);
  assert.match(css,/body\.gh-view \.gh-source-mobile\{display:flex/);
  assert.match(css,/body\.gh-view \.pillbar\{display:flex\}/);
  assert.doesNotMatch(css,/body\.gh-view \.main>p,body\.gh-view \.pillbar,\.gh-inst/);
});
test('skip control, main focus, route announcement, reduced motion are present',()=>{
  assert.match(html,/Skip to main study content/);
  assert.match(html,/id="main" tabindex="-1"/);
  assert.match(html,/id="route-announcer" role="status"/);
  assert.match(hub,/aria-current/);
  assert.match(hub,/target\.focus\(\{preventScroll:true\}\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.sr-only/);
});
test('Ghost global shortcuts do not hijack editing, buttons or modal dialogs',()=>{
  assert.match(ghost,/e\.defaultPrevented\|\|e\.isComposing/);
  assert.match(ghost,/dialog\[open\]/);
  assert.match(ghost,/input\|select\|textarea\|button/i);
});
test('existing service worker and all touched JavaScript still parse',()=>{
  assert.doesNotThrow(()=>new Function(ghost));
  assert.doesNotThrow(()=>new Function(quick));
  assert.doesNotThrow(()=>new Function(hub));
  assert.doesNotThrow(()=>new Function(sw));
});
