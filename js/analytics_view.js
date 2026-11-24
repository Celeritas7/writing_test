/* Learning Hub · Phase 3 analytics presentation and read-only refresh. */
(function(){
  'use strict';
  const STATE={days:30,subject:'all',busy:false,error:null,refreshedAt:null,complete:false};
  const METHODS=['cowork','self','ghost','other'];
  const $id=id=>document.getElementById(id);
  const active=()=>location.hash.split('/')[0]==='#analytics';
  const e=s=>esc(s==null?'':String(s));
  const pct=n=>n==null?'—':n+'%';
  function snapshot(){
    return WTAnalytics.collect({
      attempts:ATTEMPTS,problems:PROBLEMS,topics:TOPICS,subjects:SUBJECTS,
      days:STATE.days,subject:STATE.subject,now:new Date(),
      statusOf:(p,latest)=>pstatus(p,latest)
    });
  }
  function sources(data){
    return METHODS.map(id=>{
      const desc=WTAnalytics.SOURCES[id],s=data.methods[id],prev=s.previous;
      const trend=s.n>=5&&prev.n>=5?
        'Change from previous period: '+(s.pct-prev.pct>0?'+':'')+(s.pct-prev.pct)+' points':
        'Previous period: '+(prev.n?pct(prev.pct)+' from '+prev.n+' marks':'no marks')+
        ' · trend needs 5 marks in both periods';
      return '<article class="an-source an-'+id+'"><h3>'+e(desc.label)+'</h3>'+
        '<div class="an-large">'+pct(s.pct)+'</div><p>'+s.correct+'/'+s.n+
        ' correct marks</p><p class="an-muted">'+e(trend)+'</p></article>';
    }).join('');
  }
  function activity(data){
    const max=Math.max(1,...data.series.map(x=>x.count));
    const bars=data.series.map(x=>{
      const segments=METHODS.map(id=>'<span class="an-seg an-seg-'+id+
        '" style="height:'+((x[id]||0)/max*100).toFixed(2)+'%"></span>').join('');
      const detail=METHODS.filter(id=>x[id]).map(id=>WTAnalytics.SOURCES[id].label+' '+x[id]).join(', ');
      return '<div class="an-column" title="'+e(x.label+': '+x.count+' attempts; '+detail)+'">'+
        '<div class="an-count">'+x.count+'</div><div class="an-bar" aria-hidden="true">'+segments+
        '</div><div class="an-date">'+e(x.label)+'</div></div>';
    }).join('');
    const legend=METHODS.map(id=>'<span class="an-legend-item"><i class="an-dot an-seg-'+id+
      '"></i>'+e(WTAnalytics.SOURCES[id].label)+'</span>').join('');
    const rows=data.series.map(x=>'<tr><th scope="row">'+e(x.label)+'</th><td>'+x.count+
      '</td>'+METHODS.map(id=>'<td>'+x[id]+'</td>').join('')+'</tr>').join('');
    return '<section class="card an-section"><h2>Study activity</h2>'+
      '<p class="an-muted">Saved attempts by assessment type. Activity is not a mastery score.</p>'+
      '<div class="an-legend">'+legend+'</div>'+
      '<div class="an-plot" role="img" aria-label="'+e('Study attempts over '+data.days+
        ' days, '+data.attempts+' total; detailed counts in table below')+'">'+bars+'</div>'+
      '<details><summary>Show exact activity counts</summary><div class="an-table-wrap"><table class="tbl an-table"><thead><tr>'+
      '<th>Dates</th><th>Total</th>'+METHODS.map(id=>'<th>'+e(WTAnalytics.SOURCES[id].label)+'</th>').join('')+
      '</tr></thead><tbody>'+rows+'</tbody></table></div></details></section>';
  }
  function focus(data){
    if(!data.focus.length)return '<p class="an-muted">No currently weak or due questions in this subject. You can try new problems next.</p>';
    return data.focus.map(x=>'<article class="an-focus-item"><div class="an-focus-header"><strong>'+
      e(x.subtitle)+'</strong><span class="chip '+(x.state==='weak'?'weak':'due')+'">'+e(x.state)+
      '</span></div><div class="an-muted">'+e(x.topicName)+' · '+x.misses+
      ' incorrect marks in the last 90 days</div>'+
      (x.notes?'<p class="an-note"><b>Latest Cowork feedback:</b> '+e(x.notes.slice(0,300))+'</p>':'')+
      '<div class="an-actions"><button class="btn sm ghost an-topic-practice" data-topic="'+e(x.topicId)+
      '" data-mode="'+(x.state==='due'?'due':'weak')+'" type="button">Quick Practice topic</button><button class="btn sm ghost an-topic-build" data-topic="'+
      e(x.topicId)+'" type="button">Build worksheet</button></div></article>').join('');
  }
  function topics(data){
    if(!data.topics.length)return '<p class="an-muted">No matching Library topics.</p>';
    return data.topics.map(t=>{
      const coverage=t.total?Math.round(t.reviewed*100/t.total):0;
      return '<article class="an-topic-row"><div class="an-topic-head"><div><strong>'+e(t.name)+
        '</strong><div class="an-muted">'+e(t.subjectName)+'</div></div>'+
        '<button class="btn sm ghost an-topic-practice" data-topic="'+e(t.id)+
        '" data-mode="'+(t.weak?'weak':t.due?'due':t.new?'new':'random')+
        '" type="button">Practise</button></div>'+
        '<div class="an-topic-meta">'+t.reviewed+'/'+t.total+' questions ever attempted · '+
        t.attempts+' attempts in period · '+t.weak+' weak · '+t.due+' due</div>'+
        '<div class="an-coverage" role="progressbar" aria-label="'+e(t.name)+' questions attempted" '+
        'aria-valuemin="0" aria-valuemax="'+t.total+'" aria-valuenow="'+t.reviewed+
        '"><span style="width:'+coverage+'%"></span></div></article>';
    }).join('');
  }
  function controls(){
    const choices=[{id:'all',name:'All subjects'},...SUBJECTS].map(s=>
      '<option value="'+e(s.id)+'" '+(STATE.subject===s.id?'selected':'')+'>'+e(s.name)+'</option>').join('');
    const periods=[7,30,90].map(d=>'<button class="pill-t an-period '+(STATE.days===d?'on':'')+
      '" data-days="'+d+'" aria-pressed="'+(STATE.days===d)+'" type="button">'+d+' days</button>').join('');
    return '<div class="card an-controls"><div><label for="an-subject">Subject</label><select id="an-subject">'+
      choices+'</select></div><div><span class="an-control-label">Reporting window</span><div class="pillbar">'+
      periods+'</div></div></div>'+
      '<div class="an-toolbar"><button class="btn sm ghost" id="an-refresh" '+
      (STATE.busy||DEMO?'disabled':'')+'>'+(STATE.busy?'Refreshing…':'Refresh complete history')+
      '</button><button class="btn sm ghost" id="an-download" type="button">Download text report</button>'+
      '<span class="an-muted">'+(STATE.complete?'History refreshed '+
        new Date(STATE.refreshedAt).toLocaleString():
        'Using loaded results; refresh to include older attempts')+'</span></div>'+
      (STATE.error?'<div role="status" class="msg err">'+e(STATE.error)+'</div>':'');
  }
  window.renderAnalytics=function(){
    const data=snapshot(),coverage=data.bankCount?Math.round(data.reviewedCount*100/data.bankCount):0;
    $id('main').innerHTML='<div class="kicker">Learning analytics</div>'+
      '<h1 style="margin:4px 0 6px">Your learning trends</h1>'+
      '<p class="an-muted">See trends and choose what to practise next. Only Hub attempts are included; the separate Japanese Study database and device-only Japanese Ghost sessions are excluded.</p>'+
      controls()+'<div class="an-overview">'+
      '<div class="tile"><div class="kicker">Attempts · '+STATE.days+' days</div><div class="big">'+data.attempts+
        '</div><div class="sub">'+data.distinctRecent+' distinct questions</div></div>'+
      '<div class="tile"><div class="kicker">Library coverage</div><div class="big">'+coverage+
        '<small>%</small></div><div class="sub">'+data.reviewedCount+'/'+data.bankCount+
        ' questions attempted (not mastery)</div></div>'+
      '<div class="tile"><div class="kicker">Need attention now</div><div class="big">'+
        (data.statuses.weak+data.statuses.due)+'</div><div class="sub">'+data.statuses.weak+
        ' weak · '+data.statuses.due+' due</div></div></div>'+
      '<section class="an-section"><h2>Correct marks by assessment type</h2>'+
      '<p class="an-muted">Independent Cowork grades and self-checks are not interchangeable. Rates include only explicit correct/incorrect marks.</p>'+
      '<div class="an-sources">'+sources(data)+'</div></section>'+
      activity(data)+'<div class="an-layout"><section class="card an-section"><h2>Focus next</h2>'+
      '<p class="an-muted">'+data.repeated+' questions have at least two incorrect marks within the last 90 days. Listed questions are currently weak or due.</p>'+
      '<div class="an-focus">'+focus(data)+'</div></section>'+
      '<section class="card an-section"><h2>Topic progress</h2>'+
      '<p class="an-muted">Coverage means tried at least once, even if long ago. Weak/due reflect the current review state.</p>'+
      '<div class="an-topics">'+topics(data)+'</div></section></div>'+
      '<p class="an-muted an-footnote">Report window: '+e(data.period.start)+' – '+
      e(data.period.end)+'. Repeated misses always use 90 days. No answer keys or private grader files are exported.</p>';
    $id('an-subject').addEventListener('change',ev=>{STATE.subject=ev.target.value;window.renderAnalytics();});
    document.querySelectorAll('.an-period').forEach(b=>b.addEventListener('click',()=>{
      STATE.days=Number(b.dataset.days);window.renderAnalytics();
    }));
    document.querySelectorAll('.an-topic-practice').forEach(b=>b.addEventListener('click',()=>{
      if(typeof window.quickPracticeFor==='function')window.quickPracticeFor(b.dataset.topic,b.dataset.mode||'due');
      else practise(b.dataset.topic);
    }));
    document.querySelectorAll('.an-topic-build').forEach(b=>b.addEventListener('click',()=>{
      practise(b.dataset.topic);
    }));
    $id('an-refresh').addEventListener('click',refreshAnalytics);
    $id('an-download').addEventListener('click',()=>{
      const blob=new Blob([WTAnalytics.report(snapshot())],{type:'text/plain;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;
      a.download='LearningHub_report_'+new Date().toISOString().slice(0,10)+'.txt';
      a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
    });
  };
  async function refreshAnalytics(){
    if(STATE.busy||DEMO||!SESSION)return;
    const currentOwner=SESSION.user.id,rows=[];
    STATE.busy=true;STATE.error=null;
    if(active())window.renderAnalytics();
    try{
      const pageSize=500,limit=10000;
      for(let offset=0;offset<limit;offset+=pageSize){
        const {data,error}=await sb.from('written_test_attempts')
          .select('*').order('graded_at',{ascending:false}).range(offset,offset+pageSize-1);
        if(error)throw error;
        const page=data||[];
        rows.push(...page);
        if(page.length<pageSize)break;
      }
      if(rows.length===limit){
        const {data,error}=await sb.from('written_test_attempts').select('id')
          .order('graded_at',{ascending:false}).range(limit,limit);
        if(error)throw error;
        if(data&&data.length)throw new Error('More than 10,000 attempts; cannot claim complete history. Existing results preserved.');
      }
      if(!SESSION||SESSION.user.id!==currentOwner)throw new Error('Account changed during refresh');
      ATTEMPTS=rows;STATE.complete=true;STATE.refreshedAt=Date.now();
    }catch(err){STATE.error='Refresh incomplete. Previously loaded results were kept. '+(err.message||err);}
    finally{STATE.busy=false;if(active())window.renderAnalytics();}
  }
  window.refreshAnalytics=refreshAnalytics;
})();
