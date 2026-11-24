/* Phase 4 — portable, script-neutral vocabulary contracts for handwriting.
 * Designed for a future approved lex-v1 reader. No DB credentials or writes. */
(function(root){
  'use strict';
  const FORMAT='wt-writing-pack-v1',LEX='lex-v1-public-export';
  const LANGUAGES={ja:'Japanese',zh:'Chinese',my:'Burmese',ms:'Malay',
    mr:'Marathi',hi:'Hindi'};
  const MODES={meaning:'Word → meaning',reading:'Word → reading',
    write:'Meaning or reading → write word'};
  const PRIVATE=/^(?:user_id|owner_user_id|access_token|refresh_token|service_role(?:_key)?|secret|password|authorization|session|raw_payload|user_evidence|auth|credentials)$/i;
  const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function verifyPublic(value,depth=0){
    if(depth>6)throw Error('Pack nesting is too deep');
    if(!value||typeof value!=='object')return;
    for(const [key,v] of Object.entries(value)){
      if(PRIVATE.test(key))throw Error('Personal or credential field is not permitted: '+key);
      if(v&&typeof v==='object'){
        if(Array.isArray(v)){if(v.length>600)throw Error('Too many records');for(const item of v)verifyPublic(item,depth+1);}
        else verifyPublic(v,depth+1);
      }
    }
  }
  function required(v,label,max=120){
    if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(label+' must be non-empty text under '+max+' characters');
    return v.trim().normalize('NFC');
  }
  function optional(v,max=250){
    if(v==null)return '';
    if(typeof v!=='string'||v.length>max)throw Error('Invalid text field');
    return v.trim().normalize('NFC');
  }
  function language(code){
    const s=required(code,'language_code',32).toLowerCase();
    if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(s))throw Error('Unsupported language code format');
    return s;
  }
  function normalize(data){
    if(!plain(data))throw Error('Vocabulary pack must be a JSON object');
    verifyPublic(data);
    if(data.format!==FORMAT&&data.format!==LEX)throw Error('Unknown pack format. Use wt-writing-pack-v1 or lex-v1-public-export');
    const lang=language(data.language_code);
    const name=required(data.name||data.title||('Vocabulary '+lang),'Pack name',120);
    const rows=data.format===FORMAT?data.items:data.records;
    if(!Array.isArray(rows)||!rows.length||rows.length>500)
      throw Error('A pack needs 1–500 vocabulary records');
    const normalized=[],keys=new Set();
    rows.forEach((r,index)=>{
      if(!plain(r))throw Error('Record '+(index+1)+' is not an object');
      const lex=data.format===LEX;
      const rawId=lex?r.id||r.sense_id||r.form_id||r.source_pk||r.entry_id:r.id;
      const id=required(rawId,'Record '+(index+1)+' ID',200);
      const form=required(lex?r.form_text:r.form,'Record '+(index+1)+' written form',250);
      const reading=optional(lex?(r.reading||r.transliteration):r.reading,250);
      const meaning=optional(lex?(r.gloss_text||r.gloss):r.meaning,350);
      if(!reading&&!meaning)throw Error('Record '+(index+1)+' needs a reading or meaning');
      const sourceApp=optional(lex?r.source_app:(r.source&&r.source.app),100);
      const sourceTable=optional(lex?r.source_table:(r.source&&r.source.table),100);
      const sourceProject=optional(lex?r.source_project:(r.source&&r.source.project),100);
      const sourceId=optional(lex?r.source_pk:(r.source&&r.source.id),200);
      const entryId=optional(lex?r.entry_id:(r.source&&r.source.entry_id),120);
      const formId=optional(lex?r.form_id:(r.source&&r.source.form_id),120);
      const senseId=optional(lex?r.sense_id:(r.source&&r.source.sense_id),120);
      const script=optional(lex?r.script_code:r.script,40);
      const sourcePkType=optional(lex?r.source_pk_type:(r.source&&r.source.pk_type),40);
      // Each pack record ID is unique; source provenance may still distinguish
      // the same spelling across different source projects or senses.
      const duplicate=id;
      if(keys.has(duplicate))throw Error('Duplicate source identifier in pack: '+id);
      keys.add(duplicate);
      normalized.push({id,form,reading,meaning,script,
        provenance:{source_project:sourceProject,source_app:sourceApp,
          source_table:sourceTable,source_pk:sourceId||id,source_pk_type:sourcePkType,entry_id:entryId,
          form_id:formId,sense_id:senseId}});
    });
    return {format:FORMAT,original_format:data.format,language_code:lang,
      name,items:normalized};
  }
  function modes(pack){
    if(!pack||!Array.isArray(pack.items))return [];
    return Object.keys(MODES).filter(mode=>
      pack.items.some(x=>mode==='meaning'?!!x.meaning:mode==='reading'?!!x.reading:!!(x.meaning||x.reading)));
  }
  function sheet(pack,mode,count=20){
    if(!Object.prototype.hasOwnProperty.call(MODES,mode))throw Error('Unsupported handwriting direction');
    if(!pack||!pack.pack_key||!Array.isArray(pack.items))throw Error('Invalid stored pack');
    const eligible=pack.items.filter(x=>mode==='meaning'?!!x.meaning:
      mode==='reading'?!!x.reading:!!(x.meaning||x.reading));
    const n=Math.max(1,Math.min(20,Number(count)||20));
    return eligible.slice(0,n).map((x,i)=>{
      const index=pack.items.indexOf(x);
      const write=mode==='write';
      const prompt=mode==='meaning'||mode==='reading'?x.form:(x.meaning||x.reading);
      const answer=mode==='meaning'?x.meaning:mode==='reading'?x.reading:x.form;
      return {id:'ml-'+pack.pack_key.replace(/[^a-zA-Z0-9]/g,'')+'-'+index+'-'+mode,
        topic_id:'ml-'+pack.pack_key.replace(/[^a-zA-Z0-9]/g,''),
        number:i+1,unit_no:i+1,prompt,answer,subtitle:x.meaning||x.reading,
        src:'lex_import',rev:write,script:x.script,language:pack.language_code,
        source_record:{record_id:x.id,form:x.form,reading:x.reading,meaning:x.meaning,
          script_code:x.script,...x.provenance}};
    });
  }
  function evidence({sessionId,owner,pack,mode,items,marks,when}){
    if(!sessionId||!owner||!pack||!Array.isArray(items)||!marks)throw Error('Invalid session evidence');
    const answers=items.filter(p=>[1,2,3].includes(marks[p.id])).map(p=>({
      item_id:p.id,source_record:p.source_record,
      skill:mode==='write'?'writing':'recognition',
      source_app:'writing_test',source_event_key:sessionId+':'+p.id,
      evidence_type:'self_checked_handwriting',
      direction:mode,raw_mark:marks[p.id],
      raw_label:marks[p.id]===1?'correct':marks[p.id]===2?'partial':'wrong',
      correct:marks[p.id]===1,
      prompt:p.prompt,reference:p.answer
    }));
    if(!answers.length)throw Error('No rated answers');
    return {format:'wt-writing-evidence-v1',session_id:sessionId,owner_user_id:owner,
      language_code:pack.language_code,pack_key:pack.pack_key,
      pack_name:pack.name,source_format:pack.original_format,mode,
      recorded_at:when||new Date().toISOString(),answers};
  }
  root.WTMultiCore={normalize,modes,sheet,evidence,LANGUAGES,MODES,FORMAT,LEX};
})(window);
