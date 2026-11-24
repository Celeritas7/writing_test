/* Learning Hub · Written Test — app logic (plain JS, no build step) */
const SUPABASE_URL = "https://wylxvmkcrexwfpjpbhyy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_e3pDOuxIdstaC7s0a680kQ_R10TrAyv";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
if (window.AkatsukiBroadcast) window.AkatsukiBroadcast(sb, 'writing_test').start();
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DAY = 864e5;
const TIER_LABEL = {warmup:'warm-up', core:'core', challenge:'challenge'};
const INTERVALS = {1:1, 2:1, 3:3, 4:7, 5:14}; // rating -> days until due
const rating5 = r => Math.min(5, Math.max(0, Math.round(Number(r)||0)));

let OFFLINE_MODE=false, OFFLINE_DOWNLOAD_BUSY=false;
let SESSION=null, ROLE=null, DEMO=false, LOADED=false, DIR_PENDING=null, SUBJECTS=[], TOPICS=[], PROBLEMS=[], ATTEMPTS=[], BATCHES=[], DIR=null;
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
/* an id that is never empty (Japanese or symbol-only names) and never collides with an existing row */
function uniqueId(name, taken){ let base=slug(name)||('x'+Date.now().toString(36)); let id=base, n=2; while(taken.has(id)) id=base+'_'+(n++); return id; }
/* topics whose subject no longer exists are shown under one 'Unsorted' heading rather than vanishing */
const ORPHAN='__unsorted';
function subjectOf(t){ return SUBJECTS.some(s=>s.id===t.subject_id)?t.subject_id:(t.subject_id?ORPHAN:(SUBJECTS[0]||{}).id); }
const ACCENTS=['#b5532a','#c9a227','#2c5e8f','#a4302c','#8f2c5e','#23694e','#5e2c8f','#2c8f7a'];
let buildSel = {subject:'all', topic:'smart', tiers:new Set(['warmup','core','challenge']), kinds:new Set(['drill','concept','applied']), count:5, paper:(()=>{try{return localStorage.getItem('wt-paper')==='letter'?'letter':'a4';}catch(e){return 'a4';}})()};
let OPEN_SUBS=null;

/* ---------- tiny IndexedDB for the folder handle ---------- */
const idb = {
  db(){ return new Promise((res,rej)=>{ const r=indexedDB.open('wt-hub',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  async get(k){ const d=await this.db(); return new Promise((res,rej)=>{ const t=d.transaction('kv').objectStore('kv').get(k); t.onsuccess=()=>res(t.result); t.onerror=()=>rej(t.error); }); },
  async set(k,v){ const d=await this.db(); return new Promise((res,rej)=>{ const t=d.transaction('kv','readwrite').objectStore('kv').put(v,k); t.onsuccess=()=>res(); t.onerror=()=>rej(t.error); }); }
};

/* Every view is rendered with innerHTML, so accessibility attributes that
   depend on structure are filled in once here instead of in every template:
   a <label> directly before a field gets for/id, and pill toggles mirror
   their .on state into aria-pressed. */
let LBL=0;
function a11yPass(root){
  for(const l of root.querySelectorAll('label:not([for])')){ const f=l.nextElementSibling; if(f&&/^(INPUT|SELECT|TEXTAREA)$/.test(f.tagName)){ if(!f.id) f.id='f'+(++LBL); l.htmlFor=f.id; } }
  for(const b of root.querySelectorAll('.pill-t:not([aria-pressed])')) b.setAttribute('aria-pressed', String(b.classList.contains('on')));
}
new MutationObserver(()=>a11yPass($('main'))).observe($('main'),{childList:true,subtree:true});
/* In-page replacement for confirm()/prompt(): the buttons say what they do,
   Esc and the backdrop cancel, focus is trapped while it is open (native
   <dialog>), and it reads the same on every browser.
   Resolves true/false, 'alt' for the optional third button, or the typed
   text (null on cancel) when `input` is given. */
function ask({title, body='', ok='OK', cancel='Cancel', alt=null, danger=false, input=null}){
  const d=$('ask'), inp=$('ask-in');
  $('ask-t').textContent=title; $('ask-b').innerHTML=body;
  $('ask-ok').textContent=ok; $('ask-no').textContent=cancel;
  $('ask-ok').className='btn sm'+(danger?' btn-danger':'');
  $('ask-alt').classList.toggle('hide',!alt); if(alt) $('ask-alt').textContent=alt;
  inp.classList.toggle('hide', input==null); inp.value=input==null?'':input;
  return new Promise(res=>{
    const done=()=>{ d.removeEventListener('close',done); const v=d.returnValue;
      res(input!=null ? (v==='ok'?inp.value:null) : v==='ok'?true : v==='alt'?'alt' : false); };
    d.addEventListener('close',done);
    d.returnValue='cancel';
    d.onclick=e=>{ if(e.target===d) d.close('cancel'); };
    inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); d.close('ok'); } };
    d.showModal();
    (input!=null?inp:(danger?$('ask-no'):$('ask-ok'))).focus();
  });
}
window.ask=ask;
function toast(msg, ms=3200){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'), ms); }

/* ---------- sidebar collapse ----------------------------------------
   data-icon feeds the collapsed rail's ::before glyph. */
const NAV_ICONS={home:'⌂', library:'▤', quick:'⚡', analytics:'▥', build:'✎', review:'★', ghost:'筆', setup:'⚙'};
(function initNav(){
  for(const el of document.querySelectorAll('.nav-item')) el.dataset.icon=NAV_ICONS[el.dataset.nav]||'•';
  const b=document.getElementById('nav-toggle'); if(!b) return;
  new MutationObserver(()=>b.setAttribute('aria-expanded', String(!document.body.classList.contains('nav-collapsed')))).observe(document.body,{attributes:true,attributeFilter:['class']});
  const set=on=>{ document.body.classList.toggle('nav-collapsed',on);
    b.title=b.ariaLabel=on?'Expand sidebar':'Collapse sidebar';
    try{ localStorage.setItem('lh-nav-collapsed', on?'1':'0'); }catch(e){}
    if(window.ghResizeSoon) ghResizeSoon(); };
  let saved='0'; try{ saved=localStorage.getItem('lh-nav-collapsed')||'0'; }catch(e){}
  set(saved==='1');
  b.addEventListener('click',()=>set(!document.body.classList.contains('nav-collapsed')));
})();

/* ---------- auth ----------------------------------------------------
   Google is the way in. The magic link is still here behind "use an email
   link instead", because Supabase's built-in mailer rate-limits at a few
   sends an hour and will lock you out mid-session.
   Only emails listed in authentication_mode_user_roles get through; anyone
   else is signed straight back out. That table needs a self-read policy —
   see sql/auth_allowlist.sql.
------------------------------------------------------------------- */
const AUTH_TABLE='authentication_mode_user_roles';

$('google-btn').addEventListener('click', async ()=>{
  const m=$('gate-msg'); m.className='msg'; m.textContent='Opening Google…';
  const {error}=await sb.auth.signInWithOAuth({provider:'google',
    options:{redirectTo:location.href.split('#')[0], queryParams:{prompt:'select_account'}}});
  if(error){ m.className='msg err'; m.textContent=error.message; }
});
$('email-toggle').addEventListener('click', e=>{ e.preventDefault(); $('email-row').classList.toggle('hide'); $('email').focus(); });
$('send-link').addEventListener('click', async ()=>{
  const email=$('email').value.trim(), m=$('gate-msg');
  if(!email){ m.className='msg err'; m.textContent='Enter your email first.'; return; }
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.href.split('#')[0]}});
  m.className=error?'msg err':'msg ok';
  m.textContent=error
    ? (/rate limit/i.test(error.message)
        ? 'Email limit hit — Supabase only sends a few links an hour. Use Continue with Google instead.'
        : error.message)
    : 'Check your inbox for the magic link, then return here.';
});
$('email').addEventListener('keydown', e=>{ if(e.key==='Enter') $('send-link').click(); });
/* install prompt (Chrome/Edge/Android); iOS installs from the Share sheet */
let INSTALL_EVT=null; const STANDALONE=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let INSTALLED=false; addEventListener('appinstalled',()=>{ INSTALLED=true; INSTALL_EVT=null; if(location.hash==='#setup') route(); });
addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); INSTALL_EVT=e; if(location.hash==='#setup') route(); });
window.installApp=async()=>{
  const ev=INSTALL_EVT; if(!ev) return;
  INSTALL_EVT=null;                               // the event is single-use whatever happens next
  try{ await ev.prompt(); const c=await ev.userChoice; if(c&&c.outcome==='accepted') INSTALLED=true; }catch(e){}
  if(location.hash==='#setup') route();
};
/* who is signed in, for the sidebar foot and the Account card */
const whoText=()=>DEMO?'demo mode — nothing is saved':((SESSION.user.email||SESSION.user.id)+(ROLE?' · '+ROLE:''));
window.signOut=async()=>{
  if(!DEMO&&window.WTOffline){
    try{await WTOffline.lockOffline();}catch(e){
      toast('Offline access could not be locked; do not leave this device shared. '+e.message,7000);
      return;
    }
  }
  if(OFFLINE_MODE){
    WTOffline.deactivate();OFFLINE_MODE=false;LOADED=false;
    SESSION=null;ROLE=null;document.body.classList.remove('study-offline');
    $('app').classList.add('hide');$('gate').classList.remove('hide');
    $('offline-launch').classList.add('hide');
    $('gate-msg').textContent='Offline access locked. Reconnect to sign in again; downloaded data was not deleted.';
    return;
  }
  if(!DEMO)await sb.auth.signOut();
  location.href=location.pathname;
};
$('demo-btn').addEventListener('click', ()=>{ DEMO=true; startDemo(); });

/* returns the allowlist row, null if not listed, or {error} if unreadable */
async function authRole(email){
  if(!email) return null;
  // case-insensitive exact match: escape LIKE wildcards so j_doe@x.com can't match jadoe@x.com
  const {data,error}=await sb.from(AUTH_TABLE).select('email,role,name').ilike('email',email.replace(/[\\%_]/g,m=>'\\'+m)).limit(1);
  if(error) return {error:error.message};
  return (data&&data[0])||null;
}
let ADMITTING=false;
function isOfflineNetworkError(message){
  return /failed to fetch|network|timeout|timed out|abort|internet|connection|offline/i.test(String(message||''));
}
async function offlineEntry(manual=false){
  if(DEMO||!window.WTOffline)return false;
  if(LOADED&&!OFFLINE_MODE)return false;
  try{
    const owner=await WTOffline.offlineOwner();
    if(!owner||!await WTOffline.enrolled(owner)||!await WTOffline.assetsReady()){
      if(manual)$('gate-msg').textContent=
        'No complete offline pack is available here. Sign in online, open Settings and download from this installed app.';
      return false;
    }
    const p=await WTOffline.pack(owner);
    if(SESSION&&SESSION.user&&SESSION.user.id!==owner)return false;
    OFFLINE_MODE=true;WTOffline.activate();
    SESSION={user:{id:owner,email:p.email||''}};
    ROLE=p.role||'learner';
    SUBJECTS=p.subjects.slice();TOPICS=p.topics.slice();PROBLEMS=p.problems.slice();
    ATTEMPTS=p.attempts.slice();BATCHES=(p.batches||[]).slice();
    const queued=await WTOffline.queuedAttempts(owner);
    const ids=new Set(queued.map(r=>r.id));
    ATTEMPTS=[...queued,...ATTEMPTS.filter(a=>!ids.has(a.id))];
    LOADED=true;
    $('gate').classList.add('hide');$('app').classList.remove('hide');
    $('who').textContent=(p.email||'Learner')+' · offline pack';
    document.body.classList.add('study-offline');
    route();
    return true;
  }catch(e){
    if(manual)$('gate-msg').textContent='Offline pack could not open: '+(e.message||e);
    return false;
  }
}
window.openOfflineStudy=()=>offlineEntry(true);
$('offline-launch').addEventListener('click',()=>offlineEntry(true));
async function showOfflineGate(){
  if(!window.WTOffline||LOADED)return;
  try{
    const owner=await WTOffline.offlineOwner();
    const ready=!!(owner&&await WTOffline.enrolled(owner)&&await WTOffline.assetsReady());
    $('offline-launch').classList.toggle('hide',!ready);
  }catch(e){}
}
async function admit(s){
  if(!s||SESSION||DEMO||ADMITTING||OFFLINE_MODE)return;
  ADMITTING=true;
  try{await admitInner(s);}
  catch(e){
    if((!navigator.onLine||isOfflineNetworkError(e.message))&&await offlineEntry())return;
    $('gate-msg').textContent='Could not sign in: '+(e.message||e);
  }finally{ADMITTING=false;}
}
async function admitInner(s){
  const email=(s.user&&s.user.email||'').trim();
  const row=await authRole(email);
  if(OFFLINE_MODE)return;
  if(row&&row.error){
    if((!navigator.onLine||isOfflineNetworkError(row.error))&&await offlineEntry())return;
    const m=$('gate-msg');m.className='msg err';
    m.textContent='Could not verify your access ('+row.error+
      '). Try again online or use a previously downloaded offline pack.';
    await showOfflineGate(); // a transient network error must not sign out the learner
    return;
  }
  if(!row){
    const m=$('gate-msg');m.className='msg err';
    m.textContent=email+' is not on the access list. Ask the administrator to add you.';
    if(window.WTOffline)await WTOffline.lockOffline().catch(()=>{});
    await sb.auth.signOut();return;
  }
  ROLE=row.role||'operator';SESSION=s;
  try{await boot();}
  catch(e){
    if((!navigator.onLine||isOfflineNetworkError(e.message))&&await offlineEntry())return;
    loadError(e.message||String(e));
  }
}
sb.auth.onAuthStateChange((_event,s)=>{if(!OFFLINE_MODE)admit(s);});
if(navigator.onLine===false){
  // Avoid starting a Supabase token refresh when the app is known to be offline.
  offlineEntry().then(ok=>{if(!ok)showOfflineGate();});
}else{
  sb.auth.getSession().then(({data})=>{
    if(data&&data.session)admit(data.session);
    else showOfflineGate();
  }).catch(()=>offlineEntry().then(ok=>{if(!ok)showOfflineGate();}));
  // Wi-Fi can be connected while the Internet is unavailable. A downloaded
  // pack offers a bounded fallback rather than leaving the learner at Login.
  setTimeout(()=>{if(!LOADED)offlineEntry();},6500);
}
showOfflineGate();

/* ---------- data ---------- */
function loadError(msg){
  $('main').innerHTML=`<div class="card" style="max-width:560px;margin-top:20px"><h2 style="margin:0 0 8px">Couldn't load your data</h2>
    <p style="color:var(--soft);margin:0 0 14px">${esc(msg)}</p>
    <button class="btn sm" onclick="boot()">Retry</button> <a href="#" onclick="signOut();return false" style="margin-left:12px;font-size:13px">Sign out</a></div>`;
}
window.boot=boot;
async function boot(){
  $('gate').classList.add('hide'); $('app').classList.remove('hide');
  $('main').innerHTML='<p style="color:var(--mute);margin-top:20px">Loading…</p>';
  $('who').textContent = whoText();
  if(!DEMO){
    const [t,p,a,b,s] = await Promise.all([
      sb.from('written_test_topics').select('*').order('branch_no'),
      sb.from('written_test_problems').select('*').order('number'),
      sb.from('written_test_attempts').select('*').order('graded_at',{ascending:false}),
      sb.from('written_test_batches').select('*').order('created_at',{ascending:false}),
      sb.from('written_test_subjects').select('*').order('sort_no')
    ]);
    const bad=[t,p,a].find(r=>r.error);
    if(bad){
      if((!navigator.onLine||isOfflineNetworkError(bad.error.message))&&await offlineEntry())return;
      loadError(bad.error.message);return;
    }
    TOPICS=t.data||[]; PROBLEMS=p.data||[]; ATTEMPTS=a.data||[];
    BATCHES=b.error?[]:(b.data||[]); // tables may not exist until schema.sql is run
    SUBJECTS=s.error?[{id:'maths',sort_no:1,name:'Maths'}]:(s.data||[]);
    if(b.error||s.error) toast('Run schema.sql to enable subjects & batch tracking.', 5000);
    // Preserve unsynced Hub/Quick marks across reloads. They are explicitly
    // tagged local-pending and not claimed to be already on the server.
    if(window.WTOffline){
      try{
        const waiting=await WTOffline.queuedAttempts(SESSION.user.id);
        const ids=new Set(waiting.map(r=>r.id));
        ATTEMPTS=[...waiting,...ATTEMPTS.filter(a=>!ids.has(a.id))];
      }catch(e){toast('Could not read offline pending results: '+e.message,6000);}
    }
  }
  LOADED=true;
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
  const KJ=[['生える','はえる'],['六人','ろくにん'],['歩く','あるく'],['先々月','せんせんげつ'],['七人','しちにん'],['一年','いちねん'],['小学校','しょうがっこう'],['少女','しょうじょ'],['千本','せんぼん'],['あの方','あのかた'],['五万円','ごまんえん'],['先週','せんしゅう'],['上手(な)','じょうず'],['休み','やすみ'],['時間','じかん'],['のぼり','上り'],['げんき','元気'],['ちいさい','小さい'],['てま','手間'],['つぶら','円ら']];
  PROBLEMS=PROBLEMS.filter(p=>p.topic_id!=='kanji_n5').concat(KJ.map(([q,a],i)=>({id:'kanji_n5-'+(i+1),topic_id:'kanji_n5',number:i+1,unit_no:i+1,subtitle:(i<15?'Read: ':'Write: ')+q,prompt:q,answer:a,kanji:i<15?q:a,rev:i>=15,tier:i<5?'warmup':i<15?'core':'challenge',kind:i<15?'drill':'concept'})));
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
  // rating comes from an external grader — clamp so a stray value can't break the ladder
  const days = INTERVALS[rating5(a.rating)||3]||3;
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
  const subOf=tid=>{ const t=TOPICS.find(x=>x.id===tid); return t?subjectOf(t):null; };
  let pool=PROBLEMS.filter(p=>(topicId!=='smart' ? p.topic_id===topicId : (subjectId==='all'||subOf(p.topic_id)===subjectId)) && tiers.has(p.tier||'core') && kinds.has(p.kind||'drill'));
  const out=new Set(); for(const b of BATCHES) if(b.status!=='graded') for(const id of (b.problem_ids||[])) out.add(id);
  const scored=pool.map(p=>{
    const s=pstatus(p, latest);
    let rank, why;
    if(s.code==='weak'){ rank=0; why='weak'; }
    else if(s.code==='due'){ rank=1; why='due'; }
    else if(s.code==='new'){ rank=2; why='new'; }
    else { rank=3; why='review'; }
    if(out.has(p.id)){ rank+=10; why='in batch'; } // exported but not graded yet — don't send it out twice
    return {p, s, rank, why, tie:(s.due?s.due.getTime():0)+(p.unit_no||p.number||0)/100};
  });
  scored.sort((a,b)=>a.rank-b.rank || a.tie-b.tie);
  return scored.slice(0,n);
}

/* ---------- routing ---------- */
window.addEventListener('hashchange',()=>{
  route();
  if(!LOADED)return;
  requestAnimationFrame(()=>{
    const target=$('main');
    if(target){
      try{target.focus({preventScroll:true});}catch(e){target.focus();}
    }
    const region=$('route-announcer');
    if(region)region.textContent='Opened '+document.title.replace(/^Learning Hub(?: — )?/,'');
  });
});
function route(){
  if(!LOADED) return;
  // phones land on the dashboard; a wide screen opens straight into the Library
  const h=(location.hash||(matchMedia('(max-width:760px)').matches?'#home':'#library')).slice(1);
  const [page,argRaw]=h.split('/'); const arg=argRaw?decodeURIComponent(argRaw):argRaw;
  const active=page==='topic'?'library':page;
  document.querySelectorAll('.nav-item').forEach(el=>{
    const current=el.dataset.nav===active;
    el.classList.toggle('active',current);
    if(current)el.setAttribute('aria-current','page');
    else el.removeAttribute('aria-current');
  });
  const pageTitles={home:'Home',library:'Library',quick:'Quick Practice',
    analytics:'Learning analytics',build:'Build a batch',review:'Review',
    ghost:'Ghost Test',setup:'Settings'};
  const title=page==='topic'?(TOPICS.find(t=>t.id===arg)||{}).name||'Topic':
    pageTitles[page]||'Library';
  document.title='Learning Hub — '+title;
  const latest=latestByProblem();
  let dueN=0; for(const p of PROBLEMS){ const c=pstatus(p,latest).code; if(c==='weak'||c==='due') dueN++; }
  $('cnt-lib').textContent=PROBLEMS.length; $('cnt-due').textContent=dueN||''; $('cnt-fb').textContent=ATTEMPTS.length||''; $('cnt-home').textContent=dueN||''; $('cnt-home').setAttribute('aria-hidden','true'); $('cnt-setup').setAttribute('aria-hidden','true'); $('cnt-setup').textContent=DIR?'✓':DEMO?'':'!'; $('cnt-setup').dataset.warn=String(!DIR&&!DEMO); document.querySelector('.nav-item[data-nav=home]').setAttribute('aria-label', dueN?'Home, '+dueN+' due':'Home'); document.querySelector('.nav-item[data-nav=setup]').setAttribute('aria-label', !DIR&&!DEMO?'Settings, iCloud folder not linked':'Settings'); $('cnt-setup').title=DIR?'iCloud folder linked':DIR_PENDING?'iCloud folder needs reconnecting':'iCloud folder not linked yet';
  if(page==='home') renderHome();
  else if(page==='topic') renderTopic(arg);
  else if(page==='quick') renderQuickPractice();
  else if(page==='analytics') renderAnalytics();
  else if(page==='build') renderBuild();
  else if(page==='review') renderReview();
  else if(page==='ghost') renderGhost();
  else if(page==='setup') renderSetup();
  else renderLibrary();
  if(OFFLINE_MODE&&$('main')){
    const banner=document.createElement('div');
    banner.className='wt-offline-notice';banner.setAttribute('role','status');
    banner.textContent='Ready offline · downloaded study data on this device. New results are saved locally and require later synchronization.';
    $('main').prepend(banner);
  }
}

/* ---------- screens ---------- */
function topicCard(t){
    const st=topicStats(t.id);
    const pct=st.total?Math.round(100*st.attempted/st.total):0;
    const flags=[st.weak?`<span class="chip weak">${st.weak} weak</span>`:'', st.due?`<span class="chip due">${st.due} due</span>`:''].join('');
    return `<a class="card topic-card" style="padding:14px 16px" href="#topic/${encodeURIComponent(t.id)}">
      <div class="bar" style="background:${esc(t.accent||'#23694e')}"></div>
      <div style="padding-left:8px">
        <h3 style="margin-bottom:2px">${esc(t.name)}</h3>
        <div style="font-size:12px;color:var(--mute)">${st.attempted}/${st.total} attempted · ${st.correct} correct</div>
        <div class="meter" style="margin-top:9px"><i style="width:${pct}%"></i></div>
        ${flags?`<div class="stat-row" style="margin-top:8px">${flags}</div>`:''}
      </div>
    </a>`;
}
function renderLibrary(){
  if(!OPEN_SUBS) OPEN_SUBS=new Set(SUBJECTS.length?[SUBJECTS[0].id]:[]);
  const orphans=TOPICS.filter(t=>subjectOf(t)===ORPHAN);
  const sections=SUBJECTS.concat(orphans.length?[{id:ORPHAN,name:'Unsorted',orphan:true}]:[]).map(s=>{
    const topics=TOPICS.filter(t=>subjectOf(t)===s.id).sort((a,b)=>(a.branch_no||0)-(b.branch_no||0));
    const open=OPEN_SUBS.has(s.id);
    let weak=0,due=0,total=0,attempted=0;
    for(const t of topics){ const st=topicStats(t.id); weak+=st.weak; due+=st.due; total+=st.total; attempted+=st.attempted; }
    const flags=[weak?`<span class="chip weak">${weak} weak</span>`:'', due?`<span class="chip due">${due} due</span>`:''].join('');
    return `<section style="margin-bottom:12px">
      <div class="subj-head ${open?'open':''}" role="button" tabindex="0" aria-expanded="${open}" onclick="toggleSub('${esc(s.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleSub('${esc(s.id)}')}">
        <h2>${esc(s.name)}</h2>
        <span class="kicker">${topics.length} topic${topics.length===1?'':'s'} · ${attempted}/${total} attempted</span>${flags}
        ${s.orphan?`<span class="kicker" style="margin-left:auto;color:var(--amber)">subject missing — open a topic to move it</span>`:`<span class="rowtools" style="margin-left:auto" onclick="event.stopPropagation()"><button title="Rename subject" aria-label="Rename ${esc(s.name)}" onclick="renameSubject('${esc(s.id)}')">✎</button><button title="Delete subject" aria-label="Delete ${esc(s.name)}" class="danger" onclick="deleteSubject('${esc(s.id)}')" ${topics.length?'disabled':''}>🗑</button></span>
        <button class="btn ghost sm" onclick="event.stopPropagation();OPEN_SUBS.add('${esc(s.id)}');renderLibrary();toggleForm('tf-${esc(s.id)}')" aria-label="Add a topic to ${esc(s.name)}">＋<span class="wide-only"> Topic</span></button>`}
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
    <form id="sf-new" class="card ${SUBJECTS.length?'hide':''}" style="margin-bottom:20px" onsubmit="return addSubject(event)">
      ${SUBJECTS.length?'':'<p style="margin:0 0 10px"><b>Start here.</b> Add your first subject — Maths, Language study, anything you practise by hand. Topics and problems go inside it.</p>'}
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
/* one submit at a time: the button is disabled while the insert is in flight */
async function busy(f, fn){ if(OFFLINE_MODE){toast('Library editing needs an online connection. Your downloaded lessons remain available.',5500);return false;} if(f._busy) return false; const b=f.querySelector('button[type=submit],button:not([type])'); f._busy=true; if(b){ b.disabled=true; b.dataset.t=b.textContent; b.textContent='Saving…'; } try{ return await fn(); } finally{ f._busy=false; if(b&&b.isConnected){ b.disabled=false; b.textContent=b.dataset.t; } } }
window.addSubject=e=>{ e.preventDefault(); busy(e.target, ()=>addSubjectNow(e.target)); return false; };
async function addSubjectNow(f){
  const name=f.name.value.trim(); if(!name) return false;
  if(SUBJECTS.some(s=>s.name.toLowerCase()===name.toLowerCase())){ toast('That subject already exists.'); return false; }
  const row={id:uniqueId(name, new Set(SUBJECTS.map(s=>s.id))), sort_no:Math.max(0,...SUBJECTS.map(s=>s.sort_no||0))+1, name, tagline:f.tagline.value.trim()||null};
  if(!DEMO){ const {error}=await sb.from('written_test_subjects').insert(row); if(error){ toast('Save failed: '+error.message,6000); return false; } }
  SUBJECTS.push(row); toast(name+' added.'); route(); return false;
};
window.addTopic=(e,sid)=>{ e.preventDefault(); busy(e.target, ()=>addTopicNow(e.target,sid)); return false; };
async function addTopicNow(f,sid){
  const name=f.name.value.trim(); if(!name) return false;
  const sibs=TOPICS.filter(t=>subjectOf(t)===sid);
  if(sibs.some(t=>t.name.toLowerCase()===name.toLowerCase())){ toast('This subject already has a topic with that name.'); return false; }
  const row={id:uniqueId(name, new Set(TOPICS.map(t=>t.id))), subject_id:sid, branch_no:Math.max(0,...TOPICS.map(t=>t.branch_no||0))+1, name, tagline:f.tagline.value.trim()||null, accent:ACCENTS[sibs.length%ACCENTS.length]};
  if(!DEMO){ const {error}=await sb.from('written_test_topics').insert(row); if(error){ toast('Save failed: '+error.message,6000); return false; } }
  TOPICS.push(row); toast(name+' added — now add problems to it.'); location.hash='topic/'+row.id; return false;
};
window.addProblem=(e,tid)=>{ e.preventDefault(); busy(e.target, ()=>addProblemNow(e.target,tid)); return false; };
async function addProblemNow(f,tid){
  const subtitle=f.subtitle.value.trim(), prompt=f.prompt.value.trim();
  if(!subtitle||!prompt) return false;
  const sibs=PROBLEMS.filter(p=>p.topic_id===tid);
  const number=Math.max(0,...sibs.map(p=>p.number||0))+1;
  const row={id:tid+'-'+number, topic_id:tid, number, unit_no:number, subtitle, prompt, given_data:f.given.value.trim()||null, answer:f.answer.value.trim()||null, tier:f.tier.value, kind:f.kind.value};
  if(!DEMO){ const {error}=await sb.from('written_test_problems').insert(row); if(error){ toast('Save failed: '+error.message,6000); return false; } }
  PROBLEMS.push(row); EDIT_P=null; toast('Problem '+number+' added.'); route(); return false;
};

function renderTopic(tid){
  const t=TOPICS.find(x=>x.id===tid); if(!t){ location.hash='library'; return; }
  const latest=latestByProblem();
  const probs=PROBLEMS.filter(p=>p.topic_id===tid).sort((a,b)=>(a.unit_no||a.number)-(b.unit_no||b.number));
  const rows=probs.map(p=>{
    const s=pstatus(p,latest);
    const fb=s.a&&s.a.notes?`<div class="note">↳ ${esc(s.a.notes)}</div>`:'';
    const i=probs.indexOf(p);
    return `<div class="prow" id="pr-${esc(p.id)}"><span class="num">${String(p.unit_no||p.number).padStart(2,'0')}</span>
      <div style="flex:1;min-width:0"><div class="ttl">${esc(p.subtitle)}</div><div class="prompt1">${esc(p.prompt||'')}</div>${fb}</div>
      <div class="why"><span class="chip ${esc(p.tier||'core')}">${TIER_LABEL[p.tier]||'core'}</span><span class="chip">${esc(p.kind||'drill')}</span><span class="chip ${s.code}">${esc(s.label)}</span>
        <span class="rowtools"><button title="Move up" aria-label="Move up" onclick="moveProblem('${esc(p.id)}',-1)" ${i===0?'disabled':''}>▲</button><button title="Move down" aria-label="Move down" onclick="moveProblem('${esc(p.id)}',1)" ${i===probs.length-1?'disabled':''}>▼</button><button title="Edit" aria-label="Edit ${esc(p.subtitle)}" onclick="editProblem('${esc(p.id)}')">✎</button><button title="Delete" aria-label="Delete ${esc(p.subtitle)}" class="danger" onclick="deleteProblem('${esc(p.id)}')">🗑</button></span></div>
    </div>${EDIT_P===p.id?problemForm(tid,p):''}`;
  }).join('');
  const st=topicStats(tid);
  $('main').innerHTML=`<a href="#library" style="font-size:13px">← Library</a>
    <h1 style="margin-top:8px">${esc(t.name)}</h1>
    <div class="stat-row" style="margin-top:8px"><span class="chip">${st.attempted}/${st.total} attempted</span>${st.weak?`<span class="chip weak">${st.weak} weak</span>`:''}${st.due?`<span class="chip due">${st.due} due</span>`:''}</div>
    <p style="color:var(--mute);margin:6px 0 14px">${esc(t.tagline||'')} The list below is the learning path in order — statuses update automatically as Cowork grades your work.</p>
    <div style="margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" onclick="practise('${esc(tid)}')">Build a batch from this topic</button><button class="btn ghost" onclick="toggleForm('pf-new')">＋ Add problem</button><button class="btn ghost" onclick="toggleForm('tf-edit')">✎ Edit topic</button></div>
    <form id="tf-edit" class="card hide" style="margin-bottom:14px" onsubmit="return saveTopic(event,'${esc(tid)}')">
      <div class="formrow" style="margin-top:0">
        <div><label>Topic name</label><input name="name" required value="${esc(t.name)}"></div>
        <div style="flex:1;min-width:220px"><label>Tagline</label><input name="tagline" style="width:100%" value="${esc(t.tagline||'')}"></div>
        <div><label>Subject</label><select name="subject_id">${SUBJECTS.map(s=>`<option value="${esc(s.id)}" ${subjectOf(t)===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
        <button class="btn sm" type="submit">Save topic</button>
        <button class="btn sm ghost danger" type="button" onclick="deleteTopic('${esc(tid)}')" ${probs.length?'disabled title="Delete its problems first"':''}>Delete topic</button>
      </div>
    </form>
    <div id="pf-new" class="${EDIT_P?'':'hide'}">${EDIT_P?'':problemForm(tid,null)}</div>
    <div class="plist">${rows}</div>`;
}
/* one form for add and edit; prompt / given / answer are multi-line */
let EDIT_P=null;
function problemForm(tid,p){
  const sel=(n,v,opts)=>`<select name="${n}">${opts.map(([k,l])=>`<option value="${k}" ${(p?p[n]:v)===k?'selected':''}>${l}</option>`).join('')}</select>`;
  return `<form class="card" style="margin:8px 0 14px" onsubmit="return ${p?`saveProblem(event,'${esc(p.id)}')`:`addProblem(event,'${esc(tid)}')`}">
      <div class="formrow" style="margin-top:0">
        <div style="flex:1;min-width:200px"><label>Title</label><input name="subtitle" required style="width:100%" placeholder="e.g. Chain rule" value="${esc(p?p.subtitle:'')}"></div>
        <div><label>Tier</label>${sel('tier','core',[['warmup','warm-up'],['core','core'],['challenge','challenge']])}</div>
        <div><label>Kind</label>${sel('kind','drill',[['drill','drill'],['concept','concept'],['applied','applied']])}</div>
      </div>
      <div class="formrow"><div style="flex:1"><label>Prompt (the question)</label><textarea name="prompt" required rows="3" placeholder="Line breaks are kept in the PDF">${esc(p?p.prompt:'')}</textarea></div></div>
      <div class="formrow">
        <div style="flex:1;min-width:200px"><label>Given / data (optional)</label><textarea name="given" rows="2">${esc(p?p.given_data||'':'')}</textarea></div>
        <div style="flex:1;min-width:200px"><label>Answer (for the grader, optional)</label><textarea name="answer" rows="2">${esc(p?p.answer||'':'')}</textarea></div>
      </div>
      <div class="formrow"><button class="btn sm" type="submit">${p?'Save changes':'Save problem'}</button>${p?`<button class="btn sm ghost" type="button" onclick="EDIT_P=null;route()">Cancel</button>`:''}</div>
    </form>`;
}
/* ---------- edit / delete / reorder ---------- */
async function dbUpdate(table,id,patch){ if(OFFLINE_MODE){toast('Connect to edit the Library.',5000);return false;} if(DEMO) return true; const {error}=await sb.from(table).update(patch).eq('id',id); if(error){ toast('Save failed: '+error.message,6000); return false; } return true; }
async function dbDelete(table,id){ if(OFFLINE_MODE){toast('Connect to edit the Library.',5000);return false;} if(DEMO) return true; const {error}=await sb.from(table).delete().eq('id',id); if(error){ toast('Delete failed: '+error.message,6000); return false; } return true; }
window.editProblem=id=>{ EDIT_P=id; route(); setTimeout(()=>{ const el=$('pr-'+id); if(el) el.scrollIntoView({block:'center',behavior:'smooth'}); },50); };
window.saveProblem=(e,id)=>{ e.preventDefault(); busy(e.target, async()=>{
  const f=e.target, p=PROBLEMS.find(x=>x.id===id); if(!p) return false;
  const patch={subtitle:f.subtitle.value.trim(), prompt:f.prompt.value.trim(), given_data:f.given.value.trim()||null, answer:f.answer.value.trim()||null, tier:f.tier.value, kind:f.kind.value};
  if(!patch.subtitle||!patch.prompt) return false;
  if(await dbUpdate('written_test_problems',id,patch)){ Object.assign(p,patch); EDIT_P=null; toast('Problem updated.'); route(); }
  return false; }); return false; };
window.deleteProblem=async id=>{
  const p=PROBLEMS.find(x=>x.id===id); if(!p) return;
  const n=ATTEMPTS.filter(a=>a.problem_id===id).length;
  if(!await ask({title:`Delete “${p.subtitle}”?`, body:`<p>${n?`Its ${n} graded attempt${n===1?' stays':'s stay'} in Review, labelled by id instead of title. `:''}This can't be undone.</p>`, ok:'Delete problem', cancel:'Keep it', danger:true})) return;
  if(await dbDelete('written_test_problems',id)){ PROBLEMS=PROBLEMS.filter(x=>x.id!==id); toast('Problem deleted.'); route(); }
};
window.moveProblem=async(id,dir)=>{
  const p=PROBLEMS.find(x=>x.id===id); if(!p) return;
  const sibs=PROBLEMS.filter(x=>x.topic_id===p.topic_id).sort((a,b)=>(a.unit_no||a.number)-(b.unit_no||b.number));
  const i=sibs.indexOf(p), q=sibs[i+dir]; if(!q) return;
  const a=p.unit_no||p.number, b=q.unit_no||q.number;
  if(await dbUpdate('written_test_problems',p.id,{unit_no:b})&&await dbUpdate('written_test_problems',q.id,{unit_no:a})){ p.unit_no=b; q.unit_no=a; route(); }
};
window.saveTopic=(e,id)=>{ e.preventDefault(); busy(e.target, async()=>{
  const f=e.target, t=TOPICS.find(x=>x.id===id); if(!t) return false;
  const patch={name:f.name.value.trim(), tagline:f.tagline.value.trim()||null, subject_id:f.subject_id.value};
  if(!patch.name) return false;
  if(await dbUpdate('written_test_topics',id,patch)){ Object.assign(t,patch); toast('Topic updated.'); route(); }
  return false; }); return false; };
window.deleteTopic=async id=>{
  const t=TOPICS.find(x=>x.id===id); if(!t||PROBLEMS.some(p=>p.topic_id===id)) return;
  if(!await ask({title:`Delete the topic “${t.name}”?`, body:"<p>It has no problems left. This can't be undone.</p>", ok:'Delete topic', cancel:'Keep it', danger:true})) return;
  if(await dbDelete('written_test_topics',id)){ TOPICS=TOPICS.filter(x=>x.id!==id); toast('Topic deleted.'); location.hash='library'; }
};
window.renameSubject=async id=>{
  const s=SUBJECTS.find(x=>x.id===id); if(!s) return;
  const name=await ask({title:'Rename subject', body:'<p>Topics and problems stay where they are.</p>', ok:'Rename', input:s.name}); if(name==null) return; const nm=name.trim(); if(!nm||nm===s.name) return;
  if(await dbUpdate('written_test_subjects',id,{name:nm})){ s.name=nm; toast('Subject renamed.'); route(); }
};
window.deleteSubject=async id=>{
  const s=SUBJECTS.find(x=>x.id===id); if(!s||TOPICS.some(t=>subjectOf(t)===id)) return;
  if(!await ask({title:`Delete the subject “${s.name}”?`, body:"<p>It has no topics left. This can't be undone.</p>", ok:'Delete subject', cancel:'Keep it', danger:true})) return;
  if(await dbDelete('written_test_subjects',id)){ SUBJECTS=SUBJECTS.filter(x=>x.id!==id); OPEN_SUBS=null; toast('Subject deleted.'); route(); }
};

function renderBuild(){
  const sPills=[['all','All subjects'],...SUBJECTS.map(s=>[s.id,s.name])].map(([id,name])=>`<button class="pill-t ${buildSel.subject===id?'on':''}" onclick="buildSel.subject='${esc(id)}';buildSel.topic='smart';renderBuild()">${esc(name)}</button>`).join('');
  const subTopics=TOPICS.filter(t=>buildSel.subject==='all'||subjectOf(t)===buildSel.subject).sort((a,b)=>(a.branch_no||0)-(b.branch_no||0));
  const tPills=[['smart','Smart mix'],...subTopics.map(t=>[t.id,t.name])].map(([id,name])=>`<button class="pill-t ${buildSel.topic===id?'on':''}" onclick="buildSel.topic='${esc(id)}';renderBuild()">${esc(name)}</button>`).join('');
  const tierPills=['warmup','core','challenge'].map(x=>`<button class="pill-t ${buildSel.tiers.has(x)?'on':''}" onclick="tog('tiers','${x}')">${buildSel.tiers.has(x)?'✓ ':''}${TIER_LABEL[x]}</button>`).join('');
  const kindPills=['drill','concept','applied'].map(x=>`<button class="pill-t ${buildSel.kinds.has(x)?'on':''}" onclick="tog('kinds','${x}')">${buildSel.kinds.has(x)?'✓ ':''}${x}</button>`).join('');
  const q=queue(buildSel.topic, buildSel.subject, buildSel.tiers, buildSel.kinds, buildSel.count);
  const rows=q.map((x,i)=>`<div class="prow" title="${esc(x.p.prompt||'')}"><span class="num">${String(i+1).padStart(2,'0')}</span>
      <div style="flex:1"><div class="ttl">${esc(x.p.subtitle)}</div><div style="font-size:12.5px;color:var(--mute)">${esc((TOPICS.find(t=>t.id===x.p.topic_id)||{}).name||'')}</div></div>
      <div class="why"><span class="chip ${esc(x.p.tier||'core')}">${TIER_LABEL[x.p.tier]||'core'}</span><span class="chip">${esc(x.p.kind||'drill')}</span><span class="chip ${x.why==='weak'?'weak':x.why==='due'?'due':x.why==='in batch'?'inbatch':x.why==='review'?'review':'new'}">${x.why}</span></div>
    </div>`).join('') || `<p style="color:var(--mute)">Nothing matches these filters — widen the tiers or kinds.</p>`;
  $('main').innerHTML=`<div class="kicker">Build a batch</div><h1 style="margin:4px 0 6px">Next best problems</h1>
    <p style="color:var(--mute);margin:0 0 18px">Ranked automatically: <b>weak spots</b> first, then problems <b>due for review</b>, then <b>new</b> ones in path order. Adjust and export.</p>
    <div class="card">
      <label>Subject</label><div class="pillbar" style="margin-bottom:14px">${sPills}</div>
      <label>Topic</label><div class="pillbar">${tPills}</div>
      <div class="formrow">
        <div><label>Tiers <span class="hint">· tap to include/exclude</span></label><div class="pillbar">${tierPills}</div></div>
        <div><label>Kinds <span class="hint">· tap to include/exclude</span></label><div class="pillbar">${kindPills}</div></div>
        <div><label>Count <span class="hint">· 1–20</span></label><input type="number" min="1" max="20" value="${buildSel.count}" style="width:80px" onchange="buildSel.count=Math.min(20,Math.max(1,parseInt(this.value)||5));renderBuild()"></div>
        <div><label for="wt-paper-size">Paper size</label><select id="wt-paper-size" onchange="buildSel.paper=this.value;try{localStorage.setItem('wt-paper',this.value);}catch(e){};renderBuild()">
          <option value="a4" ${buildSel.paper==='a4'?'selected':''}>A4 (Japan)</option>
          <option value="letter" ${buildSel.paper==='letter'?'selected':''}>US Letter</option></select></div>
      </div>
    </div>
    <div class="plist">${rows}</div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:18px">
      <button class="btn" id="export-btn" ${q.length&&!OFFLINE_MODE?'':'disabled'} onclick="exportBatch()" title="${OFFLINE_MODE?'Connect for tracked PDF export':''}">Export PDF ${DIR?'→ iPad folder':''}</button><a class="btn sm ghost" href="#quick">Quick Practice instead</a>
      ${DIR?'':DIR_PENDING?'<span style="font-size:13px;color:var(--mute)">Folder needs reconnecting after reload — <a href="#" onclick="reconnectDir();return false">reconnect '+esc(DIR_PENDING.name)+'</a> or export will download.</span>':'<span style="font-size:13px;color:var(--mute)">No folder linked — the PDF will download instead. <a href="#setup">Link your iCloud folder</a> for automatic export.</span>'}
    </div><div id="exp-msg" class="msg"></div>
    ${LAST_STUDENT_EXPORT?`<div id="student-download-actions" class="acts" style="margin-top:10px">
      <span style="font-size:12px;color:var(--mute)">${esc(LAST_STUDENT_EXPORT.filename)} — download again if iPad Safari blocked a file:</span>
      <button class="btn sm ghost" onclick="redownloadStudentFile('pdf')">PDF again</button>
      <button class="btn sm ghost" onclick="redownloadStudentFile('manifest')">Student manifest again</button>
    </div>`:''}
    ${GRADER_KEY_PENDING?`<div id="grd-pending-action" style="margin-top:10px"><button class="btn sm ghost" onclick="downloadGraderKey()">Download PRIVATE grader key</button></div>`:``}`;
}
window.tog=(set,val)=>{ const s=buildSel[set]; s.has(val)?(s.size>1&&s.delete(val)):s.add(val); renderBuild(); };
window.buildSel=buildSel; window.renderBuild=renderBuild; window.exportBatch=exportBatch;

/* ---------- home (phone-first dashboard) ----------
   Four tiles, in reading order: what is due and a Start, the streak, this
   week's accuracy, and the last sheet's marks. Numbers wear text colour; a
   coloured chip only marks state. */
let HOME_JP=false;
function renderHome(){
  const latest=latestByProblem();
  let weak=0, due=0; for(const p of PROBLEMS){ const c=pstatus(p,latest).code; if(c==='weak') weak++; else if(c==='due') due++; }
  const jp=(typeof JPS!=='undefined')?JPS:{};
  const jpReadyNow=!DEMO&&!OFFLINE_MODE&&typeof jpReady==='function'&&jpReady();
  if(jpReadyNow&&!HOME_JP&&typeof jpDueCount==='function'){ HOME_JP=true; jpDueCount().then(()=>{ if(location.hash==='#home'||(!location.hash&&matchMedia('(max-width:760px)').matches)) renderHome(); }); }
  const jpDue=jp.dueCount==null?null:jp.dueCount;
  // accuracy over the last 7 days: Cowork + ghost attempts, plus Japanese sheets from the local log
  const week=Date.now()-7*DAY; let ok=0, n=0;
  for(const a of ATTEMPTS){ if(new Date(a.graded_at).getTime()>=week){ n++; if(a.correct) ok++; } }
  if(typeof ghSessions==='function') for(const s of ghSessions()) if(s.src==='jp'&&s.ts>=week){ n+=s.n; ok+=s.right; }
  const acc=n?Math.round(ok/n*100):null;
  // last sheet: the newest ghost session on this device, else the newest graded ghost group, else the newest Cowork batch
  let last=null;
  const sess=typeof ghSessions==='function'?ghSessions()[0]:null;
  const ghostA=ATTEMPTS.filter(a=>a.graded_by==='ghost');
  if(sess&&(!ghostA.length||sess.ts>=new Date(ghostA[0].graded_at).getTime())) last={label:sess.label, when:sess.ts, items:sess.items.map(x=>({name:x.kanji||x.prompt, m:x.m})), action:sess.src==='jp'&&sess.right<sess.n?`<button class="btn sm ghost" onclick="ghRetrySession(0)">Retry the wrong ones</button>`:''};
  else if(ghostA.length){ const k=ghostA[0].topic_id+'|'+String(ghostA[0].graded_at).slice(0,16); const items=ghostA.filter(a=>a.topic_id+'|'+String(a.graded_at).slice(0,16)===k);
    last={label:(TOPICS.find(t=>t.id===ghostA[0].topic_id)||{}).name||'Ghost sheet', when:ghostA[0].graded_at, items:items.map(a=>({name:(PROBLEMS.find(p=>p.id===a.problem_id)||{subtitle:a.problem_id}).subtitle, m:a.correct?1:rating5(a.rating)>=3?2:3})), action:`<button class="btn sm ghost" onclick="ghPick('${esc(ghostA[0].topic_id)}');location.hash='ghost'">Open the sheet</button>`}; }
  else if(ATTEMPTS.length){ const a0=ATTEMPTS[0], day=String(a0.graded_at).slice(0,10), items=ATTEMPTS.filter(a=>String(a.graded_at).slice(0,10)===day);
    last={label:'Cowork feedback', when:a0.graded_at, items:items.map(a=>({name:(PROBLEMS.find(p=>p.id===a.problem_id)||{subtitle:a.problem_id}).subtitle, m:a.correct?1:3})), action:`<a class="btn sm ghost" href="#review">Open Review</a>`}; }
  const G=['','✓','△','✗'], C=['','ok','mid','bad'];
  const marks=last?last.items.slice(0,24).map(x=>`<li><span class="gh-mk ${C[x.m]||''}" aria-hidden="true">${G[x.m]||'·'}</span><span>${esc(x.name)}</span></li>`).join(''):'';
  const startJp=jpReadyNow&&jpDue?`<button class="btn sm" onclick="location.hash='ghost';setTimeout(()=>jpStartSequence(),50)">Start today's ${Math.min(jpDue,20)}</button>`:'';
  $('main').innerHTML=`<div class="kicker">Home</div><h1 style="margin:4px 0 14px">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</h1>
    <div class="tiles">
      <div class="tile">
        <div class="kicker">Due today</div>
        <div class="big">${weak+due+(jpDue||0)}</div>
        <div class="sub">${weak?`<span class="chip weak">${weak} weak</span> `:''}${due?`<span class="chip due">${due} due</span> `:''}${jpDue!=null?`<span class="chip">${jpDue} words</span>`:''}${!(weak+due+(jpDue||0))?'Nothing waiting — add new problems or write a sheet.':''}</div>
        <div class="acts"><a class="btn sm" href="#quick">Quick Practice</a><a class="btn sm ghost" href="#setup">Study offline</a><a class="btn sm ghost" href="#analytics">Learning trends</a><a class="btn sm ghost" href="#build">Build a batch</a>${startJp||`<a class="btn sm ghost" href="#ghost">Write a sheet</a>`}</div>
      </div>
      <div class="tile">
        <div class="kicker">Streak</div>
        <div class="big">${jp.streak||0}<small> day${jp.streak===1?'':'s'}</small></div>
        <div class="sub">${jpReadyNow?(jp.streak?'Writing sheets on consecutive days.':'Write a sheet today to start one.'):'Counted from your Japanese sheets once the database is connected.'}</div>
      </div>
      <div class="tile">
        <div class="kicker">Correct marks · 7 days</div>
        <div class="big">${acc==null?'—':acc+'<small>%</small>'}</div>
        <div class="sub">${n?`${ok} correct of ${n} recorded marks`:'No marks recorded this week yet.'} · Mixed assessment methods. <a href="#analytics">See separate trends</a>.</div>
      </div>
      <div class="tile wide">
        <div class="kicker">Last sheet</div>
        ${last?`<div class="sub" style="margin-bottom:6px"><b>${esc(last.label)}</b> · ${fmtDate(last.when)} · ${last.items.filter(x=>x.m===1).length} / ${last.items.length}</div><ul class="marks">${marks}</ul><div class="acts">${last.action}</div>`:'<div class="sub">Your most recent marks will show here.</div>'}
      </div>
    </div>`;
}

/* ---------- review ----------
   Cowork feedback stays one card per problem. Ghost sheets collapse to one card
   per session (same topic, same minute) and Japanese-database sheets come from
   the device's local session log, since they never enter written_test_attempts. */
let REV={topic:'all', wrong:false, batch:'all', limit:30, open:null};
window.REV=REV;
const fmtDate=d=>{ const x=new Date(d); return isNaN(x)?'—':x.toLocaleDateString(); };
function topicSubject(tid){ const t=TOPICS.find(x=>x.id===tid); return t?subjectOf(t):null; }
/* Build view pre-filtered to one topic: weak problems rank first, so a wrong answer lands at the top */
window.practise=tid=>{ buildSel.topic=tid; buildSel.subject=topicSubject(tid)||'all'; location.hash='build'; if(location.hash==='#build') renderBuild(); };
/* Phase 1: legacy batches predate deterministic grading IDs. Keep their
 * explicit manual status workflow; verify complete feedback for WT2 batches. */
let BATCH_COVERAGE={}, FEEDBACK_REFRESHING=false;
const phase1Batch=b=>!!b&&/^WT2_/.test(b.filename||'');
async function batchCoverage(b){
  const ids=await Promise.all([...new Set(b.problem_ids||[])].map(p=>WTWorksheet.attemptId(b.id,p)));
  if(!ids.length)throw new Error('Batch has no questions');
  const {data,error}=await sb.from('written_test_attempts').select('*').in('id',ids);
  if(error)throw error;
  const coverage=await WTWorksheet.coverage(b,data||[]);
  BATCH_COVERAGE[b.id]={...coverage,checkedAt:Date.now()};
  const found=new Set((data||[]).map(a=>a.id));
  ATTEMPTS=[...ATTEMPTS.filter(a=>!found.has(a.id)),...(data||[])].sort(
    (a,b)=>new Date(b.graded_at)-new Date(a.graded_at));
  return coverage;
}
window.checkBatchFeedback=async id=>{
  if(OFFLINE_MODE){toast('Grader verification requires a connection.',5000);return;}
  const b=BATCHES.find(x=>x.id===id);if(!b)return;
  if(!phase1Batch(b)){toast('Legacy batches use manual grading; use Refresh feedback to see new marks.',5500);return;}
  try{
    const coverage=await batchCoverage(b);
    toast(coverage.done+' of '+coverage.total+' grading results confirmed for '+b.filename,5500);
    REV.open=id;renderReview();
  }catch(e){toast('Could not check grading: '+(e.message||e),6500);}
};
window.refreshFeedback=async()=>{
  if(FEEDBACK_REFRESHING||DEMO||OFFLINE_MODE){if(OFFLINE_MODE)toast('Reconnect to refresh feedback.',5000);return;}
  FEEDBACK_REFRESHING=true;
  try{
    const [a,b]=await Promise.all([
      sb.from('written_test_attempts').select('*').order('graded_at',{ascending:false}),
      sb.from('written_test_batches').select('*').order('created_at',{ascending:false})
    ]);
    if(a.error||b.error)throw a.error||b.error;
    ATTEMPTS=a.data||[];BATCHES=b.data||[];
    BATCH_COVERAGE={};
    renderReview();toast('Feedback and batch status refreshed.');
  }catch(e){toast('Refresh failed; existing feedback kept: '+(e.message||e),6500);}
  finally{FEEDBACK_REFRESHING=false;}
};
window.setBatchStatus=async(id,status)=>{
  if(OFFLINE_MODE){toast('Changing batch status requires an online connection.',5500);return;}
  const b=BATCHES.find(x=>x.id===id);if(!b)return;
  if(status==='solved'){
    const ok=await ask({title:'Is your completed PDF in solved/?',
      body:'<p>Save the annotated PDF to <b>solved/</b> using the iPad Files app. This button records your confirmation; the browser cannot verify the iCloud folder on iPad Safari.</p>',
      ok:'Yes, saved in solved/',cancel:'Not yet'});
    if(!ok)return;
  }
  if(status==='graded'&&phase1Batch(b)&&!DEMO){
    try{
      const coverage=await batchCoverage(b);
      if(coverage.done!==coverage.total){
        toast('Not marked graded: '+coverage.done+' of '+coverage.total+' verified Cowork results. Check the grader first.',7500);
        REV.open=id;renderReview();return;
      }
    }catch(e){toast('Could not verify grading: '+(e.message||e),6500);return;}
  }
  if(!DEMO){
    const {error}=await sb.from('written_test_batches').update({status}).eq('id',id);
    if(error){toast('Could not update batch: '+error.message,5000);return;}
  }
  b.status=status;toast('Batch marked '+status+'.');renderReview();
};
function renderReview(){
  const topicName=id=>(TOPICS.find(t=>t.id===id)||{}).name||'';
  const latest=latestByProblem();
  const stars=r=>r?`<span class="stars" title="Rating ${rating5(r)} of 5" aria-label="Rating ${rating5(r)} of 5">${'★'.repeat(rating5(r))}${'☆'.repeat(5-rating5(r))}</span>`:'';
  const bRows=BATCHES.map(b=>{
    const open=REV.open===b.id;
    const probs=(b.problem_ids||[]).map(id=>{ const p=PROBLEMS.find(x=>x.id===id)||{subtitle:id}; const s=pstatus(p,latest);
      return `<li><span>${esc(p.subtitle)}</span><span class="chip ${s.code==='weak'?'weak':s.code==='due'?'due':s.code==='ok'?'ok':'new'}">${esc(s.label)}</span></li>`; }).join('');
    const next=b.status==='exported'?['solved','I saved it in solved/']:b.status==='solved'?['graded',phase1Batch(b)?'Confirm graded':'Mark graded (legacy)']:null;
    const c=BATCH_COVERAGE[b.id], done=c?c.done:0, total=c?c.total:(b.problem_ids||[]).length;
    const verifyBtn=phase1Batch(b)?`<button class="btn sm ghost" onclick="event.stopPropagation();checkBatchFeedback('${esc(b.id)}')">Check feedback${c?' ('+done+'/'+total+')':''}</button>`:'';
    const nextButton=next?`<button class="btn sm ghost" onclick="event.stopPropagation();setBatchStatus('${esc(b.id)}','${next[0]}')" ${next[0]==='graded'&&phase1Batch(b)&&(!c||c.done!==c.total)?'disabled title="Check feedback first"':''}>${next[1]}</button>`:'';
    return `<tr class="brow" tabindex="0" role="button" aria-expanded="${open}" onclick="REV.open=REV.open==='${esc(b.id)}'?null:'${esc(b.id)}';renderReview()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <td class="mono" style="font-size:12px">${esc(b.filename)}</td><td>${esc(topicName(b.topic_id)||'mixed')}</td><td>${(b.problem_ids||[]).length}</td><td><span class="chip status-${esc(b.status)}">${esc(b.status)}</span></td><td style="color:var(--mute)">${fmtDate(b.created_at)}</td></tr>
      ${open?`<tr class="bopen"><td colspan="5"><ul class="blist">${probs||'<li style="color:var(--mute)">No problems recorded for this batch.</li>'}</ul>
        <div class="acts">${nextButton}${verifyBtn}<button class="btn sm ghost" onclick="event.stopPropagation();REV.batch='${esc(b.id)}';REV.open=null;renderReview()">Show its feedback</button></div>
        ${phase1Batch(b)?`<p style="font-size:12px;color:var(--mute)">${c?'Verified '+done+' of '+total+' grading results':'Use Check feedback after Cowork processes the solved PDF. Only verified complete batches can be marked graded.'}</p>`:''}</td></tr>`:''}`;
  }).join('');
  // ---- feedback entries
  let list=ATTEMPTS.filter(a=>(REV.topic==='all'||a.topic_id===REV.topic)&&(!REV.wrong||!a.correct));
  if(REV.batch!=='all'){ const b=BATCHES.find(x=>x.id===REV.batch); const ids=new Set(b?b.problem_ids:[]); list=list.filter(a=>ids.has(a.problem_id)); }
  const entries=[], groups={};
  for(const a of list){
    if(a.graded_by==='ghost'){ const k=a.topic_id+'|'+String(a.graded_at).slice(0,16); if(!groups[k]){ groups[k]={kind:'ghost', topic_id:a.topic_id, graded_at:a.graded_at, items:[]}; entries.push(groups[k]); } groups[k].items.push(a); }
    else entries.push({kind:'fb', a, graded_at:a.graded_at});
  }
  if(REV.batch==='all'&&REV.topic==='all'&&typeof ghSessions==='function')
    ghSessions().forEach((s,i)=>{ if(s.src==='jp'&&(!REV.wrong||s.right<s.n)) entries.push({kind:'jp', s, i, graded_at:new Date(s.ts).toISOString()}); });
  entries.sort((x,y)=>new Date(y.graded_at)-new Date(x.graded_at));
  const shown=entries.slice(0,REV.limit);
  const fb=shown.map(e=>{
    if(e.kind==='fb'){ const a=e.a, p=PROBLEMS.find(x=>x.id===a.problem_id)||{subtitle:a.problem_id}, t=TOPICS.find(x=>x.id===a.topic_id)||{};
      return `<div class="fb" style="border-left-color:${a.correct?'var(--ok)':'var(--red)'}" role="link" tabindex="0" onclick="location.hash='topic/${esc(a.topic_id||'')}'" onkeydown="if(event.key==='Enter')this.click()" title="Open ${esc(t.name||'topic')}">
        <div class="head"><b>${esc(p.subtitle)}</b><span class="chip">${esc(t.name||'')}</span><span class="chip ${a.correct?'ok':'weak'}">${a.correct?'correct':'wrong'}</span>${a.pending_local?'<span class="chip due">Saved locally · pending sync</span>':''}${stars(a.rating)}
          <span style="margin-left:auto;font-size:11.5px;color:var(--mute)" class="mono">${esc(a.graded_by||'')} · ${fmtDate(a.graded_at)}</span></div>
        ${a.notes?`<div class="notes">${esc(a.notes)}</div>`:''}
        ${a.correct?'':`<div class="acts"><button class="btn sm ghost" onclick="event.stopPropagation();practise('${esc(a.topic_id)}')">Practise again</button></div>`}</div>`; }
    if(e.kind==='ghost'){ const n=e.items.length, right=e.items.filter(a=>a.correct).length, wrong=e.items.filter(a=>!a.correct);
      const names=wrong.map(a=>esc((PROBLEMS.find(x=>x.id===a.problem_id)||{subtitle:a.problem_id}).subtitle)).join(' · ');
      return `<div class="fb" style="border-left-color:${wrong.length?'var(--amber)':'var(--ok)'}" role="link" tabindex="0" onclick="ghPick('${esc(e.topic_id)}');location.hash='ghost'" onkeydown="if(event.key==='Enter')this.click()" title="Open this sheet in the ghost test">
        <div class="head"><b>Ghost sheet · ${esc(topicName(e.topic_id)||e.topic_id)}</b><span class="chip ${wrong.length?'due':'ok'}">${right} / ${n}</span><span class="chip">${n} words</span>${e.items.some(a=>a.pending_local)?'<span class="chip due">Saved locally · pending sync</span>':''}
          <span style="margin-left:auto;font-size:11.5px;color:var(--mute)" class="mono">ghost · ${fmtDate(e.graded_at)}</span></div>
        <div class="notes">${wrong.length?'To review: '+names:'Every word right.'}</div></div>`; }
    const s=e.s, wrong=s.items.filter(x=>x.m!==1);
    return `<div class="fb" style="border-left-color:${wrong.length?'var(--amber)':'var(--ok)'}">
      <div class="head"><b>Ghost sheet · ${esc(s.label)}</b><span class="chip">Japanese database</span><span class="chip ${wrong.length?'due':'ok'}">${s.right} / ${s.n}</span>
        <span style="margin-left:auto;font-size:11.5px;color:var(--mute)" class="mono">ghost · ${fmtDate(e.graded_at)}</span></div>
      <div class="notes">${wrong.length?'To review: '+wrong.map(x=>`<span class="jpw">${esc(x.kanji||x.prompt)}<small>${x.rev?'書':'読'}</small></span>`).join(' '):'Every word right.'}</div>
      ${wrong.length?`<div class="acts"><button class="btn sm ghost" onclick="ghRetrySession(${e.i})">Retry the ${wrong.length} wrong</button></div>`:''}</div>`;
  }).join('') || `<p style="color:var(--mute)">${entries.length||ATTEMPTS.length?'Nothing matches these filters.':'No feedback yet. Export a batch, solve it on your iPad, drop it in <span class="mono">solved/</span> — Cowork\'s feedback lands here.'}</p>`;
  // ---- filter bar
  const tids=[...new Set(ATTEMPTS.map(a=>a.topic_id).filter(Boolean))];
  const tPills=[['all','All topics'],...tids.map(id=>[id,topicName(id)||id])].map(([id,name])=>`<button class="pill-t ${REV.topic===id?'on':''}" aria-pressed="${REV.topic===id}" onclick="REV.topic='${esc(id)}';REV.limit=30;renderReview()">${esc(name)}</button>`).join('');
  const bsel=REV.batch!=='all'?`<button class="pill-t on" onclick="REV.batch='all';renderReview()" title="Clear batch filter">batch: ${esc((BATCHES.find(x=>x.id===REV.batch)||{}).filename||'?')} ✕</button>`:'';
  $('main').innerHTML=`<div class="kicker">Review</div><h1 style="margin:4px 0 6px">Batches & feedback</h1>
    <p style="color:var(--mute);margin:0 0 18px">Cowork feedback and self-checked practice appear here. ${ATTEMPTS.some(a=>a.pending_local)?'<strong>Some results are saved locally and not yet synced.</strong>':''} Tap a batch to see its problems.</p>
    ${BATCHES.length?`<div class="card" style="margin-bottom:18px;padding:10px 16px;overflow-x:auto"><table class="tbl"><thead><tr><th>File</th><th>Topic</th><th>Problems</th><th>Status</th><th>Exported</th></tr></thead><tbody>${bRows}</tbody></table></div>`:''}
    <div class="acts" style="margin:4px 0 16px"><button class="btn sm ghost" onclick="refreshFeedback()" ${DEMO||OFFLINE_MODE?'disabled':''}>Refresh feedback from Supabase</button><span style="font-size:12px;color:var(--mute)">Shows results recorded by Cowork; no iPad folder access required</span></div>
    <div style="margin:0 0 14px"><a class="btn sm ghost" href="#analytics">View learning analytics</a></div>
    <h2 style="margin:0 0 8px">Feedback</h2>
    <div class="revbar">${tPills}<button class="pill-t ${REV.wrong?'on':''}" aria-pressed="${REV.wrong}" onclick="REV.wrong=!REV.wrong;REV.limit=30;renderReview()">${REV.wrong?'✓ ':''}Wrong only</button>${bsel}</div>
    ${fb}
    ${entries.length>REV.limit?`<div style="display:flex;align-items:center;gap:12px;margin-top:12px"><button class="btn sm ghost" onclick="REV.limit+=30;renderReview()">Load more</button><span style="font-size:12.5px;color:var(--mute)">Showing ${shown.length} of ${entries.length}</span></div>`:''}`;
}

function renderSetup(){
  $('main').innerHTML=`<div class="kicker">Settings</div><h1 style="margin:4px 0 14px">Settings</h1>
    <div class="card account" style="margin:4px 0 18px">
      <h2 style="margin:0 0 4px">Account</h2>
      <p style="margin:0 0 14px;color:var(--soft);font-size:13.5px">${DEMO?'You are exploring with sample data — nothing is saved.':OFFLINE_MODE?'Studying offline as <b>'+esc(whoText())+'</b>. Your access is not being rechecked until you reconnect.':'Signed in as <b>'+esc(whoText())+'</b>'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn sm ghost danger" onclick="signOut()">${DEMO?'Leave demo':OFFLINE_MODE?'Lock offline access':'Sign out'}</button>
        ${INSTALL_EVT?'<button class="btn sm" onclick="installApp()">Install app</button>':''}
      </div>
      ${STANDALONE||INSTALLED?'':INSTALL_EVT?'<p style="margin:12px 0 0;font-size:12.5px;color:var(--mute)">Install adds Learning Hub to your home screen; it opens full screen and starts offline.</p>':IOS?'<p style="margin:12px 0 0;font-size:12.5px;color:var(--mute)">To install on iPhone or iPad: Share → <b>Add to Home Screen</b>. It opens full screen and starts offline.</p>':''}
    </div>
    <div class="card wt-offline-card" style="margin:0 0 18px" aria-label="Study offline">
      <h2 style="margin:0 0 6px">Study offline on iPad</h2>
      <p style="font-size:13px;color:var(--soft)">Download the app and your current Library while connected. Open this same Home Screen app with no internet, then practise with Apple Pencil or Quick Practice. No website data will be cleared.</p>
      <div class="acts" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <button class="btn sm" type="button" onclick="downloadOfflineStudy()" ${DEMO||OFFLINE_MODE?'disabled':''}>Download study offline</button>
        ${OFFLINE_MODE?'<button class="btn sm ghost" type="button" onclick="reconnectStudyOnline()">Reconnect online</button>':''}
        <button class="btn sm ghost" type="button" onclick="exportOfflinePending()" ${DEMO?'disabled':''}>Export pending results</button>
      </div>
      <p id="offline-status" class="wt-offline-status" role="status" aria-live="polite">${OFFLINE_MODE?'Offline pack in use · results remain on this device':'Checking downloaded files…'}</p>
      <p class="wt-offline-hint">A Ready offline label requires the complete asset download and a previously verified account on this device. Downloads can resume after interruption. Safari and the installed Home Screen app may have separate storage. Local data is not encrypted, so avoid shared devices.</p>
    </div>
    <h2 style="margin:0 0 4px">How the loop works</h2>
    <div class="flow">
      <div class="node"><b>Build & export</b><span>PDF + manifest → outbox/</span></div><div class="arr">→</div>
      <div class="node"><b>iCloud syncs</b><span>folder appears on iPad</span></div><div class="arr">→</div>
      <div class="node"><b>Solve on iPad</b><span>Apple Pencil, save to solved/</span></div><div class="arr">→</div>
      <div class="node"><b>Cowork grades</b><span>writes feedback to Supabase</span></div><div class="arr">→</div>
      <div class="node"><b>Smarter batch</b><span>weak → due → new</span></div>
    </div>
    <div class="card"><h2 style="margin-bottom:14px">One-time setup</h2>
      <div class="steps">
        <div class="step"><div>Run <span class="mono">sql/schema.sql</span> in the Supabase SQL editor (adds tiers, kinds and batch tracking).</div></div>
        <div class="step"><div>Create a folder in <b>iCloud Drive</b>, e.g. <span class="mono">iCloud Drive/WrittenTest</span>, then link it here: <div style="margin-top:8px;display:flex;gap:10px;align-items:center">${DIR_PENDING&&!DIR?'<button class="btn sm" onclick="reconnectDir()">Reconnect '+esc(DIR_PENDING.name)+'</button>':''}<button class="btn sm ${DIR_PENDING&&!DIR?'ghost':''}" onclick="linkFolder()">${DIR?'Re-link folder':'Link folder'}</button><span class="mono" style="font-size:12px;color:${DIR?'var(--ok)':'var(--amber)'}">${DIR?'✓ linked: '+esc(DIR.name):DIR_PENDING?'needs one click to reconnect after reload':'Not linked yet'}</span></div>
          <div style="font-size:12.5px;color:var(--mute);margin-top:6px">The app creates <span class="mono">outbox/ · solved/ · graded/ · grader/</span> inside it and drops <span class="mono">COWORK_TASK.md</span> for the grader. Answers only ever go to <span class="mono">grader/</span>, never next to the sheet.</div></div></div>
        <div class="step"><div>Open <b>Claude Cowork</b> on your Mac and give it <span class="mono">COWORK_TASK.md</span>. If your folder was linked before this release, <button class="btn sm ghost" onclick="refreshGraderTask()">Update grading instructions</button> to enable the new retry-safe v2 workflow. Store the Supabase <b>service role key</b> at <span class="mono">~/.config/writtentest/service_role_key</span> — never inside the synced folder.</div></div>
        <div class="step"><div>On the iPad: Files app → iCloud Drive → WrittenTest. Solve PDFs from <span class="mono">outbox/</span> with the Pencil (Markup), then save them into <span class="mono">solved/</span>. In Review, confirm <b>I saved it in solved/</b>, then choose <b>Check feedback</b> after grading.</div></div><div class="step"><div><b>iPad Safari:</b> Direct folder linking is unavailable. Export the PDF and student-safe .json, move them to outbox/ with the Files app, and download the separate PRIVATE grader file only when needed. Keep that private key in grader/ (never outbox/). Refresh feedback after Cowork finishes.</div></div>
      </div>
    </div>
`;
  updateOfflineStatus();
}
window.refreshGraderTask=async()=>{
  try{
    if(DIR){
      await writeText(DIR,'COWORK_TASK.md',coworkTask());
      toast('COWORK_TASK.md updated with the Phase 1 grading contract.',5500);
    }else{
      download(new Blob([coworkTask()],{type:'text/markdown;charset=utf-8'}),'COWORK_TASK.md');
      toast('Grader task downloaded. Put it beside the grader/ folder on your PC; do not include the service key.',6500);
    }
  }catch(e){toast('Could not update grader instructions: '+(e.message||e),6500);}
};
window.linkFolder=linkFolder;

/* ---------- folder ---------- */
async function restoreDir(){
  try{ const h=await idb.get('dir'); if(!h) return;
    const st=await h.queryPermission({mode:'readwrite'});
    if(st==='granted') DIR=h; else if(st==='prompt') DIR_PENDING=h; // Chrome forgets the grant per session: one click re-arms it
  }catch(e){}
}
/* must run inside a user gesture (click) — requestPermission is refused otherwise */
async function reconnectDir(){
  if(!DIR_PENDING) return false;
  try{ if(await DIR_PENDING.requestPermission({mode:'readwrite'})==='granted'){ DIR=DIR_PENDING; DIR_PENDING=null; return true; } }catch(e){}
  return false;
}
window.reconnectDir=async()=>{ if(await reconnectDir()){ toast('Folder reconnected.'); route(); } else toast('Could not reconnect — use Link folder to pick it again.', 5000); };
async function linkFolder(){
  if(DEMO){ toast('Demo mode — folder linking disabled.'); return; }
  if(!window.showDirectoryPicker){ toast('This browser cannot link folders — use Chrome or Edge.', 5000); return; }
  try{
    const h=await window.showDirectoryPicker({mode:'readwrite'});
    for(const n of ['outbox','solved','graded','grader']) await h.getDirectoryHandle(n,{create:true});
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
let EXPORTING=false, GRADER_KEY_PENDING=null, LAST_STUDENT_EXPORT=null;
window.redownloadStudentFile=kind=>{
  const x=LAST_STUDENT_EXPORT;
  if(!x){toast('Export a worksheet first.');return;}
  if(kind==='pdf')download(x.pdf,x.filename);
  else if(kind==='manifest')download(new Blob([x.manifest],{type:'application/json'}),x.manifestName);
};
/* Grader keys contain answers. Download them separately and only after
   explicit confirmation, never beside student-facing PDF/manifest by default. */
window.downloadGraderKey=async()=>{
  if(!GRADER_KEY_PENDING){toast('No grader key pending. Export a batch first.');return;}
  const ok=await ask({title:'Download PRIVATE grader answer key?',
    body:'<p>This JSON contains reference answers. Move it into a private <b>grader/</b> folder, never beside the student PDF or manifest.</p>',
    ok:'Download private key',cancel:'Not now'});
  if(!ok)return;
  download(new Blob([GRADER_KEY_PENDING.content],{type:'application/json'}),GRADER_KEY_PENDING.name);
  toast('Private grader key downloaded separately. Keep it out of outbox/.',6000);
};
async function exportBatch(){
  if(OFFLINE_MODE){toast('PDF batch tracking requires an online connection. Use Quick Practice or Ghost Test offline.',6000);return;}
  if(EXPORTING) return;
  const q=queue(buildSel.topic, buildSel.subject, buildSel.tiers, buildSel.kinds, buildSel.count);
  if(!q.length) return;
  const m=$('exp-msg'); m.className='msg'; m.textContent='Building PDF…';
  const btn=$('export-btn'); EXPORTING=true; if(btn){ btn.disabled=true; btn.textContent='Exporting…'; }
  try{ await exportBatchNow(q, m); }
  catch(e){ m.className='msg err'; m.textContent='Export failed: '+(e.message||e); }
  finally{ EXPORTING=false; if(btn&&btn.isConnected){ btn.disabled=false; btn.textContent='Export PDF '+(DIR?'→ iPad folder':''); } }
}
async function exportBatchNow(q, m){
  const now=new Date();
  const two=n=>String(n).padStart(2,'0');
  const stamp=`${now.getFullYear()}${two(now.getMonth()+1)}${two(now.getDate())}_${two(now.getHours())}${two(now.getMinutes())}`; // local time, matches the Review table
  const topicSlug=buildSel.topic!=='smart'?buildSel.topic:(buildSel.subject!=='all'?buildSel.subject+'_mix':'mix');
  const safeTopic=String(topicSlug).replace(/[^a-z0-9_-]/gi,'_').slice(0,45);
  if(!crypto.randomUUID) throw new Error('Secure connection required for batch IDs');
  const batchId=crypto.randomUUID();
  const fname=`WT2_${safeTopic}_${stamp}_${batchId.slice(0,8)}.pdf`;
  if(!DIR&&DIR_PENDING) await reconnectDir(); // still inside the click's user activation
  const blob=await makePdf(q, fname, batchId);
  const jname=fname.replace(/\.pdf$/,'.json');
  // Student and private grader payloads are created by the same versioned contract.
  // A stable grade attempt ID enables retry-safe Cowork grading and batch verification.
  const artifacts=await WTWorksheet.manifests({batchId,userId:DEMO?'demo':SESSION.user.id,
    createdAt:now.toISOString(),filename:fname,questions:q});
  const manifest=artifacts.student, key=artifacts.grader;
  // A student file must not be published without a tracked batch.
  const batchRow={id:batchId,topic_id:buildSel.topic==='smart'?null:buildSel.topic,
    problem_ids:q.map(x=>x.p.id),filename:fname,status:'exported',created_at:now.toISOString()};
  if(!DEMO){
    const {error}=await sb.from('written_test_batches').insert({
      id:batchId,topic_id:batchRow.topic_id,problem_ids:batchRow.problem_ids,filename:fname
    });
    if(error)throw new Error('Batch tracking failed; no student files exported. '+error.message);
  }
  BATCHES.unshift(batchRow);
  let dest='downloaded', written=false;
  if(DIR){
    try{
      const out=await DIR.getDirectoryHandle('outbox',{create:true});
      const gr=await DIR.getDirectoryHandle('grader',{create:true});
      // Private key and student manifest must exist before publishing the PDF
      // that triggers the grader's folder watcher.
      await writeText(gr, jname, key);
      await writeText(out, jname, manifest);
      const fh=await out.getFileHandle(fname,{create:true});
      const w=await fh.createWritable(); await w.write(blob); await w.close();
      dest='outbox/ (syncing to iPad)'; written=true;
    }catch(e){ toast('Folder write failed ('+e.message+') — downloading instead.', 5000); }
  }
  if(!written){
    LAST_STUDENT_EXPORT={filename:fname,pdf:blob,manifestName:jname,manifest};
    GRADER_KEY_PENDING={name:fname.replace(/\.pdf$/,'.grader.json'),content:key};
    download(blob, fname);
    download(new Blob([manifest],{type:'application/json'}), jname); // student-safe: no answer fields
    dest='student files requested for download; use separate buttons if Safari blocks a file';
  } else {GRADER_KEY_PENDING=null; LAST_STUDENT_EXPORT=null;}

  m.className='msg ok';
  m.textContent=`${fname} → ${dest}. Solve the PDF on your iPad and save it into solved/.`;
  const oldStudent=$('student-download-actions'); if(oldStudent)oldStudent.remove();
  if(LAST_STUDENT_EXPORT){
    const actions=document.createElement('div'); actions.id='student-download-actions'; actions.className='acts';
    actions.style.marginTop='10px';
    actions.append(document.createTextNode('If Safari blocked a file, download it separately:'));
    for(const [kind,label] of [['pdf','PDF again'],['manifest','Student manifest again']]){
      const b=document.createElement('button');b.className='btn sm ghost';b.textContent=label;
      b.addEventListener('click',()=>redownloadStudentFile(kind));actions.appendChild(b);
    }
    m.insertAdjacentElement('afterend',actions);
  }
  const oldButton=$('grd-pending-action'); if(oldButton)oldButton.remove();
  if(GRADER_KEY_PENDING){
    m.append(document.createTextNode(' Private answers were NOT included in student downloads.'));
    const wrap=document.createElement('div'); wrap.id='grd-pending-action'; wrap.style.marginTop='10px';
    const b=document.createElement('button'); b.className='btn sm ghost';
    b.textContent='Download PRIVATE grader answer key'; b.addEventListener('click',downloadGraderKey);
    wrap.appendChild(b); m.insertAdjacentElement('afterend',wrap);
  }
}
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }

/* Embedded font for anything outside Latin-1 (kanji, kana, →, −, ⁴ …): jsPDF's
   built-in fonts are WinAnsi only. Fetched once per session, ~1 MB. */
let PDF_FONT=null;
async function pdfFont(){
  if(PDF_FONT) return PDF_FONT;
  const r=await fetch('fonts/NotoSansJP-Regular.ttf'); if(!r.ok) throw new Error('font '+r.status);
  const u=new Uint8Array(await r.arrayBuffer()); let b='';
  for(let i=0;i<u.length;i+=0x8000) b+=String.fromCharCode.apply(null, u.subarray(i,i+0x8000));
  return PDF_FONT=btoa(b);
}
async function makePdf(q, fname, batchId){
  const {jsPDF}=window.jspdf;
  const format=buildSel.paper==='letter'?'letter':'a4';
  const doc=new jsPDF({unit:'pt',format});
  const PAGE_W=doc.internal.pageSize.getWidth(), PAGE_H=doc.internal.pageSize.getHeight();
  const M=48, W=PAGE_W-2*M, LH=16, GRID_END=PAGE_H-140, MIN_GRID=145;
  const text=q.map(x=>[x.p.subtitle,x.p.prompt,x.p.given_data,(TOPICS.find(z=>z.id===x.p.topic_id)||{}).name].join(' ')).join(' ');
  let F='helvetica',FM='courier';
  if(/[^\u0000-\u00ff]/.test(text)){
    // Do not silently produce unreadable Japanese/math PDFs when the font fetch fails.
    try{
      doc.addFileToVFS('NotoSansJP.ttf',await pdfFont());
      doc.addFont('NotoSansJP.ttf','NotoSansJP','normal');
      doc.addFont('NotoSansJP.ttf','NotoSansJP','bold');
      F=FM='NotoSansJP';
    }catch(e){ throw new Error('Unicode PDF font unavailable. Reconnect and retry; no worksheet exported. '+(e.message||e)); }
  }
  const fit=(t,width)=>{
    let out=String(t||'');
    while(out.length>1&&doc.getTextWidth(out)>width)out=out.slice(0,-1);
    return out===String(t||'')?out:out.replace(/.{0,3}$/,'')+'...';
  };
  const footer=(i,p,continued)=>{
    doc.setFont('courier','normal');doc.setFontSize(7.2);doc.setTextColor(125);
    doc.text('batch:'+batchId, M, PAGE_H-34);
    doc.text('problem:'+String(p.id),M,PAGE_H-22);
    doc.text((i+1)+' / '+q.length+(continued?' (cont.)':''),PAGE_W-M,PAGE_H-24,{align:'right'});
  };
  const header=(i,p,t,continued)=>{
    doc.setFont('helvetica','bold');doc.setFontSize(27);doc.setTextColor(35,105,78);
    doc.text(String(i+1).padStart(2,'0'),M,73);
    doc.setFont(FM,'normal');doc.setFontSize(10);doc.setTextColor(92);
    const kick=((t.name||p.topic_id||'Practice')+' · '+(TIER_LABEL[p.tier]||'core')+' / '+(p.kind||'drill')+
      (continued?' · continued':'')).toUpperCase();
    doc.text(fit(kick,W-64),M+56,70);
    doc.setFont(F,'bold');doc.setFontSize(12);doc.setTextColor(28,35,32);
    const titleLines=doc.splitTextToSize(p.subtitle||'Practice',W);
    const shortTitle=titleLines.slice(0,2);
    if(titleLines.length>2)shortTitle[1]=fit(shortTitle[1]+'...',W);
    doc.text(shortTitle,M,97);
    const lineY=108+shortTitle.length*14;
    doc.setDrawColor(28,35,32);doc.setLineWidth(1);
    doc.line(M,lineY,PAGE_W-M,lineY);
    footer(i,p,continued);
    return lineY+18;
  };
  const newPage=(i,p,t)=>{
    doc.addPage();
    return header(i,p,t,true);
  };
  q.forEach((x,i)=>{
    if(i)doc.addPage();
    const p=x.p,t=TOPICS.find(z=>z.id===p.topic_id)||{};
    let y=header(i,p,t,false);
    doc.setFont(F,'normal');doc.setFontSize(12);doc.setTextColor(28,35,32);
    const lines=doc.splitTextToSize(p.prompt||'',W);
    while(lines.length){
      const space=Math.floor((GRID_END-MIN_GRID-y-12)/LH);
      if(space<1){y=newPage(i,p,t);doc.setFont(F,'normal');doc.setFontSize(12);doc.setTextColor(28,35,32);continue;}
      const chunk=lines.splice(0,space);
      doc.text(chunk,M,y);
      y+=chunk.length*LH;
      if(lines.length){y=newPage(i,p,t);doc.setFont(F,'normal');doc.setFontSize(12);doc.setTextColor(28,35,32);}
    }
    y+=12;
    if(p.given_data){
      doc.setFont(FM,'normal');doc.setFontSize(10);
      const given=doc.splitTextToSize('GIVEN  '+String(p.given_data),W-24);
      while(given.length){
        const space=Math.floor((GRID_END-MIN_GRID-y-36)/14);
        if(space<1){y=newPage(i,p,t);doc.setFont(FM,'normal');doc.setFontSize(10);continue;}
        const chunk=given.splice(0,space),height=chunk.length*14+20;
        doc.setFillColor(247,251,253);doc.setDrawColor(224,220,208);doc.setLineWidth(.8);
        doc.roundedRect(M,y,W,height,3,3,'FD');
        doc.setFont(FM,'normal');doc.setFontSize(10);doc.setTextColor(35,105,78);
        doc.text(chunk,M+12,y+17);
        y+=height+12;
        if(given.length){y=newPage(i,p,t);doc.setFont(FM,'normal');doc.setFontSize(10);}
      }
    }
    if(y+MIN_GRID>GRID_END)y=newPage(i,p,t);
    doc.setFont('courier','normal');doc.setFontSize(8);doc.setTextColor(140);
    doc.text('WORK AREA - SHOW EVERY STEP',M,y+10);
    doc.setDrawColor(222,232,238);doc.setLineWidth(.5);
    for(let gy=y+26;gy<GRID_END;gy+=22)doc.line(M,gy,PAGE_W-M,gy);
    doc.setFontSize(8);doc.setTextColor(120);
    doc.text('ANSWER',M,PAGE_H-112);
    doc.setDrawColor(70,82,75);doc.setLineWidth(.8);
    doc.line(M,PAGE_H-90,PAGE_W-M,PAGE_H-90);
    doc.line(M,PAGE_H-66,PAGE_W-M,PAGE_H-66);
  });
  doc.setProperties({title:fname,subject:'Learning Hub worksheet '+batchId});
  return doc.output('blob');
}

/* ---------- cowork task (written into the linked folder) ---------- */
function coworkTask(){
  const uid=DEMO?'<your-user-id>':SESSION.user.id;
  return `# Learning Hub — grading instructions

This task belongs to the Writing Test / Learning Hub application. Preserve the original handwritten PDF.

## Folder roles
- outbox/: student-facing worksheet PDFs and .json manifests (NO answers).
- grader/: PRIVATE answer manifests (.json from linked export or .grader.json from explicit download). Contains answers, worked solutions, and v2 attempt_id values.
- solved/: annotated PDFs saved by the learner via the iPad Files app. New files trigger grading.
- graded/: move the solved PDFs here only after confirmed results.

## Process a completed PDF
1. Match the solved PDF to the private grader manifest and cross-check batch ID and problem ID printed in each PDF footer. Never use outbox/ as an answer key.
2. Grade each answer from the visible handwriting: method, correctness, specific mistakes, and suggestions. Do not invent work where a page is blank.
3. For manifest_version=2, each private problem includes a stable attempt_id. Use it verbatim as the UUID id on the written_test_attempts row; this makes retries update an existing record rather than insert a duplicate.
4. Upsert each v2 result to the General_apps project at /rest/v1/written_test_attempts?on_conflict=id with HTTP POST and the header Prefer: resolution=merge-duplicates,return=minimal. Each row must contain id=attempt_id, problem_id, topic_id, user_id=${uid}, correct, rating (1 to 5), score, max_score, notes, graded_by=cowork, and graded_at in ISO format.
5. Use the Supabase service-role key only from the local unsynced ~/.config/writtentest/service_role_key. NEVER put that key in an iCloud folder, the PDF, a manifest, a log, a web app or GitHub. Stop on access errors.
6. Read back all expected attempt_id rows using authenticated, authorized access. Only after every problem has a confirmed Cowork result may you set the written_test_batches status to graded and set graded_at. Do NOT declare completion based merely on a successful upload response.
7. If any attempt is missing or cannot be verified, keep the batch solved and its PDF in solved/. Report what failed and leave the remaining items for later.
8. Once all results are verified, move the annotated PDF from solved/ to graded/. The learner can use Review → Check feedback for v2 batches and Refresh feedback to retrieve the graded work.

Rating: 5 flawless · 4 correct with minor slips · 3 correct but shaky method · 2 incorrect with a sound idea · 1 incorrect.

## iPad Safari manual flow
Safari does not support the desktop folder-link API. Export student PDF and safe .json manifest via Downloads, then use Files to move both into the iCloud outbox/ folder. Export the PRIVATE answer key only when needed and put it in grader/ (never outbox/).

## Legacy batches
Legacy WT_ PDFs may not have stable attempt_id values. Do not invent IDs and do not assume legacy regrading is idempotent; flag retries for manual confirmation.

Never change the Supabase schema, RLS policies or authentication. Never reveal the service-role key.`;
}

/* ---------- Phase 6 offline download, status and private recovery ---------- */
async function updateOfflineStatus(){
  const el=$('offline-status');if(!el||!window.WTOffline)return;
  try{
    const owner=SESSION&&SESSION.user&&SESSION.user.id;
    const p=owner&&await WTOffline.pack(owner);
    const jobs=owner?await WTOffline.pending(owner):[];
    const ready=owner&&await WTOffline.enrolled(owner)&&await WTOffline.assetsReady();
    if(!el.isConnected||OFFLINE_DOWNLOAD_BUSY)return;
    el.textContent=(ready?'Ready offline':'Not ready offline')+
      (p&&p.version===WTOffline.version?' · '+p.problems.length+' saved problems · updated '+
        new Date(p.savedAt).toLocaleString():' · no current study pack')+
      ' · '+jobs.length+' pending session(s)';
  }catch(e){if(el.isConnected)el.textContent='Offline status unavailable: '+e.message;}
}
window.downloadOfflineStudy=async()=>{
  if(OFFLINE_DOWNLOAD_BUSY||OFFLINE_MODE||DEMO||!SESSION||!window.WTOffline)return;
  const el=$('offline-status'),btn=document.querySelector('.wt-offline-card button');
  OFFLINE_DOWNLOAD_BUSY=true;
  if(btn)btn.disabled=true;
  try{
    if(el)el.textContent='Checking current app files…';
    const result=await WTOffline.cacheAssets(info=>{
      if(el&&el.isConnected)el.textContent='Downloading '+info.done+'/'+info.total+
        ' files · '+info.remaining+' remaining · '+(info.bytes/1048576).toFixed(1)+' MB saved so far';
    });
    const p={version:WTOffline.version,id:SESSION.user.id,email:SESSION.user.email,
      role:ROLE,verified:true,savedAt:new Date().toISOString(),
      subjects:SUBJECTS,topics:TOPICS,problems:PROBLEMS,
      attempts:ATTEMPTS.filter(a=>!a.pending_local),batches:BATCHES};
    await WTOffline.savePack(p);
    toast('Ready offline: '+p.problems.length+' problems and '+
      result.files+' app files ('+(result.bytes/1048576).toFixed(1)+' MB).',6500);
  }catch(e){
    toast('Offline download incomplete; previously saved data was kept: '+(e.message||e),8500);
    if(el&&el.isConnected)el.textContent='Download incomplete — retry to resume missing files. '+(e.message||e);
  }finally{
    OFFLINE_DOWNLOAD_BUSY=false;if(btn&&btn.isConnected)btn.disabled=false;
    updateOfflineStatus();
  }
};
window.exportOfflinePending=async()=>{
  if(DEMO||!SESSION||!window.WTOffline)return;
  try{
    const jobs=await WTOffline.pending(SESSION.user.id);
    if(!jobs.length){toast('No pending offline sessions to export.',4500);return;}
    const ok=await ask({title:'Export private offline results?',
      body:'<p>This JSON contains your answers, marks, account ID and possibly Japanese writing records. Keep it private. Exporting does not upload, acknowledge or delete any pending session.</p>',
      ok:'Export private backup',cancel:'Not now'});
    if(!ok)return;
    const blob=new Blob([JSON.stringify({format:'wt-offline-pending-v6',
      owner:SESSION.user.id,exportedAt:new Date().toISOString(),sessions:jobs},null,2)],
      {type:'application/json'});
    download(blob,'LearningHub_pending_'+new Date().toISOString().slice(0,10)+'.json');
    toast('Private pending-results backup downloaded. Results remain queued.',6500);
  }catch(e){toast('Could not export pending results: '+(e.message||e),7500);}
};
window.reconnectStudyOnline=async()=>{
  if(!OFFLINE_MODE)return;
  if(navigator.onLine===false){toast('Connect to Wi-Fi or mobile data first.',5000);return;}
  const ok=await ask({title:'Reload and verify your account online?',
    body:'<p>Save any unfinished handwriting before reloading. The downloaded pack, IndexedDB drafts and pending sessions will not be cleared. You may need to sign in again.</p>',
    ok:'Reconnect and reload',cancel:'Keep studying offline'});
  if(ok)location.reload();
};
