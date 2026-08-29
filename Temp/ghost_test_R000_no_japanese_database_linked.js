/* Ghost test — on-screen handwritten sheet with answer overlay. Depends on globals from learning_hub.js */
let GH={topic:null, marks:{}, strokes:[], tool:'pen', wi:1, ghost:false, items:[]};
const GH_W=[1.6,2.6,4.2];

const GH_LANG=/lang|japan|kanji|kana|vocab|word/i;
function ghostTopics(){
  const langSubs=new Set(SUBJECTS.filter(s=>GH_LANG.test(s.name)).map(s=>s.id));
  return TOPICS.filter(t=>(langSubs.has(t.subject_id)||GH_LANG.test(t.name))&&PROBLEMS.some(p=>p.topic_id===t.id&&p.answer));
}
function renderGhost(){
  const tops=ghostTopics();
  if(!tops.length){ $('main').innerHTML=`<div class="kicker">Ghost test</div><h1 style="margin:4px 0 6px">Write on screen</h1>
    <div class="card" style="max-width:640px"><p style="margin:0 0 10px">Ghost test is for <b>language study</b> — word ⇄ reading pairs you write by hand.</p>
    <p style="color:var(--mute);margin:0 0 14px;font-size:13.5px">Nothing to load yet: you need a language topic whose problems have an <b>Answer</b> filled in (the answer becomes the red ghost key). Maths topics are excluded on purpose.</p>
    <button class="btn sm" onclick="ghSeed()">Create “Kanji · Certi/Diploma” with 20 items</button>
    <button class="btn sm ghost" onclick="ghImportPanel()">Import from my japanese_ database</button></div>${ghPanelHtml()}`; return; }
  if(!GH.topic||!tops.some(t=>t.id===GH.topic)){ GH.topic=tops[0].id; GH.marks={}; GH.strokes=[]; }
  const t=TOPICS.find(x=>x.id===GH.topic);
  GH.items=PROBLEMS.filter(p=>p.topic_id===GH.topic&&p.answer).sort((a,b)=>(a.unit_no||a.number)-(b.unit_no||b.number)).slice(0,20);
  const pills=tops.map(x=>`<button class="pill-t ${GH.topic===x.id?'on':''}" onclick="ghPick('${esc(x.id)}')">${esc(x.name)}</button>`).join('');
  const cells=GH.items.map((p,i)=>{
    const m=GH.marks[p.id]||0;
    return `<div class="gh-item"><span class="gh-n" onpointerup="ghMark(event,'${esc(p.id)}')">${i+1}.</span> <span class="gh-w">${esc(p.prompt||p.subtitle)}</span><span class="gh-mk ${['','ok','mid','bad'][m]}">${['','✓','△','✗'][m]}</span><span class="gh-g">${esc(p.answer)}</span></div>`;
  }).join('');
  $('main').innerHTML=`<div class="kicker">Ghost test</div><h1 style="margin:4px 0 6px">Write on screen</h1>
    <p style="color:var(--mute);margin:0 0 14px">Write each answer with Apple Pencil, toggle <b>Ghost</b> to reveal the key, then tap each number to mark ✓ → △ → ✗. Saving records attempts so weak items resurface in your next batch.</p>
    <div class="pillbar" style="margin-bottom:14px">${pills}<button class="pill-t" onclick="ghImportPanel()">＋ Import from japanese_ db</button></div>
    ${ghPanelHtml()}
    <div class="gh-bar">
      <button class="btn sm ghost gh-t on" id="gh-pen" onclick="ghTool('pen')">✎ Pen</button>
      <button class="btn sm ghost gh-t" id="gh-erase" onclick="ghTool('erase')">◌ Eraser</button>
      <button class="btn sm ghost gh-t" id="gh-width" onclick="ghWidth()">Width: M</button>
      <button class="btn sm ghost gh-t" onclick="ghUndo()">↶ Undo</button>
      <button class="btn sm ghost gh-t" onclick="ghClear()">Clear ink</button>
      <button class="btn sm gh-t gh-ghost ${GH.ghost?'on':''}" id="gh-ghost" onclick="ghToggle()">Ghost</button>
      <button class="btn sm" style="margin-left:auto" onclick="ghSave()">Save results</button>
    </div>
    <div class="gh-sheet ${GH.ghost?'ghost-on':''}" id="gh-sheet">
      <div class="gh-hd"><h2>${esc(t.name)}</h2><span class="s">|</span><span class="tt">Ghost test</span><span class="nm">名前 <u></u></span><span class="sc">得点 <b id="gh-score">___</b> / ${GH.items.length}</span></div>
      <p class="gh-inst">Write your answer under each item · ghost overlay shows the key in red</p>
      <div class="gh-grid">${cells}</div>
      <canvas id="gh-ink"></canvas>
    </div>`;
  ghInit();
}
/* ---- import from a second Supabase project (japanese_* tables) ---- */
let GH_PANEL=false, GH_PREVIEW=null;
const ghCfg=()=>{ try{ return JSON.parse(localStorage.getItem('wt_jp_source')||'{}'); }catch(e){ return {}; } };
const ghCfgSet=o=>localStorage.setItem('wt_jp_source', JSON.stringify(o));
window.ghImportPanel=()=>{ GH_PANEL=!GH_PANEL; GH_PREVIEW=null; renderGhost(); };
window.ghCfgField=(k,v)=>{ const c=ghCfg(); c[k]=v.trim(); ghCfgSet(c); };
function ghPanelHtml(){
  if(!GH_PANEL) return '';
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
      <div><label>Table</label><input id="jp-table" placeholder="japanese_words" value="${esc(c.table||'japanese_words')}"></div>
      <div><label>Word column</label><input id="jp-q" placeholder="kanji" value="${esc(c.q||'')}" style="width:130px"></div>
      <div><label>Reading column</label><input id="jp-a" placeholder="hiragana" value="${esc(c.a||'')}" style="width:150px"></div>
      <div><label>Limit</label><input id="jp-n" type="number" min="1" max="200" value="${c.n||20}" style="width:80px"></div>
      <button class="btn sm ghost" onclick="ghImportFetch()">Fetch preview</button>
    </div>
    <p style="color:var(--mute);font-size:12.5px;margin:10px 0 0">Leave the column names blank to let the app guess them from the first row.</p>
    <div class="formrow">
      <div><label>Write results back to</label><input id="jp-log" oninput="ghCfgField('log',this.value)" placeholder="japanese_daily_test_log" value="${esc(c.log==null?'japanese_daily_test_log':c.log)}" style="width:230px"></div>
      <div><label>user_id to stamp</label><input id="jp-user" oninput="ghCfgField('user',this.value)" placeholder="your id or email" value="${esc(c.user||'')}" style="width:200px"></div>
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
  GH.topic=topic.id; GH.marks={}; GH.strokes=[]; renderGhost();
};
window.ghPick=id=>{ GH.topic=id; GH.marks={}; GH.strokes=[]; renderGhost(); };
window.ghMark=(e,id)=>{ e.stopPropagation(); GH.marks[id]=((GH.marks[id]||0)+1)%4; const el=e.target.parentElement.querySelector('.gh-mk'); const m=GH.marks[id]; el.textContent=['','✓','△','✗'][m]; el.className='gh-mk '+['','ok','mid','bad'][m]; ghScore(); };
function ghScore(){ let s=0,any=false; for(const p of GH.items){ const m=GH.marks[p.id]||0; if(m){any=true; s+=m===1?1:m===2?.5:0;} } $('gh-score').textContent=any?(s%1?s.toFixed(1):s):'___'; }

/* ---- ink ---- */
let ghCtx,ghCv,ghCur=null;
function ghInit(){
  ghCv=$('gh-ink'); if(!ghCv) return; ghCtx=ghCv.getContext('2d');
  ghResize();
  ghCv.onpointerdown=e=>{ if(e.pointerType==='touch') return; ghCv.setPointerCapture(e.pointerId); ghCur={w:GH_W[GH.wi],e:GH.tool==='erase',p:ghPos(e)}; };
  ghCv.onpointermove=e=>{ if(!ghCur) return; const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e]; for(const ev of evs) ghCur.p.push(...ghPos(ev)); ghRedraw(); ghPaint(ghCur); };
  ghCv.onpointerup=ghCv.onpointercancel=()=>{ if(!ghCur) return; if(ghCur.p.length>=4) GH.strokes.push(ghCur); ghCur=null; ghRedraw(); };
  addEventListener('resize',ghResize);
}
function ghResize(){ const sh=$('gh-sheet'); if(!sh||!ghCv) return; const r=sh.getBoundingClientRect(),d=devicePixelRatio||1; ghCv.width=r.width*d; ghCv.height=r.height*d; ghCtx.setTransform(d,0,0,d,0,0); ghRedraw(); }
function ghRedraw(){ if(!ghCtx) return; ghCtx.clearRect(0,0,ghCv.width,ghCv.height); for(const s of GH.strokes) ghPaint(s); }
function ghPaint(s){ ghCtx.globalCompositeOperation=s.e?'destination-out':'source-over'; ghCtx.strokeStyle='#1a1a1a'; ghCtx.lineWidth=s.e?s.w*8:s.w; ghCtx.lineCap='round'; ghCtx.lineJoin='round'; ghCtx.beginPath(); const p=s.p; ghCtx.moveTo(p[0],p[1]); for(let i=2;i<p.length;i+=2) ghCtx.lineTo(p[i],p[i+1]); ghCtx.stroke(); }
function ghPos(e){ const r=ghCv.getBoundingClientRect(); return [e.clientX-r.left, e.clientY-r.top]; }
window.ghTool=t=>{ GH.tool=t; $('gh-pen').classList.toggle('on',t==='pen'); $('gh-erase').classList.toggle('on',t==='erase'); };
window.ghWidth=()=>{ GH.wi=(GH.wi+1)%3; $('gh-width').textContent='Width: '+['S','M','L'][GH.wi]; };
window.ghUndo=()=>{ GH.strokes.pop(); ghRedraw(); };
window.ghClear=()=>{ GH.strokes=[]; ghRedraw(); };
window.ghToggle=()=>{ GH.ghost=!GH.ghost; $('gh-sheet').classList.toggle('ghost-on',GH.ghost); $('gh-ghost').classList.toggle('on',GH.ghost); };
window.ghSave=async()=>{
  const rows=GH.items.filter(p=>GH.marks[p.id]).map(p=>{ const m=GH.marks[p.id];
    return {problem_id:p.id, topic_id:p.topic_id, correct:m===1, rating:m===1?5:m===2?3:1, notes:m===1?'Ghost check: matched the key.':m===2?'Ghost check: partly right — compare stroke/reading against the key.':'Ghost check: did not match the key.', graded_by:'ghost', graded_at:new Date().toISOString()}; });
  if(!rows.length){ toast('Mark at least one item first.'); return; }
  if(!DEMO){ const {error}=await sb.from('written_test_attempts').insert(rows); if(error){ toast('Save failed: '+error.message,6000); return; } }
  ATTEMPTS=rows.concat(ATTEMPTS);
  let extra='';
  const c=ghCfg();
  const logTable=(GH_PANEL&&$('jp-log')?$('jp-log').value.trim():c.log);
  if(logTable&&c.url&&c.key){
    const today=new Date().toISOString().slice(0,10);
    const log=GH.items.filter(p=>GH.marks[p.id]).map(p=>{ const m=GH.marks[p.id];
      return {user_id:c.user||(SESSION&&SESSION.user?SESSION.user.email:'ghost'), kanji:p.prompt, test_type:c.type||'ghost', test_date:today, is_correct:m===1, rating:m===1?5:m===2?3:1}; });
    try{
      const r=await fetch(`${c.url}/rest/v1/${encodeURIComponent(logTable)}`,{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(log)});
      if(!r.ok){ const b=await r.json().catch(()=>({})); throw new Error(b.message||('HTTP '+r.status)); }
      extra=' · also logged to '+logTable;
    }catch(e){ extra=' · Japanese log failed: '+(e.message||e); }
  } else if(logTable){ extra=' · Japanese log skipped: add the project URL and anon key in the import panel'; }
  toast(rows.length+' result'+(rows.length===1?'':'s')+' saved'+extra+' — weak items move up your next batch.', 5200);
  GH.marks={}; GH.strokes=[]; renderGhost();
};
