/* Japanese source browser — reads the japanese_* project the way the study app does.
   Goi (JLPT level) · Kanji books → chapters · Self-study topics. */
const JP = {
  url: (typeof JP_URL!=='undefined' && JP_URL) || 'https://ulgrfumbwjovbjzjiems.supabase.co',
  key: (typeof JP_ANON_KEY!=='undefined' && JP_ANON_KEY) || ''
};
window.JP=JP;
let JPS = {tab:'goi', levels:null, books:null, chapters:null, topics:null, book:null, level:null, days:null, err:null, busy:false, n:20, conn:false, mode:'weak', dir:'k2r', newRate:10, dueCount:null, streak:0};
const JP_MODES=[['weak','Weak first'],['due','Due for review'],['new','Not yet tested'],['random','Random']];
const JP_DIRS=[['k2r','漢字 → reading'],['r2k','かな → kanji'],['mix','Mixed']];
const JP_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* progress.user_id is a uuid in that project — only filter when we actually have one */
function jpUserFilter(){ const u=(ghCfg().user||'').trim(); return JP_UUID.test(u)?`user_id=eq.${u}&`:''; }

function jpKey(){ return JP.key || (ghCfg().key||''); }
function jpReady(){ return !!(JP.url && jpKey()); }
async function jpGet(path, count){
  const h={apikey:jpKey(), Authorization:'Bearer '+jpKey()};
  if(count) h.Prefer='count=exact';
  const r=await fetch(JP.url+'/rest/v1/'+path, {headers:h});
  if(!r.ok){ const b=await r.json().catch(()=>({})); throw new Error(b.message||('HTTP '+r.status)); }
  const total=count ? parseInt((r.headers.get('content-range')||'/0').split('/')[1])||0 : null;
  return {rows: await r.json(), total};
}
const jpSetTab=t=>{ JPS.tab=t; JPS.err=null; JPS.book=null; JPS.level=null; renderGhost(); jpLoadTab(); };
window.jpSetTab=jpSetTab;

async function jpLoadTab(){
  if(!jpReady()){ JPS.err=null; JPS.conn=true; renderGhost(); return; }
  JPS.busy=true;
  try{
    if(JPS.tab==='goi' && !JPS.levels){
      const out=[];
      for(const lv of ['N1','N2','N3','N4','N5']){
        const {total}=await jpGet(`japanese_unified_words?jlpt_level=eq.${lv}&select=id&limit=1`, true);
        if(total) out.push({level:lv, total});
      }
      JPS.levels=out;
    }
    if(JPS.tab==='kanji' && !JPS.books){
      const {rows}=await jpGet('japanese_unified_word_books?select=book_code,book_name,chapter&limit=20000');
      const m={};
      for(const r of rows){ const k=r.book_code||r.book_name; if(!k) continue; (m[k]=m[k]||{code:r.book_code, name:r.book_name||r.book_code, words:0, ch:new Set()}); m[k].words++; if(r.chapter!=null) m[k].ch.add(String(r.chapter)); }
      JPS.books=Object.values(m).map(b=>({...b, chapters:[...b.ch].sort((a,b)=>(parseFloat(a)||0)-(parseFloat(b)||0))})).sort((a,b)=>b.words-a.words);
    }
    if(JPS.tab==='self' && !JPS.topics){
      const {rows}=await jpGet('japanese_self_study_topics?select=id,topic_name,word_count,topic_color&order=topic_name&limit=200');
      JPS.topics=rows;
    }
    JPS.err=null;
  }catch(e){ JPS.err=String(e.message||e); }
  JPS.busy=false; renderGhost();
  jpDueCount().then(()=>{ if(GH_PANEL) renderGhost(); });
}
window.jpLoadTab=jpLoadTab;
window.jpStartSequence=async()=>{
  JPS.busy=true; JPS.err=null; renderGhost();
  const today=new Date().toISOString().slice(0,10);
  try{
    const {rows:due}=await jpGet(`japanese_user_reviews?next_review=lte.${today}&select=kanji,next_review&order=next_review.asc&limit=${JPS.n}`);
    let words=[];
    if(due.length){
      const inList='('+due.map(d=>'"'+String(d.kanji).replace(/"/g,'')+'"').join(',')+')';
      const {rows}=await jpGet(`japanese_unified_words?kanji=in.${encodeURIComponent(inList)}&select=id,kanji,hiragana,meaning_en&limit=${JPS.n}`);
      const pos=new Map(due.map((d,i)=>[d.kanji,i]));
      words=rows.sort((a,b)=>(pos.has(a.kanji)?pos.get(a.kanji):999)-(pos.has(b.kanji)?pos.get(b.kanji):999));
    }
    const room=Math.min(JPS.n-words.length, JPS.newRate);
    if(room>0){
      const {rows:seen}=await jpGet('japanese_user_reviews?select=kanji&limit=20000');
      const known=new Set(seen.map(r=>r.kanji));
      const {total}=await jpGet('japanese_unified_words?select=id&limit=1', true);
      const off=Math.floor(Math.random()*Math.max(1,total-room*10));
      const {rows}=await jpGet(`japanese_unified_words?select=id,kanji,hiragana,meaning_en&order=id&offset=${off}&limit=${room*10}`);
      words=words.concat(rows.filter(r=>!known.has(r.kanji)&&r.kanji&&r.hiragana).slice(0,room));
    }
    if(!words.length) throw new Error('Nothing due and no new words found — all caught up.');
    jpSetItems(words, 'Sequence · '+due.length+' due'+(words.length>due.length?' + '+(words.length-due.length)+' new':''), true);
  }catch(e){ JPS.err=String(e.message||e); JPS.busy=false; renderGhost(); }
};
async function jpDueCount(){
  const today=new Date().toISOString().slice(0,10);
  try{
    const {total}=await jpGet(`japanese_user_reviews?next_review=lte.${today}&select=kanji&limit=1`, true);
    JPS.dueCount=total;
    const {rows}=await jpGet('japanese_user_reviews?select=last_review&order=last_review.desc&limit=400');
    const days=new Set(rows.map(r=>String(r.last_review||'').slice(0,10)).filter(Boolean));
    let st=0, d=new Date();
    if(!days.has(d.toISOString().slice(0,10))) d.setDate(d.getDate()-1);
    while(days.has(d.toISOString().slice(0,10))){ st++; d.setDate(d.getDate()-1); }
    JPS.streak=st;
  }catch(e){}
}

function jpChip(label, sub, on, click){
  return `<button class="card" onclick="${click}" style="text-align:left;padding:12px 14px;border:1px solid ${on?'#c0392b':'var(--line)'};cursor:pointer;background:#fff">
    <div style="font-weight:600;font-size:14px">${esc(label)}</div><div style="font-size:12px;color:var(--mute)">${esc(sub)}</div></button>`;
}
window.jpConnSave=()=>{
  const u=$('jp-url').value.trim().replace(/\/$/,''), k=$('jp-key').value.trim();
  if(u) { JP.url=u; ghCfgField('url',u); }
  if(k) { JP.key=k; ghCfgField('key',k); }
  ghCfgField('log', $('jp-log').value.trim()); ghCfgField('user', $('jp-user').value.trim()); ghCfgField('type', $('jp-type').value.trim()||'ghost');
  JPS.levels=JPS.books=JPS.topics=null; JPS.conn=false; jpLoadTab();
};
window.jpConnToggle=()=>{ JPS.conn=!JPS.conn; renderGhost(); };
function jpConnHtml(){
  const c=ghCfg();
  if(!JPS.conn) return `<div style="margin-top:12px"><button class="btn sm ghost" onclick="jpConnToggle()">Connection settings</button></div>`;
  return `<div style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
    <div class="formrow" style="margin-top:0">
      <div style="flex:1;min-width:230px"><label>Project URL</label><input id="jp-url" style="width:100%" value="${esc(JP.url||c.url||'')}"></div>
      <div style="flex:1;min-width:230px"><label>Anon key</label><input id="jp-key" style="width:100%" placeholder="eyJhbGciOi…" value="${esc(jpKey())}"></div>
    </div>
    <div class="formrow">
      <div><label>Also log to (optional)</label><input id="jp-log" value="${esc(c.log||'')}" placeholder="leave blank" style="width:220px"></div>
      <div><label>user_id</label><input id="jp-user" placeholder="${esc(ghWho())} (your login)" value="${esc(c.user||'')}" style="width:190px"></div>
      <div><label>test_type</label><input id="jp-type" value="${esc(c.type||'ghost')}" style="width:110px"></div>
      <button class="btn sm" onclick="jpConnSave()">Save &amp; reload</button>
    </div></div>`;
}
window.jpPanelHtml=function(){
  if(!GH_PANEL) return '';
  const tabs=[['goi','Goi · JLPT'],['kanji','Kanji books'],['self','Self study']].map(([k,l])=>`<button class="pill-t ${JPS.tab===k?'on':''}" onclick="jpSetTab('${k}')">${l}</button>`).join('');
  const pickRow=JPS.tab==='goi';
  let body='';
  const errHtml = JPS.err?`<p class="msg err" style="margin-top:12px">${esc(JPS.err)}</p>`:'';
  if(!jpReady()) body=`<p class="msg err" style="margin-top:12px">No anon key yet — open <b>Connection settings</b> below and paste your Japanese project's URL and anon key (or set JP_ANON_KEY at the top of ghost_test.js).</p>`;
  else if(JPS.busy) body=`<p style="color:var(--mute);margin-top:12px">Loading…</p>`;
  else if(JPS.tab==='goi') body = JPS.level ? `<button class="btn sm ghost" style="margin:12px 0" onclick="JPS.level=null;renderGhost()">← Levels</button>
      <button class="btn sm" style="margin:12px 0 12px 8px" onclick="jpStartLevel('${esc(JPS.level)}')">Whole ${esc(JPS.level)} · ranked</button>
      <div class="jp-grid">${(JPS.days||[]).map(d=>{ const lb=d.week_day_label||('Week '+d.week+' Day '+d.day);
        return jpDayChip(lb, d.word_count||0, (JPS.done&&JPS.done[lb])||0); }).join('')||'<p style="color:var(--mute)">No lesson breakdown for this level.</p>'}</div>`
    : (JPS.levels ? `<div class="jp-grid">${JPS.levels.map(l=>jpChip('JLPT '+l.level, l.total.toLocaleString()+' words', false, `jpOpenLevel('${l.level}')`)).join('')}</div>` : '');
  else if(JPS.tab==='kanji') body = JPS.books ? (JPS.book
      ? `<button class="btn sm ghost" style="margin:12px 0" onclick="JPS.book=null;renderGhost()">← Books</button>
         <div class="jp-grid">${(JPS.books.find(b=>b.code===JPS.book)||{chapters:[]}).chapters.map(c=>jpChip('Chapter '+c, '', false, `jpStartChapter('${esc(JPS.book)}','${esc(c)}')`)).join('')}</div>`
      : `<div class="jp-grid">${JPS.books.map(b=>jpChip(b.name, b.words.toLocaleString()+' words · '+b.chapters.length+' chapters', false, `JPS.book='${esc(b.code)}';renderGhost()`)).join('')}</div>`) : '';
  else body = JPS.topics ? `<div class="jp-grid">${JPS.topics.map(t=>jpChip(t.topic_name, (t.word_count||0)+' words', false, `jpStartTopic('${esc(t.id)}','${esc(t.topic_name)}')`)).join('')}</div>` : '';
  return `<div class="card" style="margin-bottom:16px">
    <h3 style="margin-bottom:2px">Japanese database</h3>
    <p style="color:var(--mute);font-size:13px;margin:0 0 12px">Same collections as your study app. Pick a set — it loads straight into the ghost sheet, and results update <span class="mono">japanese_user_reviews</span> (counts + last 20 attempts).</p>
    <div class="pillbar">${tabs}<span style="margin-left:auto;font-size:12px;color:var(--mute)">Words per test <input type="number" min="5" max="60" value="${JPS.n}" onchange="JPS.n=parseInt(this.value)||20" style="width:70px"></span></div>
    <div class="pillbar" style="margin-top:8px"><span style="font-size:11px;letter-spacing:1px;color:var(--mute);text-transform:uppercase;align-self:center;margin-right:4px">Direction</span>${JP_DIRS.map(([k,l])=>`<button class="pill-t ${JPS.dir===k?'on':''}" onclick="JPS.dir='${k}';renderGhost()">${l}</button>`).join('')}</div>
    <div style="margin-top:14px;padding:14px;border:1px solid #c0392b;border-radius:8px;background:#fdf6f4">
      <div class="pillbar" style="margin:0;align-items:center"><b style="font-size:14px">Sequence mode</b>
      <span style="font-size:12px;color:var(--mute)">${JPS.dueCount==null?'':(JPS.dueCount+' due today')}${JPS.streak?' · 🔥 '+JPS.streak+'-day streak':''}</span>
      <button class="btn sm" style="margin-left:auto" onclick="jpStartSequence()">Start today’s ${JPS.n}</button></div>
      <p style="color:var(--mute);font-size:12.5px;margin:10px 0 0">Due words first (most overdue first), topped up with up to ${JPS.newRate} new ones. Ladder 1·2·4·8·16·30·60·120 days — a ✗ resets the word and it returns 5 items later in the same test.
      <span style="margin-left:6px">New per session <input type="number" min="0" max="20" value="${JPS.newRate}" onchange="JPS.newRate=parseInt(this.value)||0" style="width:60px"></span></p>
    </div>
    <div style="margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:8px;background:#fbfaf6">
      <div class="pillbar" style="margin:0"><span style="font-size:11px;letter-spacing:1px;color:var(--mute);text-transform:uppercase;align-self:center;margin-right:4px">Smart set</span>${JP_MODES.map(([k,l])=>`<button class="pill-t ${JPS.mode===k?'on':''}" onclick="JPS.mode='${k}';renderGhost()">${l}</button>`).join('')}
      <button class="btn sm" style="margin-left:auto" onclick="jpStartSmart()">Start · ${JPS.n} words</button></div>
      <p style="color:var(--mute);font-size:12.5px;margin:10px 0 0">Pulls across your whole vocabulary — no chapter needed. Or browse a specific set below (the same ranking is applied inside it).</p>
    </div>
    ${errHtml}${body}${jpConnHtml()}</div>`;
};
async function jpWords(path, label, order){
  GH.seq=false; JPS.busy=true; renderGhost();
  try{
    let {rows}=await jpGet(path);
    if(order&&order.length){ const pos=new Map(order.map((id,i)=>[String(id),i])); rows=rows.slice().sort((a,b)=>(pos.has(String(a.id))?pos.get(String(a.id)):1e9)-(pos.has(String(b.id))?pos.get(String(b.id)):1e9)); }
    const usable=rows.filter(r=>r.kanji&&r.hiragana);
    const split=JPS.dir==='mix'?Math.ceil(usable.length*0.75):(JPS.dir==='r2k'?0:usable.length);
    const items=usable.map((r,i)=>{
      const rev = i>=split;
      return {id:'jp-'+(r.id||i), topic_id:'jp', number:i+1, unit_no:i+1, prompt:rev?r.hiragana:r.kanji, answer:rev?r.kanji:r.hiragana, kanji:r.kanji, rev, subtitle:r.meaning_en||'', src:'jp'};
    });
    if(!items.length) throw new Error('No words with both kanji and reading in that set.');
    GH.ext={label, items}; GH.marks={}; GH.strokes={}; GH.strokes=[]; GH_PANEL=false; JPS.err=null;
  }catch(e){ JPS.err=String(e.message||e); }
  JPS.busy=false; renderGhost();
}
window.jpStartLevel=async lv=>{
  JPS.busy=true; renderGhost();
  try{
    if(JPS.mode==='random'){
      const off=Math.floor(Math.random()*Math.max(1,((JPS.levels.find(x=>x.level===lv)||{}).total||JPS.n)-JPS.n));
      await jpWords(`japanese_unified_words?jlpt_level=eq.${lv}&select=id,kanji,hiragana,meaning_en&order=id&offset=${off}&limit=${JPS.n}`, 'JLPT '+lv+' · random');
      return;
    }
    const ids=await jpRanked(lv);
    if(!ids.length) throw new Error(JPS.mode==='due'?'Nothing is due for review in '+lv+' yet.':JPS.mode==='new'?'Every '+lv+' word has been tested — try Weak first.':'No rated words in '+lv+' yet — try Random.');
    await jpWords(`japanese_unified_words?id=in.(${ids.join(',')})&select=id,kanji,hiragana,meaning_en&limit=${JPS.n}`, 'JLPT '+lv+' · '+(JP_MODES.find(m=>m[0]===JPS.mode)||[])[1], ids);
  }catch(e){ JPS.err=String(e.message||e); JPS.busy=false; renderGhost(); }
};
/* uses your existing ratings: japanese_unified_user_progress (marking, next_review_date, times_wrong) */
async function jpRanked(lv){
  const who=ghCfg().user||ghWho();
  const {rows:lvw}=await jpGet(`japanese_unified_words?jlpt_level=eq.${lv}&select=id&limit=20000`);
  const pool=new Set(lvw.map(r=>r.id));
  const {rows:prog}=await jpGet(`japanese_unified_user_progress?${jpUserFilter()}select=word_id,marking,next_review_date,times_wrong,times_correct&limit=20000`);
  const seen=new Map(prog.filter(p=>pool.has(p.word_id)).map(p=>[p.word_id,p]));
  if(JPS.mode==='new') return [...pool].filter(id=>!seen.has(id)).slice(0,JPS.n);
  const today=new Date().toISOString().slice(0,10);
  let list=[...seen.values()];
  if(JPS.mode==='due') list=list.filter(p=>!p.next_review_date||p.next_review_date<=today);
  const rank=p=>jpRank(p);
  list.sort((a,b)=>rank(a)-rank(b) || (b.times_wrong||0)-(a.times_wrong||0) || String(a.next_review_date||'').localeCompare(String(b.next_review_date||'')));
  return list.slice(0,JPS.n).map(p=>p.word_id);
}
window.jpStartChapter=async(book,ch)=>{
  JPS.busy=true; renderGhost();
  try{
    const {rows}=await jpGet(`japanese_unified_word_books?book_code=eq.${encodeURIComponent(book)}&chapter=eq.${encodeURIComponent(ch)}&select=word_id&limit=2000`);
    const ids=rows.map(r=>r.word_id).filter(Boolean);
    if(!ids.length) throw new Error('No words in that chapter.');
    const bk=(JPS.books.find(b=>b.code===book)||{}).name||book;
    const ordered=await jpRankIds(ids);
    await jpWords(`japanese_unified_words?id=in.(${ordered.join(',')})&select=id,kanji,hiragana,meaning_en&limit=${JPS.n}`, bk+' · Ch '+ch, ordered);
  }catch(e){ JPS.err=String(e.message||e); JPS.busy=false; renderGhost(); }
};
/* order an explicit id list by the same rating rules (used by chapters) */
async function jpRankIds(ids){
  if(JPS.mode==='random') return ids.slice(0,JPS.n);
  try{
    const who=ghCfg().user||ghWho();
    const {rows:prog}=await jpGet(`japanese_unified_user_progress?${jpUserFilter()}word_id=in.(${ids.join(',')})&select=word_id,marking,next_review_date,times_wrong,times_correct&limit=5000`);
    const seen=new Map(prog.map(p=>[p.word_id,p]));
    if(JPS.mode==='new'){ const fresh=ids.filter(i=>!seen.has(i)); return (fresh.length?fresh:ids).slice(0,JPS.n); }
    const today=new Date().toISOString().slice(0,10);
    const sorted=[...ids].sort((a,b)=>{ const pa=seen.get(a),pb=seen.get(b);
      const s=p=>{ if(!p) return JPS.mode==='due'?9:5; if(JPS.mode==='due'&&p.next_review_date&&p.next_review_date>today) return 9; return jpRank(p); };
      return s(pa)-s(pb) || ((pb&&pb.times_wrong)||0)-((pa&&pa.times_wrong)||0); });
    return sorted.slice(0,JPS.n);
  }catch(e){ return ids.slice(0,JPS.n); }
}
function jpRank(p){ const m=String(p.marking==null?'':p.marking).toLowerCase();
  if(/1|wrong|again|hard|x|✕/.test(m)) return 0;
  if(/2|unsure|maybe|\?/.test(m)) return 1;
  if(/3|ok|good/.test(m)) return 2;
  if(/4|easy/.test(m)) return 3;
  if(/5|known|perfect/.test(m)) return 4;
  return (p.times_wrong||0)>(p.times_correct||0)?0:2; }
function jpSetItems(rows, label, seq){
  GH.seq=!!seq;
  const usable=rows.filter(r=>r.kanji&&r.hiragana);
  if(!usable.length) throw new Error('No words with both kanji and reading in that set.');
  const split=JPS.dir==='mix'?Math.ceil(usable.length*0.75):(JPS.dir==='r2k'?0:usable.length);
  GH.ext={label, items:usable.map((r,i)=>{ const rev=i>=split;
    return {id:'jp-'+(r.id||i), topic_id:'jp', number:i+1, unit_no:i+1, prompt:rev?r.hiragana:r.kanji, answer:rev?r.kanji:r.hiragana, kanji:r.kanji, rev, subtitle:r.meaning_en||'', src:'jp'}; })};
  GH.marks={}; GH.strokes=[]; GH_PANEL=false; JPS.err=null; JPS.busy=false; renderGhost();
}
function jpDayChip(label, total, done){
  const left=Math.max(0,total-done), pct=total?Math.round(100*done/total):0;
  return `<button class="card" onclick="jpStartDay('${esc(JPS.level)}','${esc(label)}')" style="text-align:left;padding:12px 14px;border:1px solid ${total&&done>=total?'#2e8b46':'var(--line)'};cursor:pointer;background:#fff">
    <div style="font-weight:600;font-size:14px">${esc(label)}</div>
    <div style="font-size:12px;margin-top:2px"><span style="color:#2e8b46;font-weight:600">${done} done</span> <span style="color:var(--mute)">·</span> <span style="color:#c0392b;font-weight:600">${left} left</span> <span style="color:var(--mute)">of ${total}</span></div>
    <div class="meter" style="margin-top:8px;height:4px"><i style="width:${pct}%;background:#2e8b46"></i></div></button>`;
}
window.jpOpenLevel=async lv=>{
  JPS.level=lv; JPS.days=null; JPS.busy=true; JPS.err=null; renderGhost();
  try{
    const {rows}=await jpGet(`japanese_v_words_per_day?level=eq.${encodeURIComponent(lv)}&select=level,week,day,week_day_label,word_count&order=week.asc,day.asc&limit=2000`);
    JPS.days=rows;
    await jpCoverage(lv);
  }catch(e){
    try{ const {rows}=await jpGet(`japanese_vocabulary?level=eq.${encodeURIComponent(lv)}&select=schedule_id&limit=5000`);
      const m={}; for(const r of rows){ const k=r.schedule_id; if(k!=null) m[k]=(m[k]||0)+1; }
      JPS.days=Object.keys(m).sort((a,b)=>a-b).map(k=>({week_day_label:'Lesson '+k, word_count:m[k]}));
    }catch(e2){ JPS.err='Could not load '+lv+' lessons: '+(e.message||e); }
  }
  JPS.busy=false; renderGhost();
};
/* how much of each lesson has already been tested (japanese_daily_test_log) */
async function jpCoverage(lv){
  JPS.done={}; JPS.seen=null;
  try{
    const {rows:all}=await jpGet(`japanese_v_vocabulary_full?level=eq.${encodeURIComponent(lv)}&select=week_day_label,kanji&limit=20000`);
    const words={};
    for(const r of all){ (words[r.week_day_label]=words[r.week_day_label]||[]).push(r.kanji); }
    const {rows:log}=await jpGet('japanese_user_reviews?select=kanji&limit=20000');
    const seen=new Set(log.map(r=>r.kanji));
    for(const k of Object.keys(words)) JPS.done[k]=words[k].filter(w=>seen.has(w)).length;
    JPS.seen=seen;
  }catch(e){ JPS.done=null; }
}
window.jpStartDay=async(lv,label)=>{
  JPS.busy=true; JPS.err=null; renderGhost();
  const q=`japanese_v_vocabulary_full?level=eq.${encodeURIComponent(lv)}&week_day_label=eq.${encodeURIComponent(label)}&select=id,kanji,hiragana,meaning_en&limit=500`;
  try{
    const {rows}=await jpGet(q);
    const ids=rows.map(r=>r.id).filter(v=>v!=null);
    const untested=JPS.seen?rows.filter(r=>r.kanji&&!JPS.seen.has(r.kanji)):[];
    if(untested.length&&untested.length<rows.length){
      jpSetItems(untested.slice(0,JPS.n), lv+' · '+label+' · '+untested.length+' left');
      return;
    }
    const ordered=ids.length?await jpRankIds(ids):[];
    const pick=new Set(ordered.map(String));
    const chosen=(ordered.length?rows.filter(r=>pick.has(String(r.id))).sort((a,b)=>ordered.indexOf(a.id)-ordered.indexOf(b.id)):rows).slice(0,JPS.n);
    jpSetItems(chosen, lv+' · '+label);
  }
  catch(e){ JPS.err=String(e.message||e); JPS.busy=false; renderGhost(); }
};
window.jpStartSmart=async()=>{
  JPS.busy=true; JPS.err=null; renderGhost();
  const today=new Date().toISOString().slice(0,10);
  try{
    let ids=[];
    if(JPS.mode==='random'){
      const {total}=await jpGet('japanese_unified_words?select=id&limit=1', true);
      const off=Math.floor(Math.random()*Math.max(1,total-JPS.n));
      await jpWords(`japanese_unified_words?select=id,kanji,hiragana,meaning_en&order=id&offset=${off}&limit=${JPS.n}`, 'Random · all levels');
      return;
    }
    if(JPS.mode==='due'){
      const {rows}=await jpGet(`japanese_unified_user_progress?${jpUserFilter()}next_review_date=lte.${today}&select=word_id,next_review_date&order=next_review_date.asc&limit=${JPS.n}`);
      ids=rows.map(r=>r.word_id);
      if(!ids.length) throw new Error('Nothing is due for review today.');
    } else if(JPS.mode==='weak'){
      const {rows}=await jpGet(`japanese_unified_user_progress?${jpUserFilter()}select=word_id,marking,next_review_date,times_wrong,times_correct&limit=5000`);
      if(!rows.length) throw new Error('No ratings found yet — try “Not yet tested” or Random.');
      rows.sort((a,b)=>jpRank(a)-jpRank(b) || (b.times_wrong||0)-(a.times_wrong||0));
      ids=rows.slice(0,JPS.n).map(r=>r.word_id);
    } else {
      const {rows:prog}=await jpGet(`japanese_unified_user_progress?${jpUserFilter()}select=word_id&limit=20000`);
      const seen=new Set(prog.map(p=>p.word_id));
      const {total}=await jpGet('japanese_unified_words?select=id&limit=1', true);
      const off=Math.floor(Math.random()*Math.max(1,total-JPS.n*8));
      const {rows}=await jpGet(`japanese_unified_words?select=id,kanji,hiragana,meaning_en&order=id&offset=${off}&limit=${JPS.n*8}`);
      const fresh=rows.filter(r=>!seen.has(r.id)&&r.kanji&&r.hiragana).slice(0,JPS.n);
      if(!fresh.length) throw new Error('No untested words in that slice — try again.');
      const split=JPS.dir==='mix'?Math.ceil(fresh.length*0.75):(JPS.dir==='r2k'?0:fresh.length);
      GH.ext={label:'Not yet tested · all levels', items:fresh.map((r,i)=>{ const rev=i>=split;
        return {id:'jp-'+r.id, topic_id:'jp', number:i+1, unit_no:i+1, prompt:rev?r.hiragana:r.kanji, answer:rev?r.kanji:r.hiragana, kanji:r.kanji, rev, subtitle:r.meaning_en||'', src:'jp'}; })};
      GH.marks={}; GH.strokes=[]; GH_PANEL=false; JPS.busy=false; renderGhost(); return;
    }
    await jpWords(`japanese_unified_words?id=in.(${ids.join(',')})&select=id,kanji,hiragana,meaning_en&limit=${JPS.n}`, (JP_MODES.find(m=>m[0]===JPS.mode)||[])[1]+' · all levels', ids);
  }catch(e){ JPS.err=String(e.message||e); JPS.busy=false; renderGhost(); }
};
window.jpStartTopic=(id,name)=>jpWords(`japanese_self_study_words?topic_id=eq.${encodeURIComponent(id)}&select=id,kanji,hiragana,meaning_en&limit=${JPS.n}`, name);
