/* Learning Hub · Phase 2 Quick Practice
 * Self-rated short practice. This deliberately does not replace a handwritten
 * Ghost Test or a Cowork-graded PDF worksheet. */
(function () {
  'use strict';
  const DRAFT_PREFIX='wt-quick-v1:';
  const MAX_AGE=14*86400000;
  const DURATIONS=[5,10,20];
  const MODES=[
    {id:'due',name:'Due today',hint:'Weak and scheduled-due questions'},
    {id:'weak',name:'Weak spots',hint:'Questions you previously missed'},
    {id:'new',name:'New questions',hint:'Questions not yet attempted'},
    {id:'random',name:'Surprise me',hint:'Mix of all available questions'}
  ];
  const Q={loadedFor:null,loading:false,loadError:null,session:null,finished:null,
    opts:{mode:null,minutes:10,subject:'all',topic:'all'},tick:null,lastTick:null,
    persistChain:Promise.resolve(),textTimer:null,busy:false};

  function select(problems,statusOf,subjectOfTopic,opts,random=Math.random){
    const used=new Set();
    const candidates=(problems||[]).filter(p=>{
      if(!p||!p.id||!String(p.prompt||'').trim()||used.has(p.id))return false;
      if(opts.topic!=='all'&&p.topic_id!==opts.topic)return false;
      if(opts.subject!=='all'&&subjectOfTopic(p.topic_id)!==opts.subject)return false;
      used.add(p.id);return true;
    }).map(p=>({p,s:statusOf(p)}));
    let filtered=candidates.filter(({s})=>
      opts.mode==='weak'?s.code==='weak':
      opts.mode==='due'?s.code==='weak'||s.code==='due':
      opts.mode==='new'?s.code==='new':true);
    if(opts.mode==='random'){
      for(let i=filtered.length-1;i>0;i--){
        const j=Math.min(i,Math.floor(random()*(i+1)));
        [filtered[i],filtered[j]]=[filtered[j],filtered[i]];
      }
    }else filtered.sort((a,b)=>{
      const rank=c=>c==='weak'?0:c==='due'?1:c==='new'?2:3;
      const delta=rank(a.s.code)-rank(b.s.code);
      if(delta)return delta;
      const tA=a.s.due?new Date(a.s.due).getTime():0;
      const tB=b.s.due?new Date(b.s.due).getTime():0;
      return (tA-tB)||((a.p.unit_no||a.p.number||0)-(b.p.unit_no||b.p.number||0));
    });
    return filtered.slice(0,Math.min(20,Math.max(1,opts.minutes))).map(x=>x.p);
  }

  function resultRow(item,owner,opts){
    if(!item||![1,3,5].includes(item.grade))return null;
    const code=item.grade===5?'Correct':item.grade===3?'Almost':'Wrong';
    const reply=String(item.response||'').trim().slice(0,1000);
    return {
      id:item.attemptId,user_id:owner,problem_id:item.id,topic_id:item.topic_id,
      correct:item.grade===5,rating:item.grade,score:item.grade===5?1:item.grade===3?0.5:0,
      max_score:1,graded_by:'self',graded_at:item.ratedAt,
      notes:'Quick Practice · self-rated '+code+' ('+opts.mode+', '+opts.minutes+' min)'+
        (reply?'\nLearner response: '+reply:'')
    };
  }
  function createSession(items,opts,user,uuid,now=Date.now()){
    return {id:uuid(),owner:user,startedAt:now,updatedAt:now,
      opts:{...opts},phase:'active',remainingSec:opts.minutes*60,
      paused:false,expired:false,cursor:0,
      items:items.map(p=>({
        id:p.id,topic_id:p.topic_id,subtitle:p.subtitle,prompt:p.prompt,answer:p.answer||'',
        worked:p.worked||'',given_data:p.given_data||'',response:'',revealed:false,
        skipped:false,grade:null,ratedAt:null,attemptId:uuid()
      }))};
  }
  window.WTQuickLogic={select,resultRow,createSession};

  const owner=()=>DEMO?'demo':SESSION&&SESSION.user&&SESSION.user.id||'';
  const draftKey=id=>DRAFT_PREFIX+id;
  const key=()=>draftKey(owner());
  const onPage=()=>location.hash.split('/')[0]==='#quick';
  const displayTime=s=>String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')+':'+
    String(Math.max(0,s)%60).padStart(2,'0');
  const countRated=s=>s.items.filter(x=>[1,3,5].includes(x.grade)).length;

  async function saveSnapshot(){
    if(DEMO||!Q.session)return;
    Q.session.updatedAt=Date.now();
    const snapshot=JSON.parse(JSON.stringify(Q.session));
    const storeKey=draftKey(Q.session.owner);
    Q.persistChain=Q.persistChain.catch(()=>{}).then(()=>idb.set(storeKey,snapshot));
    return Q.persistChain;
  }
  async function removeSnapshot(accountId){
    if(DEMO)return;
    const storeKey=draftKey(accountId||owner());
    await Q.persistChain.catch(()=>{});
    await idb.set(storeKey,null);
  }
  async function load(){
    if(Q.loading)return;
    const current=owner();
    if(!current){Q.loadError='Sign in first to use Quick Practice.';return;}
    Q.loading=true;Q.loadError=null;
    try{
      const draft=DEMO?null:await idb.get(key());
      if(draft&&draft.owner===current&&Array.isArray(draft.items)&&
        Date.now()-(draft.updatedAt||draft.startedAt||0)<MAX_AGE){
        Q.session=draft;
        if(!Q.session.items.length){Q.session=null;}
        else {
          Q.session.cursor=Math.max(0,Math.min(Q.session.items.length-1,Number(Q.session.cursor)||0));
          if(Q.session.phase==='active')Q.session.paused=true;
          Q.session.items.forEach(i=>{i.response=String(i.response||'');});
        }
      }
    }catch(e){Q.loadError='Could not read your saved practice: '+(e.message||e);}
    finally{
      Q.loading=false;Q.loadedFor=current;
      if(onPage())renderQuickPractice();
    }
  }
  function persistSoon(){
    clearTimeout(Q.textTimer);
    Q.textTimer=setTimeout(()=>saveSnapshot().catch(e=>toast('Draft could not be saved: '+(e.message||e),6000)),500);
  }
  function updateClock(){
    const el=$('qp-clock');if(el&&Q.session)el.textContent=displayTime(Q.session.remainingSec);
    const lab=$('qp-timer-label');if(lab&&Q.session){
      lab.textContent=Q.session.expired?'Time is up — finish your current work or save results':
        Q.session.paused?'Timer paused':'Time remaining';
    }
  }
  function pause(reason){
    if(!Q.session||Q.session.phase!=='active'||Q.session.paused)return;
    tick();
    Q.session.paused=true;Q.lastTick=null;
    saveSnapshot().catch(e=>toast('Could not save paused session: '+(e.message||e),5500));
    if(reason&&onPage())renderQuickPractice();
  }
  function tick(){
    const s=Q.session;
    if(!s||s.phase!=='active'||s.paused||!onPage()||document.hidden)return;
    const now=Date.now();
    if(Q.lastTick==null){Q.lastTick=now;return;}
    const seconds=Math.max(0,Math.floor((now-Q.lastTick)/1000));
    if(!seconds)return;
    Q.lastTick+=seconds*1000;
    s.remainingSec=Math.max(0,s.remainingSec-seconds);
    if(s.remainingSec===0){s.paused=true;s.expired=true;Q.lastTick=null;
      saveSnapshot().catch(()=>{});renderQuickPractice();return;}
    if(s.remainingSec%10===0)saveSnapshot().catch(()=>{});
    updateClock();
  }
  function startTimer(){
    if(Q.tick)return;
    Q.tick=setInterval(tick,1000);
  }

  function pickOpts(){
    const latest=latestByProblem();
    const topicSubject=tid=>{
      const t=TOPICS.find(x=>x.id===tid);
      return t?subjectOf(t):null;
    };
    const status=p=>pstatus(p,latest);
    if(!Q.opts.mode){
      const opts={...Q.opts,mode:'due'};
      Q.opts.mode=select(PROBLEMS,status,topicSubject,opts).length?'due':
        select(PROBLEMS,status,topicSubject,{...opts,mode:'new'}).length?'new':'random';
    }
    const available={};
    for(const x of MODES)available[x.id]=select(PROBLEMS,status,topicSubject,{...Q.opts,mode:x.id,minutes:20}).length;
    return {available,chosen:select(PROBLEMS,status,topicSubject,Q.opts)};
  }

  async function start(){
    if(Q.busy)return;
    if(Q.session){
      const ok=await ask({title:'Replace unfinished Quick Practice?',
        body:'<p>Its current answers and ratings will be discarded. Any results not yet synced would be lost.</p>',
        ok:'Discard and start new',cancel:'Continue existing',danger:true});
      if(!ok)return;
    }
    const {chosen}=pickOpts();
    if(!chosen.length){toast('No questions match this practice mode and subject.',5500);return;}
    if(!window.crypto||!crypto.randomUUID){toast('A secure browser connection is required for safe practice IDs.');return;}
    const next=createSession(chosen,Q.opts,owner(),()=>crypto.randomUUID());
    Q.busy=true;
    try{
      // Do not destroy the existing draft unless the replacement is durably stored.
      if(!DEMO){
        // Finish any in-flight autosave of the old session before replacing it.
        await Q.persistChain.catch(()=>{});
        await idb.set(key(),JSON.parse(JSON.stringify(next)));
      }
      Q.session=next;Q.finished=null;Q.lastTick=Date.now();renderQuickPractice();
    }catch(e){toast('Cannot store a new practice session: '+(e.message||e),6500);}
    finally{Q.busy=false;}
  }

  async function move(delta){
    if(!Q.session||Q.session.phase!=='active')return;
    Q.session.cursor=Math.max(0,Math.min(Q.session.items.length-1,Q.session.cursor+delta));
    Q.lastTick=Q.session.paused?null:Date.now();
    try{await saveSnapshot();}catch(e){toast('Draft could not be saved: '+(e.message||e),6000);}
    renderQuickPractice();
  }
  async function reveal(){
    const s=Q.session;if(!s||s.phase!=='active')return;
    s.items[s.cursor].revealed=true;
    try{await saveSnapshot();}catch(e){toast('Draft save failed: '+(e.message||e),6000);}
    renderQuickPractice();
  }
  async function grade(value){
    const s=Q.session;if(!s||s.phase!=='active')return;
    const item=s.items[s.cursor];
    if(!item.revealed){toast('Reveal the reference answer before self-rating.');return;}
    item.grade=value;item.ratedAt=item.ratedAt||new Date().toISOString();item.skipped=false;
    if(s.cursor<s.items.length-1)s.cursor++;
    try{await saveSnapshot();}catch(e){toast('Rating not securely saved: '+(e.message||e),7000);return;}
    renderQuickPractice();
  }
  async function skip(){
    const s=Q.session;if(!s||s.phase!=='active')return;
    const item=s.items[s.cursor];if(item.grade==null)item.skipped=true;
    if(s.cursor<s.items.length-1)s.cursor++;
    try{await saveSnapshot();}catch(e){toast('Draft could not be saved: '+(e.message||e),6000);}
    renderQuickPractice();
  }
  function response(text){
    const s=Q.session;if(!s||s.phase!=='active')return;
    s.items[s.cursor].response=String(text||'').slice(0,5000);
    persistSoon();
  }
  async function endSession(){
    if(!Q.session||Q.busy)return;
    const s=Q.session,rated=countRated(s);
    if(s.phase==='active'){
      if(!rated){toast('Rate at least one answer, or discard this practice session.');return;}
      const missing=s.items.length-rated;
      const ok=await ask({title:'Save '+rated+' self-rated answer'+(rated===1?'':'s')+'?',
        body:'<p>Quick Practice uses your own ✓ / △ / ✗ rating, not AI grading. '+
          (missing?missing+' unrated question'+(missing===1?' is':'s are')+' excluded. ':'')+
          'Results will update your Learning Hub review schedule.</p>',
        ok:'Save results',cancel:'Keep practising'});
      if(!ok)return;
      s.paused=true;s.phase='pending';
      try{await saveSnapshot();}catch(e){s.phase='active';toast('Could not safely store results before syncing: '+(e.message||e),7500);return;}
    }
    Q.busy=true;renderQuickPractice();
    try{
      const rows=s.items.map(i=>resultRow(i,s.owner,s.opts)).filter(Boolean);
      if(!DEMO){
        const {error}=await sb.from('written_test_attempts').upsert(rows,{onConflict:'id'});
        if(error)throw error;
        const fresh=new Set(rows.map(r=>r.id));
        ATTEMPTS=[...rows,...ATTEMPTS.filter(a=>!fresh.has(a.id))].sort(
          (a,b)=>new Date(b.graded_at)-new Date(a.graded_at));
      }
      Q.finished={count:rows.length,right:rows.filter(r=>r.correct).length,
        weak:rows.filter(r=>!r.correct).length,minutes:s.opts.minutes,demo:DEMO};
      Q.session=null;Q.lastTick=null;
      try{await removeSnapshot(s.owner);}catch(e){toast('Results saved, but draft cleanup failed. Retrying later is safe.',7000);}
      renderQuickPractice();
    }catch(e){
      // Persisting stable UUIDs before upload makes retries idempotent.
      toast('Results NOT synced. Your saved session is intact: '+(e.message||e),8000);
    }finally{Q.busy=false;renderQuickPractice();}
  }
  async function backupPending(){
    const s=Q.session;
    if(!s||s.phase!=='pending'){toast('No pending results to export.');return;}
    const ok=await ask({title:'Export a private backup of unsynced results?',
      body:'<p>The JSON includes your self-ratings and any typed answers. Keep it private. This does NOT sync results or clear the pending session.</p>',
      ok:'Export private backup',cancel:'Not now'});
    if(!ok)return;
    const payload={format:'wt-quick-backup-v1',session_id:s.id,owner:s.owner,
      created_at:new Date(s.startedAt).toISOString(),
      rows:s.items.map(i=>resultRow(i,s.owner,s.opts)).filter(Boolean)};
    const name='WT_quick_pending_'+String(s.id).slice(0,8)+'.json';
    download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),name);
    toast('Backup downloaded. Keep it private; results are still pending.');
  }
  async function discard(){
    if(!Q.session)return;
    const ok=await ask({title:'Discard this practice session?',
      body:'<p>Unsubmitted answers and ratings will be lost. Nothing already saved in Supabase is removed.</p>',
      ok:'Discard session',cancel:'Keep session',danger:true});
    if(!ok)return;
    try{await removeSnapshot(Q.session.owner);}catch(e){toast('Cannot clear saved draft: '+(e.message||e),7000);return;}
    Q.session=null;Q.lastTick=null;Q.finished=null;renderQuickPractice();
  }
  function applyHandlers(map){
    for(const [id,callback] of Object.entries(map)){
      const el=$(id);
      if(el)el.addEventListener('click',callback);
    }
  }
  function setupView(){
    const {available,chosen}=pickOpts();
    const subjects=[{id:'all',name:'All subjects'},...SUBJECTS];
    const topics=[{id:'all',name:'All topics'},...TOPICS.filter(t=>
      Q.opts.subject==='all'||subjectOf(t)===Q.opts.subject)];
    const options=(arr,chosenId)=>arr.map(x=>
      '<option value="'+esc(x.id)+'"'+(x.id===chosenId?' selected':'')+'>'+esc(x.name)+'</option>').join('');
    const modes=MODES.map(m=>'<button class="qp-mode'+(Q.opts.mode===m.id?' selected':'')+
      '" type="button" data-qmode="'+m.id+'" aria-pressed="'+(Q.opts.mode===m.id)+'">'+
      '<strong>'+esc(m.name)+'</strong><small>'+esc(m.hint)+' · '+available[m.id]+' available</small></button>').join('');
    const lengths=DURATIONS.map(n=>'<button type="button" class="pill-t'+(Q.opts.minutes===n?' on':'')+
      '" data-qminutes="'+n+'" aria-pressed="'+(Q.opts.minutes===n)+'">'+n+' minutes</button>').join('');
    $('main').innerHTML=[
      '<div class="kicker">Quick Practice</div>',
      '<h1 style="margin:4px 0 6px">A focused study session</h1>',
      '<p style="color:var(--soft);margin:0 0 18px">One question at a time. Try your answer, reveal the reference, and rate yourself. No worksheet export or AI grading required.</p>',
      '<div class="card qp-setup">',
      '<div class="qp-selectors"><div><label for="qp-subject">Subject</label><select id="qp-subject">'+options(subjects,Q.opts.subject)+'</select></div>',
      '<div><label for="qp-topic">Topic</label><select id="qp-topic">'+options(topics,Q.opts.topic)+'</select></div></div>',
      '<div class="qp-subheading">What should I practise?</div><div class="qp-modes">'+modes+'</div>',
      '<div class="qp-subheading">Session length</div><div class="pillbar">'+lengths+'</div>',
      '<p class="qp-hint">'+chosen.length+' question'+(chosen.length===1?'':'s')+
        ' selected. The timer is a goal, not a forced cutoff. You can pause, skip, or finish early.</p>',
      '<button class="btn" id="qp-start" '+(!chosen.length?'disabled':'')+'>Start practice</button>',
      !chosen.length?'<p class="msg">No matching questions. Try another mode or topic. Questions need a saved prompt; some may not have reference answers.</p>':'',
      '</div>'
    ].join('');
    $('qp-subject').addEventListener('change',e=>{Q.opts.subject=e.target.value;Q.opts.topic='all';setupView();});
    $('qp-topic').addEventListener('change',e=>{Q.opts.topic=e.target.value;setupView();});
    document.querySelectorAll('[data-qmode]').forEach(el=>el.addEventListener('click',()=>{
      Q.opts.mode=el.dataset.qmode;setupView();
    }));
    document.querySelectorAll('[data-qminutes]').forEach(el=>el.addEventListener('click',()=>{
      Q.opts.minutes=Number(el.dataset.qminutes);setupView();
    }));
    applyHandlers({'qp-start':start});
  }
  function sessionView(){
    const s=Q.session;if(!s)return;
    const pending=s.phase==='pending',rated=countRated(s),n=s.items.length;
    const item=s.items[s.cursor];
    const topic=TOPICS.find(t=>t.id===item.topic_id);
    const answer=item.answer||item.worked;
    const status=item.grade===5?'✓ Correct':item.grade===3?'△ Almost':item.grade===1?'✗ Wrong':
      item.skipped?'Skipped':'Not rated';
    const phase=pending?[
      '<p class="msg err">The results are not confirmed in Supabase. Your answers are preserved on this device. Retry when connected.</p>',
      '<button class="btn" id="qp-retry" '+(Q.busy?'disabled':'')+'>Retry save</button>',
      '<button class="btn sm ghost" id="qp-backup">Export pending backup</button>'
    ].join(''):[
      '<div class="qp-controls"><button class="btn sm ghost" id="qp-pause" '+(s.expired?'disabled':'')+'>'+
        (s.expired?'Time up':s.paused?'Resume':'Pause')+'</button>',
      '<button class="btn sm ghost" id="qp-back" '+(s.cursor===0?'disabled':'')+'>Previous</button>',
      '<button class="btn sm ghost" id="qp-skip" '+(s.cursor===n-1?'disabled':'')+'>Skip</button>',
      '<button class="btn sm ghost" id="qp-next" '+(s.cursor===n-1?'disabled':'')+'>Next</button></div>'
    ].join('');
    $('main').innerHTML=[
      '<div class="kicker">Quick Practice · '+esc(s.opts.mode)+'</div>',
      '<div class="qp-top"><div><h1>Question '+(s.cursor+1)+' / '+n+'</h1>',
      '<p class="qp-hint">'+rated+' rated · '+esc(topic?topic.name:item.topic_id)+'</p></div>',
      '<div class="qp-clock"><span id="qp-timer-label">'+
        (s.expired?'Time is up':s.paused?'Timer paused':'Time remaining')+
        '</span><strong id="qp-clock" aria-live="off">'+displayTime(s.remainingSec)+'</strong></div></div>',
      '<div class="qp-meter" role="progressbar" aria-label="Rated questions" aria-valuemin="0" aria-valuemax="'+n+
        '" aria-valuenow="'+rated+'"><span style="width:'+(rated/n*100)+'%"></span></div>',
      '<div class="card qp-question-card">',
      '<p class="kicker">Question</p><h2>'+esc(item.subtitle||'Practice')+'</h2>',
      '<div class="qp-question">'+esc(item.prompt)+'</div>',
      item.given_data?'<div class="qp-given"><b>Given</b><div>'+esc(item.given_data)+'</div></div>':'',
      '<label for="qp-response">My working / answer (optional)</label>',
      '<textarea id="qp-response" rows="4" placeholder="Write using keyboard or iPad Scribble, or solve on paper before revealing..."'+
        (pending?' disabled':'')+'></textarea>',
      '<p class="qp-hint">Self-check only. For freehand Apple Pencil writing, use Ghost Test or a PDF worksheet.</p>',
      !item.revealed?'<button class="btn" id="qp-reveal" '+(pending?'disabled':'')+'>Reveal reference answer</button>':
        '<div class="qp-answer"><div class="qp-answer-label">Reference answer</div><div>'+
          esc(answer||'No reference answer saved for this problem. Use your notes to self-assess.')+'</div>'+
          (item.worked&&item.worked!==answer?'<div class="qp-worked"><b>Worked solution</b><div>'+esc(item.worked)+'</div></div>':'')+'</div>',
      '<div class="qp-mark-label">Rating: '+esc(status)+'</div>',
      item.revealed&&!pending?'<div class="qp-markers">'+
        '<button class="btn sm ghost" id="qp-mark-5">✓ Correct</button>'+
        '<button class="btn sm ghost" id="qp-mark-3">△ Almost</button>'+
        '<button class="btn sm ghost" id="qp-mark-1">✗ Wrong</button></div>':'',
      '</div>',phase,
      '<div class="qp-footer"><button class="btn" id="qp-end" '+(Q.busy?'disabled':'')+'>'+
        (pending?'Retry save':'Finish and save')+'</button>',
      '<button class="btn sm ghost" id="qp-discard" '+(pending?'disabled':'')+'>Discard session</button></div>'
    ].join('');
    $('qp-response').value=item.response||'';
    if(!pending)$('qp-response').addEventListener('input',e=>response(e.target.value));
    applyHandlers({
      'qp-pause':()=>{if(s.expired)return; if(s.paused){s.paused=false;Q.lastTick=Date.now();saveSnapshot().catch(()=>{});}else pause(false);renderQuickPractice();},
      'qp-back':()=>move(-1),'qp-next':()=>move(1),'qp-skip':skip,'qp-reveal':reveal,
      'qp-mark-5':()=>grade(5),'qp-mark-3':()=>grade(3),'qp-mark-1':()=>grade(1),
      'qp-end':endSession,'qp-retry':endSession,'qp-backup':backupPending,'qp-discard':discard
    });
    if(!pending){if(!s.paused&&Q.lastTick==null)Q.lastTick=Date.now();startTimer();}
  }
  function finishView(){
    const s=Q.finished;
    $('main').innerHTML=[
      '<div class="kicker">Quick Practice</div><h1>Session complete</h1>',
      '<div class="card" style="margin-top:14px"><h2>'+s.count+' question'+(s.count===1?'':'s')+' checked</h2>',
      '<p>'+s.right+' correct · '+s.weak+' to review</p>',
      '<p class="qp-hint">'+(s.demo?'Demo: no results were saved.':'Self-ratings were saved to Learning Hub. They influence your weak/due question selection.')+'</p>',
      '<div class="acts"><button class="btn" id="qp-new">Another session</button> '+
        '<a class="btn sm ghost" href="#review">See feedback</a></div></div>'
    ].join('');
    applyHandlers({'qp-new':()=>{Q.finished=null;setupView();}});
  }
  window.renderQuickPractice=function(){
    const current=owner();
    if(Q.loadedFor!==current){
      Q.session=null;Q.finished=null;Q.loadedFor=null;
      $('main').innerHTML='<div class="card">Loading your Quick Practice session…</div>';
      load();return;
    }
    if(Q.loading){$('main').innerHTML='<div class="card">Loading your Quick Practice session…</div>';return;}
    if(Q.loadError){$('main').innerHTML='<div class="card"><h2>Practice draft unavailable</h2><p>'+
      esc(Q.loadError)+'</p><button class="btn" id="qp-retry-load">Try again</button></div>';
      applyHandlers({'qp-retry-load':()=>{Q.loadedFor=null;renderQuickPractice();}});return;}
    if(Q.session)sessionView();
    else if(Q.finished)finishView();
    else setupView();
  };
  addEventListener('hashchange',()=>{if(!onPage())pause(false);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(false);});
})();
