/* Phase 4 — local, account-scoped vocabulary packs.
 * No remote fetch, no Technical-project API keys and NO progress sync. */
(function(){
  'use strict';
  let expanded=false,loading=false,error='',packs=[],sessions=[],loadedFor=null;
  let writeQueue=Promise.resolve();
  const maxBytes=2*1024*1024;
  const core=window.WTMultiCore;
  const owner=()=>DEMO?'demo':SESSION&&SESSION.user&&SESSION.user.id||'';
  const packKey=id=>'wt-language-packs-v1:'+id;
  const evidenceKey=id=>'wt-language-evidence-v1:'+id;
  const escaping=s=>esc(String(s==null?'':s));
  const languageLabel=code=>core.LANGUAGES[code]||code.toUpperCase();
  const safe=key=>/^[0-9a-f-]{36}$/i.test(key);
  async function read(name,id){
    if(DEMO)return name==='packs'?packs:sessions;
    return (await idb.get((name==='packs'?packKey:evidenceKey)(id)))||[];
  }
  function serialize(operation){
    const next=writeQueue.catch(()=>{}).then(operation);
    writeQueue=next;
    return next;
  }
  async function load(){
    const id=owner();if(!id)throw Error('Sign in before using language packs');
    if(loadedFor===id)return;
    if(loadedFor!==id){packs=[];sessions=[];loadedFor=null;}
    loading=true;error='';
    try{
      const all=await Promise.all([read('packs',id),read('evidence',id)]);
      packs=Array.isArray(all[0])?all[0]:[];
      sessions=Array.isArray(all[1])?all[1]:[];
      loadedFor=id;
    }catch(e){error='Could not open saved vocabulary: '+(e.message||e);throw e;}
    finally{loading=false;}
  }
  async function changePacks(next,id){
    if(DEMO){packs=next;return;}
    await idb.set(packKey(id),next);
    packs=next;
  }
  async function changeSessions(next,id){
    if(DEMO){sessions=next;return;}
    await idb.set(evidenceKey(id),next);
    sessions=next;
  }
  function html(){
    if(!expanded)return '';
    const entries=packs.map(p=>{
      const count=sessions.filter(x=>x.pack_key===p.pack_key).length;
      const buttons=core.modes(p).map(mode=>'<button class="btn sm ghost" type="button" onclick="ghOpenLanguagePack(\''+
        p.pack_key+'\',\''+mode+'\')">'+escaping(core.MODES[mode])+'</button>').join('');
      return '<div class="ml-pack"><div class="ml-pack-title"><b>'+escaping(p.name)+
        '</b><span class="chip">'+escaping(languageLabel(p.language_code))+'</span></div>'+
        '<p class="ml-sub">'+p.items.length+' vocabulary entries · '+count+' local writing session'+
        (count===1?'':'s')+' · '+escaping(p.original_format)+'</p>'+
        '<div class="ml-actions">'+buttons+'<button class="btn sm ghost danger" type="button" onclick="ghDeleteLanguagePack(\''+
        p.pack_key+'\')">Remove pack</button></div></div>';
    }).join('')||'<p class="ml-sub">No imported packs yet. Add one JSON export to begin.</p>';
    return '<section class="card ml-panel" aria-label="Multilingual vocabulary packs">'+
      '<div class="ml-heading"><div><h2>My multilingual writing packs</h2>'+
      '<p class="ml-sub">Japanese · Chinese · Burmese · Malay · Marathi and other Unicode scripts. Imported content stays on this device.</p></div>'+
      '<button class="btn sm ghost" type="button" onclick="ghToggleLanguagePacks()">Close</button></div>'+
      (error?'<p role="status" class="msg err">'+escaping(error)+'</p>':'')+
      '<div class="ml-upload"><label for="ml-file">Import vocabulary JSON (maximum 2 MB, 500 words)</label>'+
      '<input type="file" id="ml-file" accept=".json,application/json" onchange="ghUploadLanguagePack(this)" '+
      (loading?'disabled':'')+'>'+
      '<p class="ml-sub">Accepts wt-writing-pack-v1 or the future approved lex-v1-public-export. Public vocabulary only—no credentials or personal progress.</p>'+
      '<button class="btn sm ghost" type="button" onclick="ghDownloadLanguageTemplate()">Download sample JSON template</button></div>'+
      '<div class="ml-packs">'+entries+'</div>'+
      '<div class="ml-export"><button class="btn sm ghost" type="button" onclick="ghExportLanguageEvidence()" '+
      (!sessions.length?'disabled':'')+'>Export '+sessions.length+' local writing session'+
      (sessions.length===1?'':'s')+'</button>'+
      '<p class="ml-sub">Results are device-only. No cross-project user ID mapping or synchronized language ratings are claimed.</p></div></section>';
  }
  async function show(){
    expanded=!expanded;
    if(expanded){
      try{await load();}catch(e){toast('Language packs could not load. '+(e.message||e),6000);}
    }
    renderGhost();
  }
  async function upload(input){
    const file=input.files&&input.files[0];if(!file)return;
    const id=owner();if(!id){toast('Sign in to import a pack');return;}
    if(file.size>maxBytes){error='File is larger than 2 MB';renderGhost();return;}
    try{
      await load();
      const raw=await file.text();
      if(raw.length>maxBytes)throw Error('File is larger than 2 MB');
      const parsed=core.normalize(JSON.parse(raw));
      if(parsed.items.length>500)throw Error('Pack too large');
      const match=packs.find(p=>p.language_code===parsed.language_code&&
        p.name===parsed.name&&JSON.stringify(p.items)===JSON.stringify(parsed.items));
      if(match){toast('This same vocabulary pack is already imported');renderGhost();return;}
      if(packs.length>=12)throw Error('Maximum 12 packs. Remove one before importing another.');
      if(!crypto.randomUUID)throw Error('A secure browser connection is required for pack IDs.');
      const saved={...parsed,pack_key:crypto.randomUUID(),imported_at:new Date().toISOString()};
      await serialize(async()=>{
        const fresh=await read('packs',id);
        await changePacks([...fresh,saved],id);
      });
      error='';toast(parsed.items.length+' '+languageLabel(parsed.language_code)+' entries imported. No remote progress was changed.',5500);
    }catch(e){error='Import failed: '+(e.message||e);toast(error,7500);}
    renderGhost();
  }
  async function prepareSwitch(){
    if(GH.savePrepared&&!GH.locked){toast('Retry the interrupted handwriting save before changing packs.',6500);return false;}
    if(GH.strokes.length||Object.values(GH.marks||{}).some(Boolean)){
      const confirmed=await ask({title:'Start a different writing sheet?',
        body:'<p>Your unfinished handwriting and marks on the current sheet will be cleared. Save results first if you need them.</p>',
        ok:'Start new sheet',cancel:'Keep writing',danger:true});
      if(!confirmed)return false;
    }
    return ghFresh()!==false;
  }
  async function open(key,mode){
    if(!safe(key)||!Object.prototype.hasOwnProperty.call(core.MODES,mode))return;
    if(loadedFor!==owner())await load();
    const pack=packs.find(p=>p.pack_key===key);if(!pack)return toast('Pack not available for this account');
    const items=core.sheet(pack,mode,20);
    if(!items.length)return toast('No entries have the fields needed for that writing direction.');
    if(!await prepareSwitch())return;
    GH.ext={src:'lex_import',owner:owner(),language:pack.language_code,script:pack.items[0]?.script||'',
      pack_key:pack.pack_key,mode,label:languageLabel(pack.language_code)+' · '+pack.name+
        ' · '+core.MODES[mode],items};
    GH.seq=false;GH_PANEL=false;expanded=false;renderGhost();
  }
  async function remove(key){
    const id=owner();if(!safe(key))return;
    await load();
    if(GH.ext?.src==='lex_import'&&GH.ext.pack_key===key){
      toast('Finish or switch away from this pack before removing it.',5500);return;
    }
    try{
      const draft=DEMO?null:await idb.get('gh-draft');
      if(draft?.ext?.src==='lex_import'&&draft.ext.owner===id&&draft.ext.pack_key===key){
        toast('A saved unfinished sheet uses this pack. Restore/finish that sheet first.',7000);return;
      }
    }catch(e){toast('Could not verify draft safety: '+e.message,6500);return;}
    const pack=packs.find(p=>p.pack_key===key);if(!pack)return;
    const yes=await ask({title:'Remove '+pack.name+' from this device?',
      body:'<p>The saved vocabulary pack will be removed, but its local writing history is preserved for export. No shared language database is changed.</p>',
      ok:'Remove local pack',cancel:'Keep pack',danger:true});
    if(!yes)return;
    try{await serialize(async()=>{
      const all=await read('packs',id);await changePacks(all.filter(p=>p.pack_key!==key),id);
    });}catch(e){toast('Remove failed: '+e.message,6000);return;}
    toast('Local vocabulary pack removed');renderGhost();
  }
  async function saveGhostEvidence(){
    const id=owner(),ext=GH.ext;
    if(!id||!ext||ext.src!=='lex_import'||ext.owner!==id)throw Error('Pack owner mismatch');
    await load();
    const pack=packs.find(p=>p.pack_key===ext.pack_key);
    if(!pack)throw Error('The source pack is missing. Restore the pack before saving.');
    const entry=core.evidence({sessionId:GH.sessionId,owner:id,pack,mode:ext.mode,
      items:GH.items,marks:GH.marks,when:GH.attemptTime});
    return serialize(async()=>{
      const rows=await read('evidence',id);
      if(rows.some(x=>x.session_id===entry.session_id))return false;
      if(rows.length>=200)throw Error('200 local sessions saved. Export your results before recording more; nothing was deleted.');
      await changeSessions([entry,...rows],id);
      return true;
    });
  }
  function downloadTemplate(){
    const content={format:'wt-writing-pack-v1',language_code:'my',
      name:'Burmese handwriting sample',items:[
        {id:'sample-1',form:'မင်္ဂလာပါ',reading:'mingalaba',meaning:'hello',script:'Mymr'},
        {id:'sample-2',form:'ရေ',reading:'ye',meaning:'water',script:'Mymr'}
      ]};
    const blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='Writing_Pack_Sample.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast('Sample vocabulary JSON downloaded. Replace entries with your own approved words.');
  }
  async function exportEvidence(){
    const id=owner();await load();
    if(!sessions.length)return toast('No local writing sessions to export');
    const ok=await ask({title:'Export private handwriting results?',
      body:'<p>This JSON contains your local marks, prompts, source IDs and account ID. Keep it private. It does not synchronize results to another language app.</p>',
      ok:'Export private results',cancel:'Not now'});
    if(!ok)return;
    const data={format:'wt-writing-evidence-bundle-v1',exported_at:new Date().toISOString(),
      sessions:sessions.filter(x=>x.owner_user_id===id)};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download='Writing_Hub_local_evidence_'+new Date().toISOString().slice(0,10)+'.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
    toast('Private evidence exported; no remote data was changed.',6000);
  }
  window.WTMulti={getOwner:owner,readPacks:async()=>{await load();return packs;},
    readEvidence:async()=>{await load();return sessions;},saveGhostEvidence};
  window.ghPackPanelHtml=html;
  window.ghToggleLanguagePacks=show;
  window.ghUploadLanguagePack=upload;
  window.ghOpenLanguagePack=open;
  window.ghDeleteLanguagePack=remove;
  window.ghDownloadLanguageTemplate=downloadTemplate;
  window.ghExportLanguageEvidence=exportEvidence;
})();
