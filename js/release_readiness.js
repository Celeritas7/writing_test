/* Phase 8 · read-only release diagnostics and complete offline snapshot.
 * No writes to Supabase, no token/account IDs in diagnostic exports.
 * This cannot replace physical Safari, Pencil and airplane-mode testing. */
(function(root){
  'use strict';
  const RELEASE='phase8';
  const PAGE_SIZE=400,MAX_PER_TABLE=20000;
  const TABLES=[
    {key:'subjects',name:'written_test_subjects',order:'sort_no'},
    {key:'topics',name:'written_test_topics',order:'branch_no'},
    {key:'problems',name:'written_test_problems',order:'number'},
    {key:'attempts',name:'written_test_attempts',order:'graded_at',descending:true},
    {key:'batches',name:'written_test_batches',order:'created_at',descending:true}
  ];
  const safeDate=val=>val&&Number.isFinite(Date.parse(val))?val:null;
  function checkRows(rows,spec,expected){
    if(!Array.isArray(rows)||rows.length!==expected)
      throw Error(spec.name+': received '+(rows&&rows.length)+' of '+expected+
        ' visible records. Previous offline pack preserved.');
    const ids=new Set();
    for(const r of rows){
      if(!r||typeof r.id!=='string'||ids.has(r.id))
        throw Error(spec.name+': invalid or duplicate ID; cannot declare the pack complete');
      ids.add(r.id);
    }
  }
  async function readCompleteSnapshot(sb,onProgress){
    if(!sb||typeof sb.from!=='function')throw Error('Signed-in database client is required');
    const collected={},counts={};
    for(const spec of TABLES){
      const initial=await sb.from(spec.name).select('id',{count:'exact',head:true});
      if(initial.error)throw Error(spec.name+': count failed: '+initial.error.message);
      if(!Number.isSafeInteger(initial.count)||initial.count<0)
        throw Error(spec.name+': server did not confirm an exact count');
      const count=initial.count;
      if(count>MAX_PER_TABLE)
        throw Error(spec.name+': '+count+' records exceed the '+MAX_PER_TABLE+
          '-row verified offline download limit');
      counts[spec.key]=count;
      const rows=[];
      for(let offset=0;offset<count;offset+=PAGE_SIZE){
        const result=await sb.from(spec.name).select('*')
          .order(spec.order,{ascending:!spec.descending})
          .order('id',{ascending:true}).range(offset,Math.min(count-1,offset+PAGE_SIZE-1));
        if(result.error)throw Error(spec.name+': page '+(Math.floor(offset/PAGE_SIZE)+1)+
          ' failed: '+result.error.message);
        if(!Array.isArray(result.data))
          throw Error(spec.name+': page returned no readable data');
        rows.push(...result.data);
        if(onProgress)onProgress({table:spec.key,downloaded:rows.length,total:count});
      }
      checkRows(rows,spec,count);
      collected[spec.key]=rows;
      if(onProgress)onProgress({table:spec.key,downloaded:count,total:count});
    }
    return {...collected,counts,completeSnapshot:true,
      verifiedAt:new Date().toISOString()};
  }
  function summarizeStatuses(checks){
    const bad=checks.filter(x=>x.status==='fail').length;
    const warn=checks.filter(x=>x.status==='warn').length;
    return {passed:checks.length-bad-warn,warnings:warn,failures:bad,
      technicalStatus:bad?'needs-attention':warn?'review-required':'technical-checks-pass',
      deviceAcceptance:'not-verified'};
  }
  async function audit({offline,owner,navigator:nav=globalThis.navigator,
    storage=nav&&nav.storage,modeIsStandalone}){
    if(!offline)throw Error('Offline storage module is not loaded');
    const checks=[],pendingCounts={hub:0,quick:0,japanese:0},snapshot={};
    function add(code,label,status,detail){checks.push({code,label,status,detail});}
    const standalone=!!modeIsStandalone;
    add('installation','Home Screen installation',
      standalone?'pass':'warn',
      standalone?'Running in installed/standalone mode':
        'Running in a browser tab. Safari and Home Screen storage may differ');
    const controlled=!!(nav&&nav.serviceWorker&&nav.serviceWorker.controller);
    add('worker','Service worker controls this page',controlled?'pass':'fail',
      controlled?'App shell has a controller':
        'Open the installed app online again; a first visit may not yet be controlled');
    let assets=false;
    try{assets=await offline.assetsReady();}
    catch(e){add('assets','Complete current app assets','fail','Cache unreadable: '+String(e.message||e));}
    if(!checks.some(x=>x.code==='assets'))
      add('assets','Complete current app assets',assets?'pass':'fail',
        assets?'All required Phase 8 files are in the current offline cache':
          'Run Download study offline from this same app while online');
    if(!owner){
      add('owner','Previously verified study owner','fail',
        'No verified account is available in this app');
    }else{
      let enrolled=false;
      try{enrolled=await offline.enrolled(owner);}
      catch(e){add('owner','Previously verified study owner','fail',
        'Owner check unavailable: '+String(e.message||e));}
      if(!checks.some(x=>x.code==='owner'))
        add('owner','Previously verified study owner',enrolled?'pass':'fail',
          enrolled?'Owner-matched downloaded pack found':
            'Reconnect and download the pack under this account');
    }
    try{
      const p=owner?await offline.pack(owner):null;
      if(p&&Array.isArray(p.problems)){
        snapshot.problems=p.problems.length;
        snapshot.topics=Array.isArray(p.topics)?p.topics.length:0;
        snapshot.subjects=Array.isArray(p.subjects)?p.subjects.length:0;
        snapshot.savedAt=safeDate(p.savedAt);
        snapshot.complete=!!p.completeSnapshot;
        if(p.completeSnapshot&&p.counts&&TABLES.every(t=>
          Array.isArray(p[t.key])&&p[t.key].length===p.counts[t.key])){
          add('snapshot','Downloaded study snapshot completeness','pass',
            snapshot.problems+' problems, '+snapshot.topics+
            ' topics; verified against source counts');
        }else{
          add('snapshot','Downloaded study snapshot completeness','warn',
            'Legacy or unverified-count snapshot. Download again online before release sign-off');
        }
      }else add('snapshot','Downloaded study snapshot completeness','fail',
        'No readable saved study snapshot');
    }catch(e){add('snapshot','Downloaded study snapshot completeness','fail',
      'Cannot inspect local pack: '+String(e.message||e));}
    try{
      const jobs=owner?await offline.pending(owner):[];
      for(const job of jobs)if(job&&job.kind in pendingCounts)pendingCounts[job.kind]++;
      const total=jobs.length;
      add('queue','Pending result visibility',total?'warn':'pass',
        total?total+' session(s) still local, including '+pendingCounts.japanese+
          ' Japanese; export a private backup before any reset':
          'No unsynced Hub/Quick/Japanese sessions');
    }catch(e){add('queue','Pending result visibility','fail',
      'Could not inspect local results: '+String(e.message||e));}
    let receipts=0;
    try{receipts=owner?(await offline.receipts(owner)).length:0;
      add('receipts','Synchronization receipts','pass',
        receipts+' verified receipt(s) retained locally');}
    catch(e){add('receipts','Synchronization receipts','warn',
      'Could not inspect receipts: '+String(e.message||e));}
    let quotaMB=null,usedMB=null,persistent='unknown';
    if(storage&&typeof storage.estimate==='function'){
      try{
        const estimate=await storage.estimate();
        quotaMB=Number.isFinite(estimate.quota)?
          Math.round(estimate.quota/1048576):null;
        usedMB=Number.isFinite(estimate.usage)?
          Math.round(estimate.usage/1048576*10)/10:null;
        if(typeof storage.persisted==='function')
          persistent=await storage.persisted()?'persistent':'not-guaranteed';
        add('storage','Browser storage estimate','pass',
          'Used '+(usedMB??'unknown')+' MB; quota '+(quotaMB??'unknown')+
          ' MB; persistence '+persistent);
      }catch(e){add('storage','Browser storage estimate','warn',
        'Storage estimate unavailable on this browser');}
    }else add('storage','Browser storage estimate','warn',
      'Browser does not provide quota estimates');
    // No network, authentication or Apple Pencil checks are performed here.
    add('hardware','Physical iPad acceptance','warn',
      'Requires airplane-mode relaunch, Pencil, VoiceOver, rotation and reconnect tests');
    const summary=summarizeStatuses(checks);
    return {format:'wt-ipad-diagnostics-v8',release:RELEASE,
      generatedAt:new Date().toISOString(),
      checks,summary,pendingCounts,snapshot,
      storage:{usedMB,quotaMB,persistent},
      // No account ID, email, token, answer, notes or handwriting strokes.
      sensitiveFieldsIncluded:false};
  }
  root.WTRelease={readCompleteSnapshot,audit,summarizeStatuses,RELEASE,
    tableNames:()=>TABLES.map(t=>t.name)};
})(window);
