/* Phase 7 — verified, conflict-safe General_apps replay.
 * NEVER sends Japanese aggregate reviews. All Japanese jobs remain local
 * pending a verified, idempotent Technical-project endpoint.
 * Requires a signed-in online account and existing owner-scoped RLS. */
(function(){
  'use strict';
  const TABLE='written_test_attempts';
  const SELECT='id,user_id,problem_id,topic_id,correct,rating,score,max_score,notes,graded_by,graded_at';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const MAX_ROWS=50;
  let running=false,last=null;
  const now=()=>new Date().toISOString();
  const supported=job=>job&&['hub','quick'].includes(job.kind);
  const numerical=v=>v==null?null:Number(v);
  const time=v=>v==null?null:Date.parse(v);
  const equal=(a,b)=>a===b||(a==null&&b==null);
  function payloads(job,owner){
    if(!supported(job)||!owner||job.owner!==owner||
       !Array.isArray(job.rows)||!job.rows.length||job.rows.length>MAX_ROWS)
      throw Error('Invalid or oversized owner-scoped Hub/Quick session');
    const ids=new Set(),kind=job.kind==='quick'?'self':'ghost';
    return job.rows.map((r,i)=>{
      if(!r||typeof r!=='object'||!UUID.test(r.id)||ids.has(r.id)||
         r.user_id!==owner||r.graded_by!==kind||
         typeof r.problem_id!=='string'||!r.problem_id||
         ![true,false].includes(r.correct)||
         ![1,3,5].includes(Number(r.rating))||
         !Number.isFinite(time(r.graded_at)))
        throw Error('Invalid or conflicting attempt at item '+(i+1)+'. Saved locally for review.');
      ids.add(r.id);
      if(r.topic_id!=null&&typeof r.topic_id!=='string')
        throw Error('Invalid topic in item '+(i+1));
      if(r.notes!=null&&typeof r.notes!=='string')throw Error('Invalid notes in item '+(i+1));
      return {
        id:r.id,user_id:owner,problem_id:r.problem_id,
        topic_id:r.topic_id||null,correct:r.correct,
        rating:Number(r.rating),graded_by:kind,
        graded_at:new Date(r.graded_at).toISOString(),
        notes:r.notes==null?null:r.notes,
        ...(r.score==null?{}:{score:Number(r.score)}),
        ...(r.max_score==null?{}:{max_score:Number(r.max_score)})
      };
    });
  }
  function matches(local,remote){
    if(!remote||local.id!==remote.id||local.user_id!==remote.user_id||
       local.problem_id!==remote.problem_id||!equal(local.topic_id,remote.topic_id)||
       local.correct!==remote.correct||Number(local.rating)!==Number(remote.rating)||
       local.graded_by!==remote.graded_by||time(local.graded_at)!==time(remote.graded_at)||
       !equal(local.notes,remote.notes))return false;
    // Supabase applies server defaults when score/max_score were omitted.
    if(numerical(local.score)!==numerical(remote.score))return false;
    return (local.max_score==null?1:Number(local.max_score))===
      (remote.max_score==null?1:Number(remote.max_score));
  }
  function plan(rows,remote){
    const existing=new Map((remote||[]).map(r=>[r.id,r]));
    const conflicts=[],missing=[],confirmed=[];
    for(const r of rows){
      const found=existing.get(r.id);
      if(!found)missing.push(r);
      else if(matches(r,found))confirmed.push(found);
      else conflicts.push(r.id);
    }
    return {missing,confirmed,conflicts};
  }
  window.WTOfflineSyncLogic={payloads,matches,plan,supported};

  function currentOwner(){
    if(typeof OFFLINE_MODE!=='undefined'&&OFFLINE_MODE)return null;
    if(typeof DEMO!=='undefined'&&DEMO)return null;
    return typeof SESSION!=='undefined'&&SESSION&&SESSION.user&&SESSION.user.id||null;
  }
  async function verifiedOwner(){
    const owner=currentOwner();
    if(!owner||navigator.onLine===false)throw Error('Reconnect and sign in online before syncing.');
    const {data,error}=await sb.auth.getUser();
    if(error||!data||!data.user||data.user.id!==owner)
      throw Error('Current Supabase account could not be verified. Sign in again.');
    if(typeof authRole!=='function')throw Error('Access-list check unavailable');
    const role=await authRole(data.user.email||'');
    if(!role||role.error)throw Error('Current account is not verified on the access list.');
    if(currentOwner()!==owner)throw Error('Account changed during verification');
    return owner;
  }
  async function readBack(owner,ids){
    const {data,error}=await sb.from(TABLE).select(SELECT)
      .in('id',ids).eq('user_id',owner);
    if(error)throw Error('Read-back failed: '+error.message);
    if(!Array.isArray(data))throw Error('No reliable read-back response');
    return data;
  }
  async function confirmOne(job,owner){
    if(currentOwner()!==owner)throw Error('Account changed; session retained locally');
    const rows=payloads(job,owner),ids=rows.map(r=>r.id);
    const initial=plan(rows,await readBack(owner,ids));
    if(initial.conflicts.length)
      throw Error('Server record conflicts with saved marks ('+
        initial.conflicts.length+' ID). Nothing overwritten; export the pending backup.');
    if(initial.missing.length){
      // INSERT, not UPSERT: never overwrite already synced or Cowork rows.
      // A duplicate-key race can occur across tabs; subsequent read-back
      // verifies which data really committed before any local acknowledgement.
      const {error}=await sb.from(TABLE).insert(initial.missing);
      if(error){
        const afterError=plan(rows,await readBack(owner,ids));
        if(afterError.conflicts.length||afterError.missing.length)
          throw Error('Upload could not be verified: '+error.message+
            '. All unconfirmed results remain saved on this device.');
      }
    }
    if(currentOwner()!==owner)throw Error('Account changed while syncing; local session retained');
    const remote=await readBack(owner,ids);
    const result=plan(rows,remote);
    if(result.conflicts.length||result.missing.length||result.confirmed.length!==rows.length)
      throw Error('Server verification incomplete; no local results removed');
    await WTOffline.acknowledge(owner,job.id,{
      ids,confirmedAt:now()
    });
    // Render authoritative remote records, not an optimistic client copy.
    if(typeof ATTEMPTS!=='undefined'){
      const keys=new Set(remote.map(r=>r.id));
      ATTEMPTS=[...remote,...ATTEMPTS.filter(r=>!keys.has(r.id))]
        .sort((a,b)=>new Date(b.graded_at)-new Date(a.graded_at));
    }
    return rows.length;
  }
  function announce(message){
    last={at:now(),message};
    const el=document.getElementById('sync-status');
    if(el)el.textContent=message;
  }
  async function performSync(onProgress){
    if(running)throw Error('Synchronization already running');
    if(!window.WTOffline)throw Error('Offline storage unavailable');
    running=true;
    try{
      const owner=await verifiedOwner();
      const jobs=await WTOffline.pending(owner);
      const candidate=jobs.filter(supported),japanese=jobs.filter(j=>j.kind==='japanese');
      let synced=0,rows=0,blocked=0;
      const errors=[];
      for(let i=0;i<candidate.length;i++){
        if(currentOwner()!==owner)throw Error('Account changed during sync');
        const job=candidate[i];
        try{rows+=await confirmOne(job,owner);synced++;}
        catch(e){
          blocked++;errors.push({jobId:job.id,error:e.message||String(e)});
        }
        const message='Verified '+synced+'/'+candidate.length+' Hub/Quick sessions · '+
          blocked+' needing attention · '+japanese.length+' Japanese held locally';
        announce(message);
        if(onProgress)onProgress({synced,rows,blocked,japanese:japanese.length,
          total:candidate.length,done:i+1,errors});
      }
      const result={owner,synced,rows,blocked,japanese:japanese.length,
        total:candidate.length,errors};
      if(!candidate.length)announce(japanese.length?
        'No Hub/Quick sessions to sync. '+japanese.length+
          ' Japanese session(s) require a secure Technical-project sync endpoint.':
        'No pending Hub/Quick sessions.');
      return result;
    }finally{running=false;}
  }
  async function sync(onProgress){
    const owner=currentOwner();
    if(!owner)throw Error('Sign in online to synchronize');
    if(navigator.locks&&navigator.locks.request)
      return navigator.locks.request('wt-hub-sync:'+owner,
        {mode:'exclusive',ifAvailable:true},async lock=>{
          if(!lock)throw Error('Another app tab is syncing; try again after it finishes');
          return performSync(onProgress);
        });
    return performSync(onProgress);
  }
  async function autoSyncIfEnabled(){
    const owner=currentOwner();
    if(!owner||running||navigator.onLine===false||!window.WTOffline)return null;
    if(!await WTOffline.getSyncPreference(owner))return null;
    // No automatic sync if actively drawing or writing answers.
    const page=location.hash.split('/')[0];
    if(page==='#ghost'||page==='#quick')return null;
    return sync();
  }
  window.WTOfflineSync={
    sync,autoSyncIfEnabled,isRunning:()=>running,last:()=>last,
    verifiedOwner
  };
})();
