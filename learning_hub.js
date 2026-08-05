/* Learning Hub · Written Test — app logic (plain JS, no build step) */
const SUPABASE_URL = "https://wylxvmkcrexwfpjpbhyy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bHh2bWtjcmV4d2ZwanBiaHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MzkxMDYsImV4cCI6MjA4NDIxNTEwNn0.6Bxo42hx4jwlJGWnfjiTpiDUsYfc1QLTN3YtrU1efak";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DAY = 864e5;
const TIER_LABEL = {warmup:'warm-up', core:'core', challenge:'challenge'};
const INTERVALS = {1:1, 2:1, 3:3, 4:7, 5:14}; // rating -> days until due

let SESSION=null, DEMO=false, SUBJECTS=[], TOPICS=[], PROBLEMS=[], ATTEMPTS=[], BATCHES=[], DIR=null;
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const ACCENTS=['#b5532a','#c9a227','#2c5e8f','#a4302c','#8f2c5e','#23694e','#5e2c8f','#2c8f7a'];
let buildSel = {subject:'all', topic:'smart', tiers:new Set(['warmup','core','challenge']), kinds:new Set(['drill','concept','applied']), count:5};
let OPEN_SUBS=null;

/* ---------- tiny IndexedDB for the folder handle ---------- */
const idb = {
  db(){ return new Promise((res,rej)=>{ const r=indexedDB.open('wt-hub',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  async get(k){ const d=await this.db(); return new Promise((res,rej)=>{ const t=d.transaction('kv').objectStore('kv').get(k); t.onsuccess=()=>res(t.result); t.onerror=()=>rej(t.error); }); },
  async set(k,v){ const d=await this.db(); return new Promise((res,rej)=>{ const t=d.transaction('kv','readwrite').objectStore('kv').put(v,k); t.onsuccess=()=>res(); t.onerror=()=>rej(t.error); }); }
};

function toast(msg, ms=3200){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'), ms); }

/* ---------- auth ---------- */
$('send-link').addEventListener('click', async ()=>{
  const email=$('email').value.trim(), m=$('gate-msg');
  if(!email){ m.className='msg err'; m.textContent='Enter your email first.'; return; }
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href.split('#')[0]}});
  m.className=error?'msg err':'msg ok';
  m.textContent=error?error.message:'Check your inbox for the magic link, then return here.';
});
$('email').addEventListener('keydown', e=>{ if(e.key==='Enter') $('send-link').click(); });
$('signout').addEventListener('click', async e=>{ e.preventDefault(); if(!DEMO) await sb.auth.signOut(); location.href=location.pathname; });
$('demo-btn').addEventListener('click', ()=>{ DEMO=true; startDemo(); });
sb.auth.onAuthStateChange((_e,s)=>{ if(s && !SESSION && !DEMO){ SESSION=s; boot(); } });
sb.auth.getSession().then(({data})=>{ if(data.session && !DEMO){ SESSION=data.session; boot(); } });

/* ---------- data ---------- */
async function boot(){
  $('gate').classList.add('hide'); $('app').classList.remove('hide');
  $('who').textContent = DEMO ? 'demo mode — nothing is saved' : (SESSION.user.email||SESSION.user.id);
  if(!DEMO){
    const [t,p,a,b,s] = await Promise.all([
      sb.from('written_test_topics').select('*').order('branch_no'),
      sb.from('written_test_problems').select('*').order('number'),
      sb.from('written_test_attempts').select('*').order('graded_at',{ascending:false}),
      sb.from('written_test_batches').select('*').order('created_at',{ascending:false}),
      sb.from('written_test_subjects').select('*').order('sort_no')
    ]);
    for(const r of [t,p,a]) if(r.error){ toast('Load failed: '+r.error.message, 6000); return; }
    TOPICS=t.data||[]; PROBLEMS=p.data||[]; ATTEMPTS=a.data||[];
    BATCHES=b.error?[]:(b.data||[]); // tables may not exist until schema.sql is run
    SUBJECTS=s.error?[{id:'maths',sort_no:1,name:'Maths'}]:(s.data||[]);
    if(b.error||s.error) toast('Run schema.sql to enable subjects & batch tracking.', 5000);
  }
  await restoreDir();
  route();
}
function startDemo(){
  SUBJECTS=[{id:'maths',sort_no:1,name:'Maths',tagline:'Aptitude to ANOVA'},{id:'language_study',sort_no:2,name:'Language study',tagline:'Japanese · Kanji'},{id:'mechanical',sort_no:3,name:'Mechanical',tagline:'Engineering core'}];
  TOPICS=[['aptitude',1,'Aptitude','Speed, percentage, ratio and number sense.','#b5532a'],['algebra_trig',2,'Algebra & Trigonometry','Quadratics, progressions, trigonometry.','#c9a227'],['calculus',3,'Calculus','Limits, derivatives and integrals.','#2c5e8f'],['linear_algebra',4,'Linear Algebra','Systems, determinants, eigenvalues.','#a4302c'],['probability',5,'Probability, Vectors & Complex','Chance, vectors, the complex plane.','#8f2c5e'],['anova',6,'Statistics · ANOVA','Comparing several means.','#23694e']].map(x=>({id:x[0],branch_no:x[1],name:x[2],tagline:x[3],accent:x[4],subject_id:'maths'}));
  TOPICS.push({id:'kanji_n5',branch_no:1,name:'Kanji · JLPT N5',tagline:'Reading and writing the first 80 kanji.',accent:'#8f2c5e',subject_id:'language_study'});
  const subs={aptitude:['Average speed','Successive percentages','Ratio & proportion','Permutations & combinations','HCF & LCM'],algebra_trig:['Quadratic (factor)','Quadratic formula','Arithmetic progression','Trig equation','Trig identity'],calculus:['Power rule','Product rule','Chain rule','Definite integral','Optimization'],linear_algebra:['2x2 system','Determinant & inverse','Eigenvalues','Matrix multiplication','Gaussian elimination'],probability:['Probability (cards)','Dot product & angle','Cross product','Complex numbers','Bayes theorem'],anova:['One-way ANOVA','One-way ANOVA','One-way ANOVA','Two-way ANOVA','Repeated measures']};
  subs.kanji_n5=['Readings: 日・月・火','Stroke order: 水・木','Vocabulary: numbers','Sentence reading','Writing from English'];
  PROBLEMS=[]; for(const t of TOPICS) subs[t.id].forEach((s,i)=>PROBLEMS.push({id:`${t.id}-${i+1}`,topic_id:t.id,number:i+1,unit_no:i+1,subtitle:s,prompt:`Sample prompt for “${s}” — sign in to load your real problem bank.`,given_data:'sample given data',tier:i===0?'warmup':i===4?'challenge':'core',kind:i<2?'drill':i<4?'concept':'applied'}));
  const now=Date.now();
  ATTEMPTS=[
    {problem_id:'calculus-3',topic_id:'calculus',correct:false,rating:2,notes:'Chain rule inner derivative missed — you differentiated (3x+1)⁴ but forgot ×3. Redo with u-substitution written out.',graded_by:'cowork',graded_at:new Date(now-2*DAY).toISOString()},
    {problem_id:'calculus-1',topic_id:'calculus',correct:true,rating:5,notes:'Clean. Power rule automatic now.',graded_by:'cowork',graded_at:new Date(now-2*DAY).toISOString()},
    {problem_id:'aptitude-1',topic_id:'aptitude',correct:true,rating:4,notes:'Right method (total d / total t). Arithmetic slip corrected mid-way — fine.',graded_by:'cowork',graded_at:new Date(now-9*DAY).toISOString()},
    {problem_id:'aptitude-2',topic_id:'aptitude',correct:true,rating:3,notes:'Got −4% but the reasoning line was thin. Write the multiplier form (1.2×0.8).',graded_by:'cowork',graded_at:new Date(now-5*DAY).toISOString()},
    {problem_id:'linear_algebra-1',topic_id:'linear_algebra',correct:false,rating:2,notes:'Sign error eliminating y. Check by substituting back — you skipped the check.',graded_by:'cowork',graded_at:new Date(now-1*DAY).toISOString()}
  ];
  BATCHES=[{id:'demo-1',topic_id:'calculus',problem_ids:['calculus-1','calculus-2','calculus-3'],filename:'WT_calculus_20260801_0930.pdf',status:'graded',created_at:new Date(now-4*DAY).toISOString()},{id:'demo-2',topic_id:'linear_algebra',problem_ids:['linear_algebra-1','linear_algebra-2'],filename:'WT_linear_algebra_20260803_1815.pdf',status:'solved',created_at:new Date(now-1*DAY).toISOString()}];
  boot();
}

/* ---------- derivations ---------- */
function latestByProblem(){
  const m={};
  for(const a of ATTEMPTS){ const k=a.problem_id; if(!m[k]||new Date(a.graded_at)>new Date(m[k].graded_at)) m[k]=a; }
  return m;
}
function pstatus(p, latest){
  const a=latest[p.id];
  if(!a) return {code:'new', label:'new', due:null};
  const weak = a.correct===false || (a.rating!=null && a.rating<=2);
  const days = INTERVALS[a.rating||3]||3;
  const due = new Date(new Date(a.graded_at).getTime() + days*DAY);
  if(weak) return {code:'weak', label:'weak', due, a};
  if(due<=new Date()) return {code:'due', label:'due for review', due, a};
  return {code:'ok', label:'scheduled '+due.toLocaleDateString(undefined,{month:'short',day:'numeric'}), due, a};
}
function topicStats(tid){
  const latest=latestByProblem();
  const probs=PROBLEMS.filter(p=>p.topic_id===tid);
  let attempted=0, correct=0, weak=0, due=0;
  for(const p of probs){ const s=pstatus(p, latest); if(s.a){attempted++; if(s.a.correct)correct++;} if(s.code==='weak')weak++; if(s.code==='due')due++; }
  return {total:probs.length, attempted, correct, weak, due};
}
function queue(topicId, subjectId, tiers, kinds, n){
  const latest=latestByProblem();
  const subOf=tid=>{ const t=TOPICS.find(x=>x.id===tid); return t?(t.subject_id||(SUBJECTS[0]||{}).id):null; };
  let pool=PROBLEMS.filter(p=>(topicId!=='smart' ? p.topic_id===topicId : (subjectId==='all'||subOf(p.topic_id)===subjectId)) && tiers.has(p.tier||'core') && kinds.has(p.kind||'drill'));
  const scored=pool.map(p=>{
    const s=pstatus(p, latest);
    let rank, why;
    if(s.code==='weak'){ rank=0; why='weak'; }
    else if(s.code==='due'){ rank=1; why='due'; }
    else if(s.code==='new'){ rank=2; why='new'; }
    else { rank=3; why='review'; }
    return {p, s, rank, why, tie:(s.due?s.due.getTime():0)+(p.unit_no||p.number||0)/100};
  });
  scored.sort((a,b)=>a.rank-b.rank || a.tie-b.tie);
  return scored.slice(0,n);
}

/* ---------- routing ---------- */
window.addEventListener('hashchange', route);
function route(){
  if(!TOPICS.length) return;
  const h=(location.hash||'#library').slice(1);
  const [page,arg]=h.split('/');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active', el.dataset.nav===(page==='topic'?'library':page)));
  const latest=latestByProblem();
  let dueN=0; for(const p of PROBLEMS){ const c=pstatus(p,latest).code; if(c==='weak'||c==='due') dueN++; }
  $('cnt-lib').textContent=PROBLEMS.length; $('cnt-due').textContent=dueN||''; $('cnt-fb').textContent=ATTEMPTS.length||''; $('cnt-setup').textContent=DIR?'✓':'!';
  if(page==='topic') renderTopic(arg);
  else if(page==='build') renderBuild();
  else if(page==='review') renderReview();
  else if(page==='setup') renderSetup();
  else renderLibrary();
}

/* ---------- screens ---------- */
function topicCard(t){
    const st=topicStats(t.id);
    const pct=st.total?Math.round(100*st.attempted/st.total):0;
    const flags=[st.weak?`<span class="chip weak">${st.weak} weak</span>`:'', st.due?`<span class="chip due">${st.due} due</span>`:''].join('');
    return `<div class="card topic-card" style="padding:14px 16px" onclick="location.hash='topic/${t.id}'">
      <div class="bar" style="background:${esc(t.accent||'#23694e')}"></div>
      <div style="padding-left:8px">
        <h3 style="margin-bottom:2px">${esc(t.name)}</h3>
        <div style="font-size:12px;color:var(--mute)">${st.attempted}/${st.total} attempted · ${st.correct} correct</div>
        <div class="meter" style="margin-top:9px"><i style="width:${pct}%"></i></div>
        ${flags?`<div class="stat-row" style="margin-top:8px">${flags}</div>`:''}
      </div>
    </div>`;
}
function renderLibrary(){
  if(!OPEN_SUBS) OPEN_SUBS=new Set(SUBJECTS.length?[SUBJECTS[0].id]:[]);
  const sections=SUBJECTS.map(s=>{
    const topics=TOPICS.filter(t=>(t.subject_id||SUBJECTS[0].id)===s.id).sort((a,b)=>(a.branch_no||0)-(b.branch_no||0));
    const open=OPEN_SUBS.has(s.id);
    let weak=0,due=0,total=0,attempted=0;
    for(const t of topics){ const st=topicStats(t.id); weak+=st.weak; due+=st.due; total+=st.total; attempted+=st.attempted; }
    const flags=[weak?`<span class="chip weak">${weak} weak</span>`:'', due?`<span class="chip due">${due} due</span>`:''].join('');
    return `<section style="margin-bottom:12px">
      <div class="subj-head ${open?'open':''}" onclick="toggleSub('${esc(s.id)}')">
        <h2>${esc(s.name)}</h2>
        <span class="kicker">${topics.length} topic${topics.length===1?'':'s'} · ${attempted}/${total} attempted</span>${flags}
        <button class="btn ghost sm" style="margin-left:auto" onclick="event.stopPropagation();OPEN_SUBS.add('${esc(s.id)}');renderLibrary();toggleForm('tf-${esc(s.id)}')">＋ Topic</button>
        <span class="chev">▸</span>
      </div>
      <div class="${open?'':'hide'}" style="padding:12px 2px 6px">
        <form id="tf-${esc(s.id)}" class="card hide" style="margin-bottom:12px" onsubmit="return addTopic(event,'${esc(s.id)}')">
          <div class="formrow" style="margin-top:0">
            <div><label>Topic name</label><input name="name" required placeholder="e.g. Thermodynamics"></div>
            <div style="flex:1;min-width:220px"><label>Tagline (optional)</label><input name="tagline" style="width:100%" placeholder="One line on what it covers"></div>
            <button class="btn sm" type="submit">Add topic</button>
          </div>
        </form>
        ${topics.length?`<div class="grid2">${topics.map(topicCard).join('')}</div>`:`<p style="color:var(--mute);font-size:13.5px;margin:4px 0">No topics yet — add the first one with ＋ Topic.</p>`}
      </div>
    </section>`;
  }).join('');
  $('main').innerHTML=`<div style="display:flex;align-items:baseline;gap:12px"><div><div class="kicker">Library</div><h1 style="margin:4px 0 6px">Your subjects</h1></div>
      <button class="btn ghost sm" style="margin-left:auto" onclick="toggleForm('sf-new')">＋ Subject</button></div>
    <p style="color:var(--mute);margin:0 0 14px">Subjects hold topics; each topic is a learning path: warm-ups → core → challenge. Or jump straight to <a href="#build">Build a batch</a>.</p>
    <form id="sf-new" class="card hide" style="margin-bottom:20px" onsubmit="return addSubject(event)">
      <div class="formrow" style="margin-top:0">
        <div><label>Subject name</label><input name="name" required placeholder="e.g. Mechanical"></div>
        <div style="flex:1;min-width:220px"><label>Tagline (optional)</label><input name="tagline" style="width:100%"></div>
        <button class="btn sm" type="submit">Add subject</button>
      </div>
    </form>
    ${sections}`;
}
window.toggleSub=id=>{ OPEN_SUBS.has(id)?OPEN_SUBS.delete(id):OPEN_SUBS.add(id); renderLibrary(); };
window.toggleForm=id=>{ const f=$(id); f.classList.toggle('hide'); if(!f.classList.contains('hide')) f.querySelector('input').focus(); };
window.addSubject=async e=>{
  e.preventDefault(); const f=e.target, name=f.name.value.trim(); if(!name) return false;
  const row={id:slug(name), sort_no:SUBJECTS.length+1, name, tagline:f.tagline.value.trim()||null};
  if(SUBJECTS.some(s=>s.id===row.id)){ toast('That subject already exists.'); return false; }
  if(!DEMO){ const {error}=await sb.from('written_test_subjects').insert(row); if(error){ toast('Save failed: '+error.message,6000); return false; } }
  SUBJECTS.push(row); toast(name+' added.'); route(); return false;
};
window.addTopic=async(e,sid)=>{
  e.preventDefault(); const f=e.target, name=f.name.value.trim(); if(!name) return false;
  const sibs=TOPICS.filter(t=>(t.subject_id||SUBJECTS[0].id)===sid);
  const row={id:slug(name), subject_id:sid, branch_no:Math.max(0,...TOPICS.map(t=>t.branch_no||0))+1, name, tagline:f.tagline.value.trim()||null, accent:ACCENTS[sibs.length%ACCENTS.length]};
  if(TOPICS.some(t=>t.id===row.id)){ toast('A topic with that name already exists.'); return false; }
  if(!DEMO){ const {error}=await sb.from('written_test_topics').insert(row); if(error){ toast('Save failed: '+error.message,6000); return false; } }
  TOPICS.push(row); toast(name+' added — now add problems to it.'); location.hash='topic/'+row.id; return false;
};
window.addProblem=async(e,tid)=>{
  e.preventDefault(); const f=e.target, subtitle=f.subtitle.value.trim(), prompt=f.prompt.value.trim();
  if(!subtitle||!prompt) return false;
  const sibs=PROBLEMS.filter(p=>p.topic_id===tid);
  const number=Math.max(0,...sibs.map(p=>p.number||0))+1;
  const row={id:tid+'-'+number, topic_id:tid, number, unit_no:number, subtitle, prompt, given_data:f.given.value.trim()||null, answer:f.answer.value.trim()||null, tier:f.tier.value, kind:f.kind.value};
  if(!DEMO){ const {error}=await sb.from('written_test_problems').insert(row); if(error){ toast('Save failed: '+error.message,6000); return false; } }
  PROBLEMS.push(row); toast('Problem '+number+' added.'); route(); return false;
};

function renderTopic(tid){
  const t=TOPICS.find(x=>x.id===tid); if(!t){ location.hash='library'; return; }
  const latest=latestByProblem();
  const probs=PROBLEMS.filter(p=>p.topic_id===tid).sort((a,b)=>(a.unit_no||a.number)-(b.unit_no||b.number));
  const rows=probs.map(p=>{
    const s=pstatus(p,latest);
    const fb=s.a&&s.a.notes?`<div class="note">↳ ${esc(s.a.notes)}</div>`:'';
    return `<div class="prow"><span class="num">${String(p.unit_no||p.number).padStart(2,'0')}</span>
      <div style="flex:1"><div class="ttl">${esc(p.subtitle)}</div><div style="font-size:12.5px;color:var(--mute)">${esc(p.prompt||'')}</div>${fb}</div>
      <div class="why"><span class="chip ${esc(p.tier||'core')}">${TIER_LABEL[p.tier]||'core'}</span><span class="chip">${esc(p.kind||'drill')}</span><span class="chip ${s.code}">${esc(s.label)}</span></div>
    </div>`;
  }).join('');
  const st=topicStats(tid);
  $('main').innerHTML=`<a href="#library" style="font-size:13px">← Library</a>
    <h1 style="margin-top:8px">${esc(t.name)}</h1>
    <div class="stat-row" style="margin-top:8px"><span class="chip">${st.attempted}/${st.total} attempted</span>${st.weak?`<span class="chip weak">${st.weak} weak</span>`:''}${st.due?`<span class="chip due">${st.due} due</span>`:''}</div>
    <p style="color:var(--mute);margin:6px 0 14px">${esc(t.tagline||'')} The list below is the learning path in order — statuses update automatically as Cowork grades your work.</p>
    <div style="margin-bottom:14px;display:flex;gap:10px"><button class="btn" onclick="buildSel.topic='${esc(tid)}';location.hash='build'">Build a batch from this topic</button><button class="btn ghost" onclick="toggleForm('pf-new')">＋ Add problem</button></div>
    <form id="pf-new" class="card hide" style="margin-bottom:14px" onsubmit="return addProblem(event,'${esc(tid)}')">
      <div class="formrow" style="margin-top:0">
        <div style="flex:1;min-width:200px"><label>Title</label><input name="subtitle" required style="width:100%" placeholder="e.g. Chain rule"></div>
        <div><label>Tier</label><select name="tier"><option value="warmup">warm-up</option><option value="core" selected>core</option><option value="challenge">challenge</option></select></div>
        <div><label>Kind</label><select name="kind"><option value="drill" selected>drill</option><option value="concept">concept</option><option value="applied">applied</option></select></div>
      </div>
      <div class="formrow"><div style="flex:1"><label>Prompt (the question)</label><input name="prompt" required style="width:100%"></div></div>
      <div class="formrow">
        <div style="flex:1;min-width:200px"><label>Given / data (optional)</label><input name="given" style="width:100%"></div>
        <div style="flex:1;min-width:200px"><label>Answer (for the grader, optional)</label><input name="answer" style="width:100%"></div>
        <button class="btn sm" type="submit">Save problem</button>
      </div>
    </form>
    <div class="plist">${rows}</div>`;
}

function renderBuild(){
  const sPills=[['all','All subjects'],...SUBJECTS.map(s=>[s.id,s.name])].map(([id,name])=>`<button class="pill-t ${buildSel.subject===id?'on':''}" onclick="buildSel.subject='${esc(id)}';buildSel.topic='smart';renderBuild()">${esc(name)}</button>`).join('');
  const subTopics=TOPICS.filter(t=>buildSel.subject==='all'||(t.subject_id||(SUBJECTS[0]||{}).id)===buildSel.subject).sort((a,b)=>(a.branch_no||0)-(b.branch_no||0));
  const tPills=[['smart','Smart mix'],...subTopics.map(t=>[t.id,t.name])].map(([id,name])=>`<button class="pill-t ${buildSel.topic===id?'on':''}" onclick="buildSel.topic='${esc(id)}';renderBuild()">${esc(name)}</button>`).join('');
  const tierPills=['warmup','core','challenge'].map(x=>`<button class="pill-t ${buildSel.tiers.has(x)?'on':''}" onclick="tog('tiers','${x}')">${TIER_LABEL[x]}</button>`).join('');
  const kindPills=['drill','concept','applied'].map(x=>`<button class="pill-t ${buildSel.kinds.has(x)?'on':''}" onclick="tog('kinds','${x}')">${x}</button>`).join('');
  const q=queue(buildSel.topic, buildSel.subject, buildSel.tiers, buildSel.kinds, buildSel.count);
  const rows=q.map((x,i)=>`<div class="prow" title="${esc(x.p.prompt||'')}"><span class="num">${String(i+1).padStart(2,'0')}</span>
      <div style="flex:1"><div class="ttl">${esc(x.p.subtitle)}</div><div style="font-size:12.5px;color:var(--mute)">${esc((TOPICS.find(t=>t.id===x.p.topic_id)||{}).name||'')}</div></div>
      <div class="why"><span class="chip ${esc(x.p.tier||'core')}">${TIER_LABEL[x.p.tier]||'core'}</span><span class="chip">${esc(x.p.kind||'drill')}</span><span class="chip ${x.why==='weak'?'weak':x.why==='due'?'due':'new'}">${x.why}</span></div>
    </div>`).join('') || `<p style="color:var(--mute)">Nothing matches these filters — widen the tiers or kinds.</p>`;
  $('main').innerHTML=`<div class="kicker">Build a batch</div><h1 style="margin:4px 0 6px">Next best problems</h1>
    <p style="color:var(--mute);margin:0 0 18px">Ranked automatically: <b>weak spots</b> first, then problems <b>due for review</b>, then <b>new</b> ones in path order. Adjust and export.</p>
    <div class="card">
      <label>Subject</label><div class="pillbar" style="margin-bottom:14px">${sPills}</div>
      <label>Topic</label><div class="pillbar">${tPills}</div>
      <div class="formrow">
        <div><label>Tiers</label><div class="pillbar">${tierPills}</div></div>
        <div><label>Kinds</label><div class="pillbar">${kindPills}</div></div>
        <div><label>Count</label><input type="number" min="1" max="20" value="${buildSel.count}" style="width:80px" onchange="buildSel.count=parseInt(this.value)||5;renderBuild()"></div>
      </div>
    </div>
    <div class="plist">${rows}</div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:18px">
      <button class="btn" id="export-btn" ${q.length?'':'disabled'} onclick="exportBatch()">Export PDF ${DIR?'→ iPad folder':''}</button>
      ${DIR?'':'<span style="font-size:13px;color:var(--mute)">No folder linked — the PDF will download instead. <a href="#setup">Link your iCloud folder</a> for automatic export.</span>'}
    </div><div id="exp-msg" class="msg"></div>`;
}
window.tog=(set,val)=>{ const s=buildSel[set]; s.has(val)?(s.size>1&&s.delete(val)):s.add(val); renderBuild(); };
window.buildSel=buildSel; window.renderBuild=renderBuild; window.exportBatch=exportBatch;

function renderReview(){
  const bRows=BATCHES.map(b=>`<tr><td class="mono" style="font-size:12px">${esc(b.filename)}</td><td>${esc((TOPICS.find(t=>t.id===b.topic_id)||{}).name||'mixed')}</td><td>${(b.problem_ids||[]).length}</td><td><span class="chip status-${esc(b.status)}">${esc(b.status)}</span></td><td style="color:var(--mute)">${new Date(b.created_at).toLocaleDateString()}</td></tr>`).join('');
  const fb=ATTEMPTS.slice(0,30).map(a=>{
    const p=PROBLEMS.find(x=>x.id===a.problem_id)||{subtitle:a.problem_id};
    const t=TOPICS.find(x=>x.id===a.topic_id)||{};
    return `<div class="fb" style="border-left-color:${a.correct?'var(--ok)':'var(--red)'}" onclick="location.hash='topic/${esc(a.topic_id||'')}'" title="Open ${esc(t.name||'topic')}">
      <div class="head"><b>${esc(p.subtitle)}</b><span class="chip">${esc(t.name||'')}</span>
        <span class="chip ${a.correct?'ok':'weak'}">${a.correct?'correct':'wrong'}</span>
        ${a.rating?`<span class="stars">${'★'.repeat(a.rating)}${'☆'.repeat(5-a.rating)}</span>`:''}
        <span style="margin-left:auto;font-size:11.5px;color:var(--mute)" class="mono">${esc(a.graded_by||'')} · ${new Date(a.graded_at).toLocaleDateString()}</span></div>
      ${a.notes?`<div class="notes">${esc(a.notes)}</div>`:''}
    </div>`;
  }).join('') || `<p style="color:var(--mute)">No feedback yet. Export a batch, solve it on your iPad, drop it in <span class="mono">solved/</span> — Cowork's feedback lands here.</p>`;
  $('main').innerHTML=`<div class="kicker">Review</div><h1 style="margin:4px 0 6px">Batches & feedback</h1>
    <p style="color:var(--mute);margin:0 0 18px">Everything Cowork grades appears here and feeds the ranking of your next batch.</p>
    ${BATCHES.length?`<div class="card" style="margin-bottom:18px;padding:10px 16px"><table class="tbl"><thead><tr><th>File</th><th>Topic</th><th>Problems</th><th>Status</th><th>Exported</th></tr></thead><tbody>${bRows}</tbody></table></div>`:''}
    <h2 style="margin:0 0 4px">Feedback</h2>${fb}`;
}

function renderSetup(){
  $('main').innerHTML=`<div class="kicker">Setup</div><h1 style="margin:4px 0 6px">The loop</h1>
    <div class="flow">
      <div class="node"><b>Build & export</b><span>PDF + manifest → outbox/</span></div><div class="arr">→</div>
      <div class="node"><b>iCloud syncs</b><span>folder appears on iPad</span></div><div class="arr">→</div>
      <div class="node"><b>Solve on iPad</b><span>Apple Pencil, save to solved/</span></div><div class="arr">→</div>
      <div class="node"><b>Cowork grades</b><span>writes feedback to Supabase</span></div><div class="arr">→</div>
      <div class="node"><b>Smarter batch</b><span>weak → due → new</span></div>
    </div>
    <div class="card"><h2 style="margin-bottom:14px">One-time setup</h2>
      <div class="steps">
        <div class="step"><div>Run <span class="mono">handoff/schema.sql</span> in the Supabase SQL editor (adds tiers, kinds and batch tracking).</div></div>
        <div class="step"><div>Create a folder in <b>iCloud Drive</b>, e.g. <span class="mono">iCloud Drive/WrittenTest</span>, then link it here: <div style="margin-top:8px;display:flex;gap:10px;align-items:center"><button class="btn sm" onclick="linkFolder()">${DIR?'Re-link folder':'Link folder'}</button><span class="mono" style="font-size:12px;color:${DIR?'var(--ok)':'var(--red)'}">${DIR?'✓ linked: '+esc(DIR.name):'not linked'}</span></div>
          <div style="font-size:12.5px;color:var(--mute);margin-top:6px">The app creates <span class="mono">outbox/ · solved/ · graded/</span> inside it and drops <span class="mono">COWORK_TASK.md</span> for the grader.</div></div></div>
        <div class="step"><div>Open <b>Claude Cowork</b> on your Mac and give it the task file the app just wrote (<span class="mono">COWORK_TASK.md</span> in the folder). Store the Supabase <b>service role key</b> at <span class="mono">~/.config/writtentest/service_role_key</span> — never inside the synced folder.</div></div>
        <div class="step"><div>On the iPad: Files app → iCloud Drive → WrittenTest. Solve PDFs from <span class="mono">outbox/</span> with the Pencil (Markup), then save them into <span class="mono">solved/</span>.</div></div>
      </div>
    </div>`;
}
window.linkFolder=linkFolder;

/* ---------- folder ---------- */
async function restoreDir(){
  try{ const h=await idb.get('dir'); if(!h) return;
    if(await h.queryPermission({mode:'readwrite'})==='granted') DIR=h;
  }catch(e){}
}
async function linkFolder(){
  if(DEMO){ toast('Demo mode — folder linking disabled.'); return; }
  if(!window.showDirectoryPicker){ toast('This browser cannot link folders — use Chrome or Edge.', 5000); return; }
  try{
    const h=await window.showDirectoryPicker({mode:'readwrite'});
    for(const n of ['outbox','solved','graded']) await h.getDirectoryHandle(n,{create:true});
    await writeText(h, 'COWORK_TASK.md', coworkTask());
    await idb.set('dir', h); DIR=h;
    toast('Folder linked. outbox/, solved/, graded/ created; COWORK_TASK.md written.');
    route();
  }catch(e){ if(e.name!=='AbortError') toast('Folder link failed: '+e.message, 5000); }
}
async function writeText(dirHandle, name, text){
  const fh=await dirHandle.getFileHandle(name,{create:true});
  const w=await fh.createWritable(); await w.write(text); await w.close();
}

/* ---------- export ---------- */
async function exportBatch(){
  const q=queue(buildSel.topic, buildSel.subject, buildSel.tiers, buildSel.kinds, buildSel.count);
  if(!q.length) return;
  const m=$('exp-msg'); m.className='msg'; m.textContent='Building PDF…';
  const now=new Date();
  const stamp=now.toISOString().slice(0,16).replace(/[-T:]/g,'').replace(/^(\d{8})(\d{4})$/,'$1_$2');
  const topicSlug=buildSel.topic!=='smart'?buildSel.topic:(buildSel.subject!=='all'?buildSel.subject+'_mix':'mix');
  const fname=`WT_${topicSlug}_${stamp}.pdf`;
  const batchId=(crypto.randomUUID&&crypto.randomUUID())||String(now.getTime());
  const blob=makePdf(q, fname, batchId);
  const manifest=JSON.stringify({batch_id:batchId, user_id:DEMO?'demo':SESSION.user.id, created_at:now.toISOString(), filename:fname,
    problems:q.map(x=>({id:x.p.id, topic_id:x.p.topic_id, number:x.p.number, subtitle:x.p.subtitle, prompt:x.p.prompt, given_data:x.p.given_data||null, answer:x.p.answer||null, worked:x.p.worked||null, tier:x.p.tier, kind:x.p.kind, picked_because:x.why}))}, null, 2);
  let dest='downloaded';
  if(DIR){
    try{
      const out=await DIR.getDirectoryHandle('outbox',{create:true});
      const fh=await out.getFileHandle(fname,{create:true});
      const w=await fh.createWritable(); await w.write(blob); await w.close();
      await writeText(out, fname.replace(/\.pdf$/,'.json'), manifest);
      dest='outbox/ (syncing to iPad)';
    }catch(e){ toast('Folder write failed ('+e.message+') — downloading instead.', 5000); download(blob, fname); }
  } else download(blob, fname);
  if(!DEMO){
    const {error}=await sb.from('written_test_batches').insert({id:batchId, topic_id:buildSel.topic==='smart'?null:buildSel.topic, problem_ids:q.map(x=>x.p.id), filename:fname});
    if(error) toast('Batch row not saved ('+error.message+') — run schema.sql.', 5000); else BATCHES.unshift({id:batchId,topic_id:buildSel.topic==='smart'?null:buildSel.topic,problem_ids:q.map(x=>x.p.id),filename:fname,status:'exported',created_at:now.toISOString()});
  }
  m.className='msg ok'; m.textContent=`${fname} → ${dest}. Solve it on the iPad, save into solved/ — Cowork does the rest.`;
}
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }

function makePdf(q, fname, batchId){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt', format:'letter'}); // 612 x 792
  const M=54, W=612-2*M;
  q.forEach((x,i)=>{
    if(i) doc.addPage();
    const p=x.p, t=TOPICS.find(z=>z.id===p.topic_id)||{};
    // header
    doc.setFont('helvetica','bold'); doc.setFontSize(30); doc.setTextColor(35,105,78);
    doc.text(String(i+1).padStart(2,'0'), M, 78);
    doc.setFontSize(10); doc.setTextColor(120); doc.setFont('courier','normal');
    doc.text(((t.name||p.topic_id)+'  ·  '+(TIER_LABEL[p.tier]||'core')+' / '+(p.kind||'drill')).toUpperCase(), M+50, 70);
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(28,35,32);
    doc.text(p.subtitle||'', 612-M, 74, {align:'right'});
    doc.setDrawColor(28,35,32); doc.setLineWidth(1.4); doc.line(M, 88, 612-M, 88);
    // prompt
    doc.setFont('helvetica','normal'); doc.setFontSize(12.5); doc.setTextColor(28,35,32);
    const promptLines=doc.splitTextToSize(p.prompt||'', W);
    doc.text(promptLines, M, 112);
    let y=112+promptLines.length*16+10;
    // given box
    if(p.given_data){
      const gl=doc.splitTextToSize('GIVEN   '+p.given_data, W-24);
      const bh=gl.length*13+20;
      doc.setFillColor(247,251,253); doc.setDrawColor(224,220,208); doc.setLineWidth(.8);
      doc.roundedRect(M, y, W, bh, 3, 3, 'FD');
      doc.setFont('courier','normal'); doc.setFontSize(10); doc.setTextColor(35,105,78);
      doc.text(gl, M+12, y+16); y+=bh+16;
    }
    // work grid
    doc.setFont('courier','normal'); doc.setFontSize(8); doc.setTextColor(150);
    doc.text('WORK AREA — SHOW EVERY STEP', M, y+10);
    doc.setDrawColor(222,232,238); doc.setLineWidth(.5);
    for(let gy=y+24; gy<668; gy+=22) doc.line(M, gy, 612-M, gy);
    // answer
    doc.setFontSize(8); doc.setTextColor(120); doc.text('ANSWER', M, 690);
    doc.setDrawColor(70,82,75); doc.setLineWidth(.8);
    doc.line(M, 712, 612-M, 712); doc.line(M, 736, 612-M, 736);
    // footer (machine-readable for Cowork)
    doc.setFontSize(7.5); doc.setTextColor(150); doc.setFont('courier','normal');
    doc.text(`batch:${batchId}  problem:${p.id}`, M, 764);
    doc.text(`${i+1} / ${q.length}`, 612-M, 764, {align:'right'});
  });
  return doc.output('blob');
}

/* ---------- cowork task (written into the linked folder) ---------- */
function coworkTask(){
  const uid=DEMO?'<your-user-id>':SESSION.user.id;
  return `# Cowork task — grade my written-test batches

You are my study grader. This folder is the exchange point between my Learning Hub app, my iPad, and you.

## Folder layout
- outbox/  — problem PDFs I exported, each with a matching .json manifest (same basename)
- solved/  — PDFs I solved by hand on the iPad (Markup annotations). NEW FILES HERE = YOUR TRIGGER.
- graded/  — where you move PDFs after grading

## When a new PDF appears in solved/
1. Read its footer on each page: \`batch:<batch_id>  problem:<problem_id>\`. Open the matching manifest in outbox/ (same basename as the original export) for prompts, given data and reference answers.
2. Grade each problem from my handwriting: is the method sound, is the final answer right, where exactly did I slip. Be specific and reference my actual steps.
3. For each problem, insert one row into Supabase (service role key is at ~/.config/writtentest/service_role_key — read it, never copy it into this folder):

\`\`\`
curl -s -X POST "https://wylxvmkcrexwfpjpbhyy.supabase.co/rest/v1/written_test_attempts" \\
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{"problem_id":"<problem_id>","topic_id":"<topic_id>","user_id":"${uid}","correct":true,"rating":4,"score":1,"max_score":1,"notes":"<specific feedback>","graded_by":"cowork"}'
\`\`\`

rating scale: 5 flawless · 4 right with minor slips · 3 right but shaky method · 2 wrong, right idea · 1 wrong.

4. Mark the batch graded:
\`\`\`
curl -s -X PATCH "https://wylxvmkcrexwfpjpbhyy.supabase.co/rest/v1/written_test_batches?id=eq.<batch_id>" \\
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{"status":"graded","graded_at":"<now ISO>"}'
\`\`\`
5. Move the solved PDF into graded/. Optionally leave a short <basename>-feedback.md next to it summarising the session.

Never modify files in outbox/. Never write secrets into this folder (it syncs to iCloud).`;
}
