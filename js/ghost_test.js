/* Ghost test — on-screen handwritten sheet with answer overlay. Depends on globals from learning_hub.js */
let GH={topic:null, marks:{}, strokes:[], tool:'pen', wi:1, ghost:false, items:[], brush:0, time:{}, focus:null, act:0, limit:{}, finger:(()=>{try{return localStorage.getItem('gh-finger')==='1'}catch(e){return false}})(), drawer:(()=>{try{return localStorage.getItem('gh-drawer')==='1'}catch(e){return false}})(), more:false};
const GH_W=[1.6,2.6,4.2];

const GH_LANG=/lang|japan|kanji|kana|vocab|word/i;
function ghostTopics(){
  const langSubs=new Set(SUBJECTS.filter(s=>GH_LANG.test(s.name)).map(s=>s.id));
  return TOPICS.filter(t=>(langSubs.has(t.subject_id)||GH_LANG.test(t.name))&&PROBLEMS.some(p=>p.topic_id===t.id&&p.answer));
}
function renderGhost(){
  document.body.classList.add('gh-view');
  const tops=ghostTopics();
  if(!tops.length&&!GH.ext){ $('main').innerHTML=`<div class="kicker">Ghost test</div><h1 style="margin:4px 0 6px">Write on screen</h1>
    <div class="card" style="max-width:640px"><p style="margin:0 0 10px">Ghost test is for <b>language study</b> — word ⇄ reading pairs you write by hand.</p>
    <p style="color:var(--mute);margin:0 0 14px;font-size:13.5px">Pick a set from your Japanese database, or seed a local topic.</p>
    <button class="btn sm" onclick="ghImportPanel()">Browse my Japanese database</button>
    <button class="btn sm ghost" onclick="ghSeed()">Create “Kanji · Certi/Diploma” with 20 items</button></div>${ghPanelHtml()}`; return; }
  if(!GH.ext&&(!GH.topic||!tops.some(t=>t.id===GH.topic))){ GH.topic=tops[0].id; GH.marks={}; GH.strokes=[]; }
  const label = GH.ext ? GH.ext.label : (TOPICS.find(x=>x.id===GH.topic)||{}).name;
  GH.items = GH.ext ? GH.ext.items : PROBLEMS.filter(p=>p.topic_id===GH.topic&&p.answer).sort((a,b)=>(a.unit_no||a.number)-(b.unit_no||b.number)).slice(0,20);
  const pills=[`<button class="pill-t ${GH.ext?'on':''}" onclick="ghImportPanel()">日 Japanese database</button>`].concat(tops.map(x=>`<button class="pill-t ${!GH.ext&&GH.topic===x.id?'on':''}" onclick="ghPick('${esc(x.id)}')">${esc(x.name)}</button>`)).join('');
  const firstRev=GH.items.findIndex(p=>p.rev);
  const cells=GH.items.map((p,i)=>{
    const m=GH.marks[p.id]||0;
    return (i===firstRev&&i>0?`<div class="gh-rule"></div>`:'')+`<div class="gh-item${p.retry?' retry':''}" data-gid="${esc(p.id)}"><span class="gh-n${m?' m'+m:''}" onpointerup="ghMark(event,'${esc(p.id)}')">${i+1}.</span> <span class="gh-w">${esc(p.prompt||p.subtitle)}</span><span class="gh-clk${ghSlowNow(p.id)?' on':''}" aria-label="Slow for this word">◷</span><span class="gh-t-sec">${GH.time[p.id]?Math.round(GH.time[p.id])+'s':''}</span><span class="gh-mk ${['','ok','mid','bad'][m]}">${['','✓','△','✗'][m]}</span><span class="gh-g">${esc(p.answer)}</span></div>`;
  }).join('');
  const nRev=GH.items.filter(p=>p.rev).length, nFwd=GH.items.length-nRev;
  const inst = nRev&&nFwd ? `1–${nFwd}　漢字→ひらがな (read)　　${nFwd+1}–${GH.items.length}　ひらがな→漢字 (write)`
    : nRev ? 'ひらがな→漢字 (write) · ghost overlay shows the key in red'
    : 'Write your answer under each item · ghost overlay shows the key in red';
  $('main').innerHTML=`<div class="gh-top"><div class="gh-title"><div class="kicker">Ghost test</div><h1>Write on screen</h1></div><div class="pillbar">${pills}</div></div>
    ${ghPanelHtml()}
    <div class="gh-bar">
      <button class="btn sm ghost gh-t on" id="gh-pen" onclick="ghTool('pen')">✎ Pen</button>
      <button class="btn sm ghost gh-t" id="gh-erase" onclick="ghTool('erase')">◌ Eraser</button>
      <button class="btn sm ghost gh-t" id="gh-width" onclick="ghWidth()">Width: M</button>
      <button class="btn sm ghost gh-t ${GH.finger?'on':''}" id="gh-finger" onclick="ghFinger()" title="Write with your finger (page won't scroll while on)">☝ Finger</button>
      <span class="gh-bar-sp"></span>
      <button class="btn sm gh-t gh-ghost gh-ghost-top ${GH.ghost?'on':''}" onclick="ghToggle()">Ghost</button>
      <button class="btn sm ghost gh-t gh-full-btn gh-full-top" onclick="ghFull()" title="Full screen (F)">⤢</button>
    </div>
    <div class="gh-work">
    <div class="gh-dock"><button class="gh-open" onclick="ghDrawer(true)"><span>◔ Mark &amp; save</span><span class="gh-cnt" id="gh-cnt">0 / ${GH.items.length} marked</span></button></div>
    <div class="gh-veil"></div>
    <div class="gh-drawer">
      <div class="gh-strip">
        <span class="gh-rail-h">Mark by</span>
        <button class="btn sm ghost gh-t gh-mk-b ${GH.brush===0?'on':''}" onclick="ghBrush(0)">Tap</button>
        <button class="btn sm ghost gh-t gh-mk-b c1 ${GH.brush===1?'on':''}" onclick="ghBrush(1)">✓</button>
        <button class="btn sm ghost gh-t gh-mk-b c2 ${GH.brush===2?'on':''}" onclick="ghBrush(2)">△</button>
        <button class="btn sm ghost gh-t gh-mk-b c3 ${GH.brush===3?'on':''}" onclick="ghBrush(3)">✗</button>
        <button class="btn sm ghost gh-t gh-more ${GH.more?'on':''}" onclick="ghMore()" title="More controls">⋯</button>
        <button class="btn sm ghost gh-t gh-x" onclick="ghDrawer(false)" title="Close">✕</button>
      </div>
      <div class="gh-tally"><div class="gh-tbar"><i class="t1" id="gh-t1"></i><i class="t2" id="gh-t2"></i><i class="t3" id="gh-t3"></i></div><div class="gh-tcnt"><span id="gh-cnt2">0 / ${GH.items.length} marked</span><span id="gh-tsum"></span></div></div>
      <div class="gh-rest">
        <button class="btn sm ghost gh-t" onclick="ghRestPass()">Rest ✓</button>
        <button class="btn sm ghost gh-t" onclick="ghClearMarks()">Clear marks</button>
        <button class="btn sm ghost gh-t" onclick="ghUndo()">↶ Undo</button>
        <button class="btn sm ghost gh-t" onclick="ghClear()">Clear ink</button>
        <button class="btn sm gh-t gh-ghost ${GH.ghost?'on':''}" id="gh-ghost" onclick="ghToggle()">Ghost</button>
        <button class="btn sm ghost gh-t gh-full-btn" onclick="ghFull()" title="Full screen (F)">⤢ Full screen</button>
        <button class="btn sm gh-t gh-exit" onclick="ghFull(false)">✕ Exit full screen</button>
        <button class="btn sm ghost gh-t" onclick="ghImportPanel()">目 Import</button>
        <button class="btn sm gh-save" onclick="ghSave()">Save results</button>
      </div>
      <div class="gh-endcard" id="gh-endcard"></div>
    </div>
    <div class="gh-sheet ${GH.ghost?'ghost-on':''}${GH.locked?' locked':''}" id="gh-sheet">
      <div class="gh-hd"><h2>${esc(label||'Ghost test')}</h2><span class="s">|</span><span class="tt">Ghost test</span><span class="nm">名前 <u></u></span><span class="sc">得点 <b id="gh-score">___</b> / ${GH.items.length}</span></div>
      <p class="gh-inst">${esc(inst)}</p>
      <div class="gh-grid">${cells}</div>
      <canvas id="gh-ink"></canvas>
    </div>
    </div>`;
  ghInit();
}
/* ---- import from a second Supabase project (japanese_* tables) ---- */
/* Paste your Japanese project's URL and ANON key here — then the panel comes prefilled. */
const JP_URL = "https://ulgrfumbwjovbjzjiems.supabase.co";
const JP_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsZ3JmdW1id2pvdmJqemppZW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzIyNjcsImV4cCI6MjA4Mjk0ODI2N30.ix5Vh4Y3GXNbQbzVtTD_WSko0L3cr5q_eCnTuDEMh7M";
/* Your user_id in the Japanese project. That column is text but holds a uuid,
   so stamp the uuid — not the login email — or new rows won't match the old ones. */
const JP_USER_ID = "5817df8a-043f-4aaf-9832-59ff82a6ae2e";
const JP_DEFAULTS = {table:'', log:'', type:'ghost', n:20};

let GH_PANEL=false, GH_PREVIEW=null, GH_TABLES=null;
function ghWho(){ return (SESSION&&SESSION.user&&(SESSION.user.email||SESSION.user.id))||'ghost'; }
window.ghListTables=async()=>{
  const c=ghCfg(), url=($('jp-url').value.trim()||c.url).replace(/\/$/,''), key=$('jp-key').value.trim()||c.key;
  if(!url||!key){ toast('Enter the project URL and anon key first.'); return; }
  ghCfgField('url',url); ghCfgField('key',key);
  try{
    const r=await fetch(url+'/rest/v1/',{headers:{apikey:key,Authorization:'Bearer '+key}});
    const spec=await r.json();
    const all=Object.keys(spec.definitions||spec.components&&spec.components.schemas||{});
    GH_TABLES=all.filter(t=>/^japanese_/.test(t)).sort();
    if(!GH_TABLES.length){ GH_TABLES=all.sort(); }
    if(!GH_TABLES.length) throw new Error('No tables visible to the anon key — check RLS policies.');
    if(!GH_TABLES.includes(ghCfg().table)) ghCfgField('table', GH_TABLES[0]);
    toast(GH_TABLES.length+' tables found.');
  }catch(e){ GH_PREVIEW={err:'Could not list tables: '+(e.message||e)}; }
  renderGhost();
};
const ghCfg=()=>{ let c={}; try{ c=JSON.parse(localStorage.getItem('wt_jp_source')||'{}'); }catch(e){}
  return Object.assign({}, JP_DEFAULTS, c, JP_URL?{url:JP_URL}:{}, JP_ANON_KEY?{key:JP_ANON_KEY}:{}, JP_USER_ID?{user:JP_USER_ID}:{}); };
const ghCfgSet=o=>localStorage.setItem('wt_jp_source', JSON.stringify(o));
window.ghImportPanel=()=>{ GH_PANEL=!GH_PANEL; GH_PREVIEW=null; renderGhost(); if(GH_PANEL&&window.jpLoadTab) jpLoadTab(); };
window.ghCfgField=(k,v)=>{ const c=ghCfg(); c[k]=v.trim(); ghCfgSet(c); };
function ghPanelHtml(){
  if(!GH_PANEL) return '';
  if(window.jpPanelHtml) return window.jpPanelHtml();
  const c=ghCfg();
  const prev=GH_PREVIEW ? (GH_PREVIEW.err
    ? `<p class="msg err" style="margin-top:10px">${esc(GH_PREVIEW.err)}</p>`
    : `<div style="margin-top:12px"><div class="kicker">${GH_PREVIEW.rows.length} rows · columns: ${GH_PREVIEW.cols.map(esc).join(', ')}</div>
       <div style="margin-top:8px;font-size:14px;line-height:1.7">${GH_PREVIEW.rows.slice(0,6).map(r=>`${esc(r.q)} — <span style="color:#c0392b">${esc(r.a)}</span>`).join('<br>')}</div>
       <button class="btn sm" style="margin-top:12px" onclick="ghImportRun()">Import ${GH_PREVIEW.rows.length} items into this hub</button></div>`) : '';
  return `<div class="card" style="margin-bottom:16px;max-width:760px">
    <h3 style="margin-bottom:4px">Japanese database</h3>
    <p style="color:var(--mute);font-size:13px;margin:0 0 12px">Pull words from your other Supabase project. They are copied into this hub as problems, so ghost results and batch ranking work on one history.</p>
    <div class="formrow" style="margin-top:0">
      <div style="flex:1;min-width:240px"><label>Project URL</label><input id="jp-url" style="width:100%" placeholder="https://xxxx.supabase.co" value="${esc(c.url||'')}"></div>
      <div style="flex:1;min-width:240px"><label>Anon key</label><input id="jp-key" style="width:100%" placeholder="eyJhbGciOi…" value="${esc(c.key||'')}"></div>
    </div>
    <div class="formrow">
      <div><label>Table</label>${GH_TABLES?`<select id="jp-table" onchange="ghCfgField('table',this.value)" style="min-width:230px">${GH_TABLES.map(t=>`<option ${c.table===t?'selected':''}>${esc(t)}</option>`).join('')}</select>`:`<input id="jp-table" placeholder="japanese_words" value="${esc(c.table||'')}">`}</div>
      <div><label>Word column</label><input id="jp-q" placeholder="kanji" value="${esc(c.q||'')}" style="width:130px"></div>
      <div><label>Reading column</label><input id="jp-a" placeholder="hiragana" value="${esc(c.a||'')}" style="width:150px"></div>
      <div><label>Limit</label><input id="jp-n" type="number" min="1" max="200" value="${c.n||20}" style="width:80px"></div>
      <button class="btn sm ghost" onclick="ghListTables()">List tables</button>
      <button class="btn sm ghost" onclick="ghImportFetch()">Fetch preview</button>
    </div>
    <p style="color:var(--mute);font-size:12.5px;margin:10px 0 0">Leave the column names blank to let the app guess them from the first row.</p>
    <div class="formrow">
      <div><label>Write results back to</label><input id="jp-log" oninput="ghCfgField('log',this.value)" placeholder="japanese_daily_test_log" value="${esc(c.log==null?'japanese_daily_test_log':c.log)}" style="width:230px"></div>
      <div><label>user_id to stamp</label><input id="jp-user" oninput="ghCfgField('user',this.value)" placeholder="${esc(ghWho())} (from your login)" value="${esc(c.user||'')}" style="width:200px"></div>
      <div><label>test_type</label><input id="jp-type" oninput="ghCfgField('type',this.value)" placeholder="ghost" value="${esc(c.type||'ghost')}" style="width:110px"></div>
    </div>
    <p style="color:var(--mute);font-size:12.5px;margin:8px 0 0">Ghost results are written to that table (kanji · is_correct · rating · test_date) so your Japanese app sees them, and mirrored into this hub for batch ranking. Clear the table name to skip the write-back.</p>
    ${prev}</div>`;
}
window.ghImportFetch=async()=>{
  const c={url:$('jp-url').value.trim().replace(/\/$/,''), key:$('jp-key').value.trim(), table:$('jp-table').value.trim(), q:$('jp-q').value.trim(), a:$('jp-a').value.trim(), n:parseInt($('jp-n').value)||20, log:$('jp-log').value.trim(), user:$('jp-user').value.trim(), type:$('jp-type').value.trim()||'ghost'};
  if(!c.url||!c.key||!c.table){ toast('URL, anon key and table are required.'); return; }
  ghCfgSet(c);
  try{
    const r=await fetch(`${c.url}/rest/v1/${encodeURIComponent(c.table)}?select=*&limit=${c.n}`,{headers:{apikey:c.key, Authorization:'Bearer '+c.key}});
    const body=await r.json();
    if(!r.ok) throw new Error(body.message||body.hint||('HTTP '+r.status));
    if(!Array.isArray(body)||!body.length) throw new Error('That table returned no rows.');
    const cols=Object.keys(body[0]);
    const guess=(want,fb)=>cols.find(k=>want.test(k))||fb;
    const qc=c.q||guess(/kanji|word|term|front|question|expression/i, cols[1]||cols[0]);
    const ac=c.a||guess(/hiragana|kana|reading|yomi|answer|back|meaning/i, cols[2]||cols[1]);
    GH_PREVIEW={cols, qc, ac, rows:body.filter(x=>x[qc]&&x[ac]).map(x=>({q:String(x[qc]), a:String(x[ac])}))};
    if(!GH_PREVIEW.rows.length) throw new Error(`No usable pairs from columns “${qc}” / “${ac}” — name them explicitly above.`);
  }catch(e){ GH_PREVIEW={err:String(e.message||e)}; }
  renderGhost();
};
window.ghImportRun=async()=>{
  if(!GH_PREVIEW||!GH_PREVIEW.rows) return;
  const c=ghCfg();
  let sub=SUBJECTS.find(s=>GH_LANG.test(s.name));
  if(!sub){ sub={id:'language_study', name:'Language Study', sort_no:(SUBJECTS.length||0)+1};
    if(!DEMO){ const {error}=await sb.from('written_test_subjects').insert(sub); if(error){ toast('Could not create subject: '+error.message,6000); return; } }
    SUBJECTS.push(sub); }
  const tid='jp_'+slug(c.table||'words');
  let topic=TOPICS.find(t=>t.id===tid);
  if(!topic){ topic={id:tid, subject_id:sub.id, name:'Japanese · '+(c.table||'words'), branch_no:(TOPICS.length||0)+1, accent:'#c0392b'};
    if(!DEMO){ const {error}=await sb.from('written_test_topics').insert(topic); if(error){ toast('Could not create topic: '+error.message,6000); return; } }
    TOPICS.push(topic); }
  const base=PROBLEMS.filter(p=>p.topic_id===tid).length;
  const have=new Set(PROBLEMS.filter(p=>p.topic_id===tid).map(p=>p.prompt));
  const fresh=GH_PREVIEW.rows.filter(r=>!have.has(r.q));
  if(!fresh.length){ toast('Those words are already imported.'); return; }
  const rows=fresh.map((r,i)=>({id:tid+'-'+(base+i+1), topic_id:tid, number:base+i+1, unit_no:base+i+1, subtitle:'Read: '+r.q, prompt:r.q, answer:r.a, tier:'core', kind:'drill'}));
  if(!DEMO){ const {error}=await sb.from('written_test_problems').insert(rows); if(error){ toast('Import failed: '+error.message,6000); return; } }
  PROBLEMS.push(...rows);
  toast(rows.length+' words imported.');
  GH_PANEL=false; GH_PREVIEW=null; GH.topic=tid; GH.marks={}; GH.strokes=[]; renderGhost();
};
window.ghSeed=async()=>{
  const KJ=[['生える','はえる'],['六人','ろくにん'],['歩く','あるく'],['先々月','せんせんげつ'],['七人','しちにん'],['一年','いちねん'],['小学校','しょうがっこう'],['少女','しょうじょ'],['千本','せんぼん'],['あの方','あのかた'],['五万円','ごまんえん'],['先週','せんしゅう'],['上手(な)','じょうず'],['休み','やすみ'],['時間','じかん'],['のぼり','上り'],['げんき','元気'],['ちいさい','小さい'],['てま','手間'],['つぶら','円ら']];
  let sub=SUBJECTS.find(s=>GH_LANG.test(s.name));
  if(!sub){ sub={id:'language_study', name:'Language Study', sort_no:(SUBJECTS.length||0)+1};
    if(!DEMO){ const {error}=await sb.from('written_test_subjects').insert(sub); if(error){ toast('Could not create subject: '+error.message,6000); return; } }
    SUBJECTS.push(sub); }
  const topic={id:'kanji_certi', subject_id:sub.id, name:'Kanji · Certi/Diploma', branch_no:(TOPICS.length||0)+1, accent:'#c0392b'};
  const rows=KJ.map(([q,a],i)=>({id:'kanji_certi-'+(i+1), topic_id:topic.id, number:i+1, unit_no:i+1, subtitle:(i<15?'Read: ':'Write: ')+q, prompt:q, answer:a, tier:i<5?'warmup':i<15?'core':'challenge', kind:i<15?'drill':'concept'}));
  if(!DEMO){
    const r1=await sb.from('written_test_topics').insert(topic); if(r1.error){ toast('Could not create topic: '+r1.error.message,6000); return; }
    const r2=await sb.from('written_test_problems').insert(rows); if(r2.error){ toast('Could not add items: '+r2.error.message,6000); return; }
  }
  TOPICS.push(topic); PROBLEMS.push(...rows);
  toast('Kanji topic created with 20 items.');
  GH.topic=topic.id; GH.marks={}; GH.strokes=[]; GH.time={}; GH.focus=null; renderGhost();
};
window.ghPick=id=>{ GH.ext=null; GH.topic=id; GH.marks={}; GH.strokes=[]; GH.time={}; GH.focus=null; renderGhost(); };
window.ghMark=(e,id)=>{
  e.stopPropagation();
  if(GH.brush) return ghSetMark(id, GH.brush);
  ghSetMark(id, ((GH.marks[id]||0)+1)%4);
};
/* sequence mode: a ✗ word comes back 5 items later, until it's right */
function ghRequeue(id){
  const src=GH.items.find(p=>p.id===id); if(!src) return;
  const gen=(src.gen||0)+1; const rid=id+'#r'+gen;
  if(GH.items.some(p=>p.id===rid)) return;
  const at=Math.min(GH.items.length, GH.items.findIndex(p=>p.id===id)+6);
  GH.items.splice(at,0,{...src, id:rid, gen, retry:true});
  GH.items.forEach((p,i)=>{ p.number=i+1; p.unit_no=i+1; });
  toast('✗ '+(src.kanji||src.prompt)+' — back in 5 words.', 2600);
  renderGhost();
}
function ghScore(){ let s=0,any=false,n=0; const c4=[0,0,0,0]; for(const p of GH.items){ const m=GH.marks[p.id]||0; c4[m]++; if(m){any=true; n++; s+=m===1?1:m===2?.5:0;} } $('gh-score').textContent=any?(s%1?s.toFixed(1):s):'___';
  const c=$('gh-cnt'); if(c) c.textContent=n+' / '+GH.items.length+' marked';
  const c2=$('gh-cnt2'); if(c2) c2.textContent=n+' / '+GH.items.length+' marked';
  const ts=$('gh-tsum'); if(ts) ts.textContent=n?c4[1]+'✓ '+c4[2]+'△ '+c4[3]+'✗':'';
  for(let k=1;k<4;k++){ const b=$('gh-t'+k); if(b) b.style.width=(c4[k]/Math.max(1,GH.items.length)*100)+'%'; } }

/* ---- per-word clock -------------------------------------------------
   Time runs from the moment an item gets focus (you start writing in it,
   or tap it) until you leave it. It pauses after 10s with no activity,
   so a coffee break is not counted as thinking. Seconds go to
   japanese_user_reviews.seconds and into each history entry as `s`.
   Migration: alter table japanese_user_reviews add column seconds int;
-------------------------------------------------------------------- */
const GH_IDLE=10000, GH_TICK=500;
function ghFocus(id){
  if(!id) return;
  GH.act=Date.now();
  if(GH.focus!==id) GH.focus=id;
}
function ghPing(){ GH.act=Date.now(); }
function ghTick(){
  if(!GH.focus) return;
  if(Date.now()-GH.act>GH_IDLE) return;                 // idle: clock paused
  GH.time[GH.focus]=(GH.time[GH.focus]||0)+GH_TICK/1000;
  const cell=document.querySelector('.gh-item[data-gid="'+String(GH.focus).replace(/"/g,'\\"')+'"] .gh-t-sec');
  if(cell) cell.textContent=Math.round(GH.time[GH.focus])+'s';
  ghClock(GH.focus);
}
function ghStartClock(){ clearInterval(GH._clock); GH._clock=setInterval(ghTick, GH_TICK); }
function ghSeconds(id){ return Math.round(GH.time[id]||0); }

/* ---- Phase 2: slow-but-correct --------------------------------------
   Slow = longer than 1.5x the median of that word's last 3 recorded
   times. No history yet -> a flat 20s. A slow ✓ still advances the
   ladder, but only half the interval, snapped to the nearest ladder
   step: a slow correct answer that would have earned 8 days gets 4.
   The clock icon lights on the item the moment it crosses the line, so
   the shorter interval is never a surprise.
--------------------------------------------------------------------- */
const GH_SLOW_MULT=1.5, GH_SLOW_FLAT=20;
function ghMedian(a){ const v=a.slice().sort((x,y)=>x-y), n=v.length; if(!n) return 0; return n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2; }
function ghSlowLimit(prev){
  const past=(Array.isArray(prev&&prev.history)?prev.history:[]).map(h=>+((h&&h.s)||0)).filter(s=>s>0).slice(-3);
  return past.length ? GH_SLOW_MULT*ghMedian(past) : GH_SLOW_FLAT;
}
function ghKeyOf(p){ return p&&(p.kanji||p.prompt); }
const ghDirOf=p=>p&&p.rev?'write':'read';
const ghRK=(k,d)=>k+'\u0001'+d;   // review key: kanji + direction
function ghLimitFor(id){ const p=GH.items.find(x=>x.id===id); return (p&&GH.limit[ghRK(ghKeyOf(p),ghDirOf(p))])||GH_SLOW_FLAT; }
function ghSlowNow(id){ return (GH.time[id]||0) > ghLimitFor(id); }
function ghClock(id){
  const el=document.querySelector('.gh-item[data-gid="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"] .gh-clk');
  if(el) el.classList.toggle('on', ghSlowNow(id));
}
/* one read per sheet — last 3 times per word, so the icon can fire live */
async function ghLoadLimits(){
  GH.limit={};
  const c=ghCfg(), url=(typeof JP!=='undefined'&&JP.url)||c.url, key=(typeof JP!=='undefined'&&JP.key)||c.key;
  if(DEMO||!GH.ext||!url||!key||!GH.items.length) return;
  const list=GH.items.map(ghKeyOf).filter(Boolean);
  const inList='('+list.map(k=>'"'+String(k).replace(/"/g,'')+'"').join(',')+')';
  try{
    const r=await fetch(url+'/rest/v1/japanese_user_reviews?kanji=in.'+encodeURIComponent(inList)+'&select=kanji,direction,history',{headers:{apikey:key,Authorization:'Bearer '+key}});
    if(!r.ok) return;
    for(const row of await r.json()) GH.limit[ghRK(row.kanji,row.direction||'read')]=ghSlowLimit(row);
  }catch(e){}
}

/* ---- marking: tap to cycle, or arm a brush and drag across items ---- */
function ghSetMark(id, m){
  if(GH.locked) return;
  GH.marks[id]=m;
  const cell=document.querySelector('.gh-item[data-gid="'+String(id).replace(/"/g,'\\"')+'"]');
  if(cell){
    const el=cell.querySelector('.gh-mk');
    el.textContent=['','✓','△','✗'][m];
    el.className='gh-mk '+['','ok','mid','bad'][m];
    const n=cell.querySelector('.gh-n');
    if(n) n.className='gh-n'+(m?' m'+m:'');
  }
  ghScore();
  if(m===3&&GH.seq) ghRequeue(id);
}
window.ghBrush=(b)=>{
  GH.brush = GH.brush===b ? 0 : b;
  ghApplyBrush();
  toast(GH.brush
    ? 'Marker '+['','✓','△','✗'][GH.brush]+' — drag across items to mark'
    : 'Tap mode — tap an item number to cycle its mark', 2200);
  renderGhost();
};
function ghApplyBrush(){
  const sh=$('gh-sheet');
  if(ghCv) ghCv.style.pointerEvents = GH.brush ? 'none' : '';
  if(sh){ sh.style.cursor = GH.brush ? 'crosshair' : ''; sh.style.touchAction = GH.brush ? 'none' : ''; }
}
/* hit-test from the sheet: pointerdown captures the pointer, so per-item
   enter events never fire mid-drag */
let ghPainting=false, ghLastPainted=null;
function ghInitBrush(){
  const sh=$('gh-sheet'); if(!sh) return;
  const at=(x,y)=>{ const el=document.elementFromPoint(x,y); const c=el&&el.closest?el.closest('.gh-item'):null; return c?c.dataset.gid:null; };
  const brushAt=(x,y)=>{ const id=at(x,y); if(!id||id===ghLastPainted) return; ghLastPainted=id; ghSetMark(id, GH.brush); };
  sh.addEventListener('pointerdown',e=>{
    if(!GH.brush) return;
    ghPainting=true; ghLastPainted=null;
    if(e.target.releasePointerCapture&&e.target.hasPointerCapture&&e.target.hasPointerCapture(e.pointerId))
      e.target.releasePointerCapture(e.pointerId);
    e.preventDefault();
    brushAt(e.clientX,e.clientY);
  });
  sh.addEventListener('pointermove',e=>{ if(GH.brush&&ghPainting) brushAt(e.clientX,e.clientY); });
  addEventListener('pointerup',()=>{ ghPainting=false; ghLastPainted=null; });
  addEventListener('pointercancel',()=>{ ghPainting=false; ghLastPainted=null; });
  ghApplyBrush();
}
/* fill only the UNMARKED items — never overwrites a ✗ or △ you set */
window.ghRestPass=()=>{
  let n=0;
  for(const p of GH.items) if(!GH.marks[p.id]){ ghSetMark(p.id, 1); n++; }
  toast(n ? n+' unmarked '+(n===1?'item':'items')+' marked ✓' : 'Every item is already marked', 2200);
};
/* wipe every mark, with a warning. Ink is untouched. */
window.ghClearMarks=()=>{
  const n=Object.keys(GH.marks).filter(k=>GH.marks[k]).length;
  if(!n) return toast('No markings to clear', 1800);
  if(!confirm('Clear all '+n+' markings on this sheet?\n\nYour handwriting stays. This cannot be undone.')) return;
  GH.marks={};
  renderGhost();
  toast('All markings cleared', 2000);
};

/* ---- ink ---- */
let ghCtx,ghCv,ghCur=null;
function ghInit(){
  ghCv=$('gh-ink'); if(!ghCv) return; ghCtx=ghCv.getContext('2d');
  ghResize();
  ghCv.onpointerdown=e=>{ if(e.pointerType==='touch'&&!GH.finger) return; ghCv.setPointerCapture(e.pointerId); const p0=ghPos(e); const own=ghOwner(p0); ghFocus(own&&own.id); ghCur={w:GH_W[GH.wi],e:GH.tool==='erase',own:own&&own.id,ox:own?own.x:0,oy:own?own.y:0,p:[p0[0]-(own?own.x:0),p0[1]-(own?own.y:0)]}; };
  ghCv.onpointermove=e=>{ if(!ghCur) return; ghPing();
    const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    for(const ev of evs){ const q=ghPos(ev); ghCur.p.push(q[0]-ghCur.ox, q[1]-ghCur.oy); }
    if(!ghRaf) ghRaf=requestAnimationFrame(()=>{ ghRaf=0; if(ghCur) ghPaintTail(ghCur); });
  };
  ghCv.onpointerup=ghCv.onpointercancel=()=>{ if(!ghCur) return;
    if(ghRaf){ cancelAnimationFrame(ghRaf); ghRaf=0; }
    if(ghCur.p.length>=4) GH.strokes.push(ghCur);
    ghCur=null; ghRedraw();
  };
  ghApplyFinger();
  ghInitUndoTap();
  document.body.classList.toggle('gh-drawer-on', !!GH.drawer);
  document.body.classList.toggle('gh-more-on', !!GH.more);
  addEventListener('resize',ghResize);
  ghInitBrush();
  ghStartClock();
  ghLoadLimits().then(()=>{ for(const p of GH.items) ghClock(p.id); });
}
/* marking drawer. Closed, the bottom is one ◔ Mark & save bar carrying the
   marked count; open, it is the marker strip plus ⋯ (Rest/Clear/Undo/Ghost/
   Full screen/Import/Save) and ✕. It stays open across marks and across
   reloads, floats over the sheet, and on desktop docks bottom-right. */
window.ghDrawer=on=>{
  GH.drawer=!!on;
  try{ localStorage.setItem('gh-drawer', GH.drawer?'1':'0'); }catch(e){}
  document.body.classList.toggle('gh-drawer-on', GH.drawer);
};
window.ghMore=()=>{
  GH.more=!GH.more;
  document.body.classList.toggle('gh-more-on', GH.more);
  const b=document.querySelector('.gh-more'); if(b) b.classList.toggle('on', GH.more);
};
/* two-finger tap on the sheet = undo one stroke. Fires immediately, then
   repeats every 0.5s after a 0.6s hold. Cancelled by >12px of drift (that is
   a scroll or a pinch) and ignored while the Pencil is down (palm rejection).
   Works whether or not Finger mode is on. Undo also stays in the drawer. */
function ghInitUndoTap(){
  const sh=$('gh-sheet'); if(!sh||sh._utap) return; sh._utap=1;
  let t0=null,t1=null,first=null,rep=0,hold=0,dead=false,lead=0,saved=null;
  const stop=()=>{ clearTimeout(hold); clearTimeout(lead); clearInterval(rep); hold=rep=lead=0; t0=t1=null; saved=null; dead=false; };
  const fire=()=>{ if(!GH.strokes.length) return stop(); saved=GH.strokes[GH.strokes.length-1]; ghUndo(); toast('Undid stroke', 1200); };
  if(!window._ghPenTrack){
    window._ghPenTrack=1;
    addEventListener('pointerup',e=>{ if(e.pointerType==='pen') GH.penDown=false; },true);
    addEventListener('pointercancel',e=>{ if(e.pointerType==='pen') GH.penDown=false; },true);
  }
  sh.addEventListener('pointerdown',e=>{ if(e.pointerType==='pen') GH.penDown=true; },true);
  sh.addEventListener('touchstart',e=>{
    if(e.touches.length!==2||GH.penDown||dead) return;
    t0=e.touches[0]; t1=e.touches[1];
    first=[t0.clientX,t0.clientY,t1.clientX,t1.clientY];
    e.preventDefault();
    ghUndoSeen();
    lead=setTimeout(()=>{ lead=0; if(dead) return; fire();
      hold=setTimeout(()=>{ rep=setInterval(fire,500); },600); },120);
  },{passive:false});
  sh.addEventListener('touchmove',e=>{
    if(!first||e.touches.length!==2) return;
    const a=e.touches[0],b=e.touches[1];
    const d=Math.max(Math.hypot(a.clientX-first[0],a.clientY-first[1]),
                     Math.hypot(b.clientX-first[2],b.clientY-first[3]));
    if(d>12){ dead=true; clearTimeout(lead); clearTimeout(hold); clearInterval(rep); hold=rep=lead=0;
      if(saved){ GH.strokes.push(saved); saved=null; ghRedraw&&ghRedraw(); } }
  },{passive:true});
  sh.addEventListener('touchend',()=>{ first=null; stop(); });
  sh.addEventListener('touchcancel',()=>{ first=null; stop(); });
  ghUndoHint();
}
/* one-time discovery hint, touch devices only, shown when the sheet opens. */
function ghUndoHint(){
  if(!matchMedia('(hover:none)').matches) return;
  try{ if(localStorage.getItem('gh-undo-hint')) return; }catch(e){ return; }
  setTimeout(()=>toast('Two-finger tap to undo a stroke', 3200), 900);
  ghUndoSeen();
}
function ghUndoSeen(){ try{ localStorage.setItem('gh-undo-hint','1'); }catch(e){} }
/* finger writing. Off by default so a touch-drag scrolls the page; on, the
   canvas swallows touch (touch-action:none) and finger strokes ink like the
   Pencil. Pencil always writes either way. */
function ghApplyFinger(){
  if(ghCv) ghCv.style.touchAction = GH.finger ? 'none' : 'auto';
  const b=$('gh-finger'); if(b) b.classList.toggle('on', !!GH.finger);
}
window.ghFinger=()=>{
  GH.finger=!GH.finger;
  try{ localStorage.setItem('gh-finger', GH.finger?'1':'0'); }catch(e){}
  ghApplyFinger();
  toast(GH.finger ? 'Finger writing on — the page will not scroll while you draw'
                  : 'Finger writing off — touch scrolls the page again', 2400);
};
/* layout changed (sidebar, fullscreen, rotate) — the canvas is sized in
   device pixels off the sheet's box, so it must be re-measured after the
   new layout settles, then repainted from the stroke list. */
let ghRzT=0;
window.ghResizeSoon=()=>{ clearTimeout(ghRzT); ghRzT=setTimeout(()=>{ ghResize(); }, 60); };
window.ghFull=(on)=>{
  const want = on===undefined ? !document.body.classList.contains('gh-full') : !!on;
  document.body.classList.toggle('gh-full', want);
  const el=document.documentElement;
  try{
    if(want && el.requestFullscreen) el.requestFullscreen().catch(()=>{});
    else if(!want && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  }catch(e){}
  const b=document.querySelector('.gh-full-btn'); if(b) b.classList.toggle('on', want);
  ghResizeSoon();
};
addEventListener('fullscreenchange',()=>{ if(!document.fullscreenElement) document.body.classList.remove('gh-full'); ghResizeSoon(); });
addEventListener('orientationchange',()=>ghResizeSoon());
addEventListener('keydown',e=>{
  if(e.target&&/input|select|textarea/i.test(e.target.tagName)) return;
  if(e.key==='f'||e.key==='F') ghFull();
  if(e.key==='Escape'&&document.body.classList.contains('gh-full')) ghFull(false);
});
function ghResize(){ const sh=$('gh-sheet'); if(!sh||!ghCv) return; const r=sh.getBoundingClientRect(),d=devicePixelRatio||1; ghCv.width=r.width*d; ghCv.height=r.height*d; ghCtx.setTransform(d,0,0,d,0,0); ghRedraw(); }
/* strokes anchor to the item cell they start in, so re-queueing keeps ink with its question */
function ghOwner(p){
  const sh=$('gh-sheet'); if(!sh) return null;
  const sr=sh.getBoundingClientRect();
  for(const el of sh.querySelectorAll('.gh-item')){
    const r=el.getBoundingClientRect(), x=r.left-sr.left, y=r.top-sr.top;
    if(p[0]>=x&&p[0]<=x+r.width&&p[1]>=y&&p[1]<=y+r.height) return {id:el.dataset.gid, x, y};
  }
  return null;
}
function ghAnchor(s){
  if(!s.own) return [0,0];
  const sh=$('gh-sheet'); if(!sh) return [s.ox||0, s.oy||0];
  const el=sh.querySelector('.gh-item[data-gid="'+(window.CSS&&CSS.escape?CSS.escape(s.own):s.own)+'"]');
  if(!el) return [s.ox||0, s.oy||0];
  const sr=sh.getBoundingClientRect(), r=el.getBoundingClientRect();
  return [r.left-sr.left, r.top-sr.top];
}
function ghRedraw(){ if(!ghCtx) return; ghCtx.clearRect(0,0,ghCv.width,ghCv.height); for(const s of GH.strokes){ s.d=0; ghPaint(s); } if(ghCur){ ghCur.d=0; ghPaint(ghCur); } }
let ghRaf=0;
/* draw only the coords added since the last frame — O(new points), not
   O(whole sheet). s.d marks how far this stroke has been committed to pixels. */
function ghPaintTail(s){
  if(!ghCtx) return;
  const p=s.p, a=ghAnchor(s), from=Math.max(0,(s.d||0)-2);
  if(p.length-from<4){ if(p.length>=4) ghStyle(s), ghSeg(p,a,from); s.d=p.length; return; }
  ghStyle(s); ghSeg(p,a,from); s.d=p.length;
}
function ghSeg(p,a,from){ ghCtx.beginPath(); ghCtx.moveTo(p[from]+a[0],p[from+1]+a[1]); for(let i=from+2;i<p.length;i+=2) ghCtx.lineTo(p[i]+a[0],p[i+1]+a[1]); ghCtx.stroke(); }
function ghStyle(s){ ghCtx.globalCompositeOperation=s.e?'destination-out':'source-over'; ghCtx.strokeStyle='#1a1a1a'; ghCtx.lineWidth=s.e?s.w*8:s.w; ghCtx.lineCap='round'; ghCtx.lineJoin='round'; }
function ghPaint(s){ ghCtx.globalCompositeOperation=s.e?'destination-out':'source-over'; ghCtx.strokeStyle='#1a1a1a'; ghCtx.lineWidth=s.e?s.w*8:s.w; ghCtx.lineCap='round'; ghCtx.lineJoin='round'; const a=ghAnchor(s); ghCtx.beginPath(); const p=s.p; ghCtx.moveTo(p[0]+a[0],p[1]+a[1]); for(let i=2;i<p.length;i+=2) ghCtx.lineTo(p[i]+a[0],p[i+1]+a[1]); ghCtx.stroke(); }
function ghPos(e){ const r=ghCv.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; }
window.ghTool=t=>{ GH.tool=t; $('gh-pen').classList.toggle('on',t==='pen'); $('gh-erase').classList.toggle('on',t==='erase'); };
window.ghWidth=()=>{ GH.wi=(GH.wi+1)%3; $('gh-width').textContent='Width: '+['S','M','L'][GH.wi]; };
window.ghUndo=()=>{ GH.strokes.pop(); ghRedraw(); };
window.ghClear=()=>{ GH.strokes=[]; ghRedraw(); };
window.ghToggle=()=>{ GH.ghost=!GH.ghost; $('gh-sheet').classList.toggle('ghost-on',GH.ghost); document.querySelectorAll('.gh-ghost').forEach(b=>b.classList.toggle('on',GH.ghost)); };
/* running tally per word: japanese_user_reviews (correct_count, wrong_count, last_rating, next_review) */
/* ladder: 1,2,4,8,16,30,60,120 days — ✓ step+1, △ step-1 (min 1), ✗ step 0 (retry same session) */
const SRS=[0,1,2,4,8,16,30,60,120];
/* half the interval, snapped to the nearest ladder step — ties go shorter,
   never longer than the un-halved step, never under 1 day */
function srsHalfStep(step){
  const want=SRS[step]/2; let best=1;
  for(let i=1;i<SRS.length;i++) if(Math.abs(SRS[i]-want)<Math.abs(SRS[best]-want)) best=i;
  return Math.min(best, Math.max(1, step));
}
function srsNext(prev, rating, slow){
  let step=prev.step==null?0:prev.step, lapses=prev.lapses||0, halved=false;
  if(rating>=5){ step=Math.min(step+1, SRS.length-1); if(slow){ step=srsHalfStep(step); halved=true; } }
  else if(rating>=3) step=Math.max(1, step-1);
  else { if(step>=4) lapses++; step=0; }
  if((prev.wrong_count||0)+(rating<3?1:0)>=5) step=Math.min(step,2);   // leech cap: max 4 days
  return {step, lapses, halved, days:SRS[step]||1};
}
async function jpUpdateReviews(log, url, key){
  const H={apikey:key, Authorization:'Bearer '+key, 'Content-Type':'application/json'};
  const list=log.map(r=>r.kanji);
  const inList='('+list.map(k=>'"'+String(k).replace(/"/g,'')+'"').join(',')+')';
  const q=await fetch(`${url}/rest/v1/japanese_user_reviews?kanji=in.${encodeURIComponent(inList)}&select=id,kanji,direction,correct_count,wrong_count,user_id,history,step,lapses,seconds`,{headers:H});
  const have=q.ok?await q.json():[];
  const byK={}; for(const r of have) byK[ghRK(r.kanji,r.direction||'read')]=r;
  const today=new Date(), iso=today.toISOString();
  const plan=[];
  const rows=log.map(l=>{
    const prev=byK[ghRK(l.kanji,l.direction)]||{};
    const slow=!!l.is_correct && (l.seconds||0) > ghSlowLimit(prev);
    const s=srsNext(prev, l.rating, slow);
    plan.push({kanji:l.kanji, direction:l.direction, seconds:l.seconds||0, days:Math.max(1,s.days), slow, halved:!!s.halved});
    const next=new Date(today.getTime()+Math.max(1,s.days)*864e5).toISOString().slice(0,10);
    const row={kanji:l.kanji, direction:l.direction, last_review:iso, next_review:next, last_rating:l.rating, updated_at:iso, step:s.step, lapses:s.lapses,
      seconds:Math.max(0, l.seconds|0),
      correct_count:(prev.correct_count||0)+(l.is_correct?1:0), wrong_count:(prev.wrong_count||0)+(l.is_correct?0:1),
      history:[...(Array.isArray(prev.history)?prev.history:[]), {d:l.test_date, r:l.rating, s:l.seconds||0, w:slow?1:0}].slice(-20)};
    /* user_id is text NOT NULL with no default — a new word 400s without it */
    row.user_id=prev.user_id||l.user_id||JP_USER_ID||ghWho();
    if(prev.id!=null) row.id=prev.id;
    return row;
  });
  const r=await fetch(`${url}/rest/v1/japanese_user_reviews`,{method:'POST',headers:{...H, Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  if(!r.ok){ const b=await r.json().catch(()=>({})); throw new Error(b.message||('HTTP '+r.status)); }
  return plan;
}
/* かな→kanji (written recall) also drives the 1–5 rating in japanese_user_markings:
   pass → first-two band (2 if unmarked), fail → last-three band (5 if unmarked) */
async function jpUpdateMarkings(items, url, key, who){
  const H={apikey:key, Authorization:'Bearer '+key, 'Content-Type':'application/json'};
  if(!items.length) return 0;
  const inList='('+items.map(i=>'"'+String(i.kanji).replace(/"/g,'')+'"').join(',')+')';
  const q=await fetch(`${url}/rest/v1/japanese_user_markings?kanji=in.${encodeURIComponent(inList)}&select=id,kanji,marking,user_id`,{headers:H});
  const have=q.ok?await q.json():[];
  const byK={}; for(const r of have) byK[r.kanji]=r;
  const iso=new Date().toISOString();
  const rows=items.map(it=>{
    const prev=byK[it.kanji]||{};
    const cur=parseInt(prev.marking);
    let mark;
    if(it.pass) mark = (cur>=1&&cur<=2) ? cur : 2;      // stay if already in first two, else 2
    else        mark = (cur>=3&&cur<=5) ? cur : 5;      // stay if already in last three, else 5
    const row={kanji:it.kanji, marking:mark, updated_at:iso, marked_at:iso};
    row.user_id=prev.user_id||who||JP_USER_ID||ghWho();
    if(prev.id!=null) row.id=prev.id;
    return row;
  });
  const r=await fetch(`${url}/rest/v1/japanese_user_markings`,{method:'POST',headers:{...H, Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
  if(!r.ok){ const b=await r.json().catch(()=>({})); throw new Error(b.message||('HTTP '+r.status)); }
  return rows.length;
}
window.ghSave=async()=>{
  const log_n=n=>n+' result'+(n===1?'':'s')+' marked';
  const rows=GH.items.filter(p=>GH.marks[p.id]).map(p=>{ const m=GH.marks[p.id];
    return {problem_id:p.id, topic_id:p.topic_id, correct:m===1, rating:m===1?5:m===2?3:1, notes:m===1?'Ghost check: matched the key.':m===2?'Ghost check: partly right — compare stroke/reading against the key.':'Ghost check: did not match the key.', graded_by:'ghost', graded_at:new Date().toISOString()}; });
  if(!rows.length){ toast('Mark at least one item first.'); return; }
  if(GH.locked) return;
  if(!DEMO&&!GH.ext){ const {error}=await sb.from('written_test_attempts').insert(rows); if(error){ toast('Save failed: '+error.message,6000); return; } }
  if(!GH.ext) ATTEMPTS=rows.concat(ATTEMPTS);
  let extra='', plan=null;
  const c=ghCfg();
  const logTable=(GH_PANEL&&$('jp-log')?$('jp-log').value.trim():c.log);
  const jpKeyNow=(typeof JP!=='undefined'&&JP.key)||c.key;
  const jpUrlNow=(typeof JP!=='undefined'&&JP.url)||c.url;
  if(GH.ext&&!DEMO&&jpUrlNow&&jpKeyNow){
    const today=new Date().toISOString().slice(0,10);
    const log=GH.items.filter(p=>GH.marks[p.id]).map(p=>{ const m=GH.marks[p.id];
      return {user_id:c.user||ghWho(), kanji:p.kanji||p.prompt, direction:ghDirOf(p), test_type:c.type||'ghost', test_date:today, is_correct:m===1, rating:m===1?5:m===2?3:1, seconds:ghSeconds(p.id)}; })
      .reduce((acc,r)=>{ const i=acc.findIndex(x=>x.kanji===r.kanji&&x.direction===r.direction);
        if(i<0){ acc.push(r); return acc; }
        const s=Math.max(acc[i].seconds||0, r.seconds||0);
        if(r.rating<acc[i].rating) acc[i]=r;                 // worst mark wins
        acc[i].seconds=s;                                    // longest time wins
        return acc; },[]);
    try{
      plan=await jpUpdateReviews(log, jpUrlNow, jpKeyNow);
      extra=' · japanese_user_reviews updated';
      const halved=(plan||[]).filter(x=>x.halved);
      if(halved.length) extra+=' · '+halved.length+' slow ✓ at half interval ('+halved.map(x=>x.days+'d').join(', ')+')';
      const writes=GH.items.filter(p=>p.rev&&GH.marks[p.id]).reduce((acc,p)=>{
        const k=p.kanji||p.answer, pass=GH.marks[p.id]===1, i=acc.findIndex(x=>x.kanji===k);
        if(i<0) acc.push({kanji:k, pass}); else acc[i].pass=acc[i].pass&&pass;
        return acc; },[]);
      if(writes.length){
        try{ const n=await jpUpdateMarkings(writes, jpUrlNow, jpKeyNow, c.user||ghWho()); extra+=' · '+n+' かな→漢字 rating'+(n===1?'':'s'); }
        catch(e){ extra+=' (rating write failed: '+(e.message||e)+')'; }
      }
      if(logTable){
        try{
          const bare=log.map(({seconds, ...r})=>r);   // log tables have no seconds column
          const r=await fetch(`${jpUrlNow}/rest/v1/${encodeURIComponent(logTable)}`,{method:'POST',headers:{apikey:jpKeyNow,Authorization:'Bearer '+jpKeyNow,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(bare)});
          if(r.ok) extra+=' + '+logTable;
        }catch(e){}
      }
    }catch(e){
      extra=' · reviews upsert failed ('+(e.message||e)+')';
      try{
        const r=await fetch(`${jpUrlNow}/rest/v1/japanese_daily_test_log`,{method:'POST',headers:{apikey:jpKeyNow,Authorization:'Bearer '+jpKeyNow,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(log.map(({seconds, ...r})=>r))});
        extra += r.ok ? ' — saved to japanese_daily_test_log instead. Run sql/reviews_direction.sql.'
                      : ' — NOT SAVED. Run sql/reviews_direction.sql.';
      }catch(e2){ extra+=' — NOT SAVED.'; }
    }
  } else if(GH.ext&&!DEMO){ extra=' · Japanese save skipped: add the anon key (JP_ANON_KEY in ghost_test.js)'; }
  toast((GH.ext?log_n(rows.length):rows.length+' result'+(rows.length===1?'':'s')+' saved')+extra, 5200);
  const end=ghEnding(plan);
  if(!end){ ghExit(); return; }
  GH.locked=true; $('gh-sheet').classList.add('locked'); ghDrawer(true);
  ghShowEnding(end);
};
/* Exit: the sheet is done — wipe marks, ink and clocks and start a fresh one. */
window.ghExit=()=>{ GH.locked=false; GH.marks={}; GH.strokes=[]; GH.time={}; GH.focus=null; renderGhost(); };

/* ---- Phase 3: endings — drawn on the paper, the way a teacher would ------
   Scored per word (worst mark wins, so a ✗ that came back 5 later still
   counts as ✗). Full marks on a fully marked sheet → a red flower swung
   across the whole answer area, a fresh shape every time. One or two short
   → a quick tick beside 得点. Anything less → the score circled and each wrong
   word dated in its cell (再 Sep 7). The rail shows the result and Exit; the
   sheet is locked until Exit. Partial saves with nothing wrong just reset. */
const GH_PEN='#a8281f';
function ghEnding(plan){
  const words=[];
  for(const p of GH.items){
    const k=ghKeyOf(p), m=GH.marks[p.id]||0, i=words.findIndex(w=>w.k===k&&w.rev===!!p.rev);
    if(i<0) words.push({k, m, ans:p.answer, rev:!!p.rev});
    else if(m>words[i].m) words[i].m=m;
  }
  const n=words.length, all=words.every(w=>w.m), right=words.filter(w=>w.m===1).length;
  const wrong=words.filter(w=>w.m>=2);
  if(all&&right===n) return {kind:'flower', n, right};
  const by={}; for(const x of (plan||[])) by[ghRK(x.kanji,x.direction||'read')]=x;
  const fmt=d=>d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  const list=wrong.map(w=>{ const x=by[ghRK(w.k,w.rev?'write':'read')]; const d=x?new Date(Date.now()+x.days*864e5):null;
    return {k:w.k, ans:w.ans, m:w.m, rev:w.rev, when:d?fmt(d):'—', days:x?x.days:null}; });
  if(all&&n-right<=2) return {kind:'check', n, right, wrong:list};
  if(!wrong.length) return null;
  return {kind:'list', n, right, wrong:list};
}
/* pen marks placed in the sheet's own pixel space, anchored to an element */
function ghPlaceMark(html, anchor, dx, dy){
  const sh=$('gh-sheet'), a=anchor.getBoundingClientRect(), r=sh.getBoundingClientRect();
  const t=document.createElement('div'); t.innerHTML=html; const el=t.firstChild; sh.appendChild(el);
  const w=el.getBoundingClientRect().width, h=el.getBoundingClientRect().height;
  el.style.left=Math.max(6,Math.min(a.left-r.left+dx, r.width-w-6))+'px';
  el.style.top=Math.max(6,Math.min(a.top-r.top+dy, r.height-h-6))+'px';
  el.dataset.end=1; return el;
}
/* the flower: 5 or 6 petals on jittered spokes, each confined to its own
   angular wedge (half the gap to its neighbour) so none cross; every tip
   reaches the edge of the answer area; rounded tips; even 3px pen line. */
function ghFlower(){
  const sh=$('gh-sheet'), r=sh.getBoundingClientRect(), g=sh.querySelector('.gh-grid').getBoundingClientRect();
  const pad=parseFloat(getComputedStyle(sh).paddingLeft)||26;
  const top=g.top-r.top-14, W=r.width-pad*2, H=r.height-top-pad;
  const cx=W/2, cy=H/2, hw=cx-5, hh=cy-5, rnd=(a,b)=>a+Math.random()*(b-a);
  const n=Math.random()<.45?6:5, spin=rnd(0,72);
  const ang=Array.from({length:n},(_,i)=>spin+i*360/n+rnd(-13,13)).sort((a,b)=>a-b);
  const reach=deg=>{ const t=deg*Math.PI/180, dx=Math.abs(Math.sin(t)), dy=Math.abs(Math.cos(t)); return Math.min(dx>1e-4?hw/dx:1e9, dy>1e-4?hh/dy:1e9); };
  const petals=ang.map((a,i)=>{
    const prev=ang[(i-1+n)%n]-(i===0?360:0), next=ang[(i+1)%n]+(i===n-1?360:0);
    const phi=Math.min(a-prev, next-a)/2*.88*Math.PI/180, pd=phi*180/Math.PI*.8;
    const R=Math.min(reach(a), reach(a-pd), reach(a+pd))*rnd(.88,1), tan=Math.tan(phi*.86);
    const d1=R*rnd(.42,.5), l1=d1*tan*.97, l2=R*tan*rnd(.36,.5), f=x=>x.toFixed(1);
    return `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a)})"><path d="M0 0 C ${f(-l1)} ${f(-d1)}, ${f(-l2)} ${f(-R)}, 0 ${f(-R)} C ${f(l2)} ${f(-R)}, ${f(l1)} ${f(-d1)}, 0 0 Z" style="animation-delay:${(.15+i*.24).toFixed(2)}s"></path></g>`;
  }).join('');
  const t=document.createElement('div');
  t.innerHTML=`<svg class="gh-pen gh-flower" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g class="gh-bloom">${petals}</g></svg>`;
  const el=t.firstChild; el.style.left=pad+'px'; el.style.top=top+'px'; el.dataset.end=1; sh.appendChild(el);
  el.querySelectorAll('path').forEach(p=>{ const L=p.getTotalLength(); p.style.strokeDasharray=L; p.style.strokeDashoffset=L; });
}
const GH_TICK_SVG=`<svg class="gh-pen gh-tick" viewBox="0 0 70 60"><path pathLength="100" d="M8 34 C16 38,22 46,26 52 C34 30,46 16,64 6"></path></svg>`;
const GH_CIRC_SVG=`<svg class="gh-pen gh-circ" viewBox="0 0 120 70"><path pathLength="100" d="M62 12 C30 8,10 22,12 38 C14 56,44 64,74 60 C104 56,114 40,106 26 C98 12,74 8,56 12"></path></svg>`;
function ghAnnotate(wrong){
  const by={}; for(const w of wrong) by[ghRK(w.k,w.rev?'write':'read')]=w;
  let i=0;
  for(const p of GH.items){ const w=by[ghRK(ghKeyOf(p),ghDirOf(p))]; if(!w||(GH.marks[p.id]||0)<2) continue;
    const cell=document.querySelector('.gh-item[data-gid="'+String(p.id).replace(/"/g,'\\"')+'"]'); if(!cell) continue;
    const s=document.createElement('span'); s.className='gh-rv'; s.textContent='再 '+w.when; s.dataset.end=1; cell.appendChild(s);
    setTimeout(()=>s.classList.add('on'), 200+(i++)*120); }
}
function ghShowEnding(end){
  ghEndClose();
  if(!end) return;
  const sc=$('gh-score'), card=$('gh-endcard'); if(!sc||!card) return;
  const G=['','✓','△','✗'];
  if(end.kind==='flower'){
    ghFlower();
    card.innerHTML=`<div class="gh-end-lb">Full marks</div><div class="gh-end-big">${end.right} / ${end.n}</div><div class="gh-end-tx">Every word right. Nothing comes back early.</div><button class="btn sm gh-end-exit" onclick="ghExit()">Exit test</button>`;
  } else if(end.kind==='check'){
    ghPlaceMark(GH_TICK_SVG, sc, -6, -30);
    if(end.wrong) ghAnnotate(end.wrong);
    card.innerHTML=`<div class="gh-end-lb">Saved</div><div class="gh-end-big">${end.right} / ${end.n}</div><div class="gh-end-tx">${end.n-end.right} to review — dates are on the sheet.</div><button class="btn sm gh-end-exit" onclick="ghExit()">Exit test</button>`;
  } else {
    ghPlaceMark(GH_CIRC_SVG, sc, -30, -24);
    ghAnnotate(end.wrong);
    const rows=end.wrong.map(w=>`<li><span class="gh-end-m m${w.m}">${G[w.m]}</span><span class="gh-end-w">${esc(w.k)} <small class="gh-end-dir">${w.rev?'書':'読'}</small></span><span class="gh-end-d">${esc(w.when)}</span></li>`).join('');
    card.innerHTML=`<div class="gh-end-lb">${end.wrong.length} to review</div><div class="gh-end-big">${end.right} / ${end.n}</div><ul class="gh-end-ul">${rows}</ul><button class="btn sm gh-end-exit" onclick="ghExit()">Exit test</button>`;
  }
  card.classList.add('on');
}
window.ghEndClose=()=>{ document.querySelectorAll('[data-end]').forEach(x=>x.remove()); const c=$('gh-endcard'); if(c){ c.innerHTML=''; c.classList.remove('on'); } };
window.ghShowEnding=ghShowEnding; window.ghEnding=ghEnding;
/* the wide layout is only for this view — drop it when the route changes */
addEventListener('hashchange',()=>{ if(!/ghost/.test(location.hash)) document.body.classList.remove('gh-view'); });
