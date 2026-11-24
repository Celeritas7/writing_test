/* Learning Hub · Phase 3 learning analytics.
 * Read-only presentation of existing Hub attempts; no new database tables.
 * Japanese-project sessions are deliberately excluded because their local
 * browser log is not a user-scoped cross-device source of truth. */
(function(global){
  'use strict';
  const DAY=86400000;
  const SOURCES={
    cowork:{label:'Cowork graded',detail:'Externally graded worksheets'},
    self:{label:'Quick Practice',detail:'Self-rated answers'},
    ghost:{label:'Ghost Test',detail:'Self-checked Hub writing'},
    other:{label:'Other / legacy',detail:'Grader unspecified or historical'}
  };
  function groupOf(a){
    const value=String(a.graded_by||'').toLowerCase();
    return value==='cowork'||value==='claude'?'cowork':
      value==='self'?'self':value==='ghost'?'ghost':'other';
  }
  const dayNumber=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY;
  const dayOf=value=>{
    const d=new Date(value);
    return Number.isFinite(d.getTime())?dayNumber(d):null;
  };
  const roundRate=(n,correct)=>n?Math.round(correct*100/n):null;
  const score=rows=>{
    const valid=rows.filter(a=>typeof a.correct==='boolean');
    const n=valid.length,correct=valid.filter(a=>a.correct===true).length;
    return {n,correct,notCorrect:n-correct,pct:roundRate(n,correct)};
  };
  const daysAgo=(date,days)=>{const d=new Date(date);d.setDate(d.getDate()-days);return d;};
  const labelDate=day=>{
    const d=new Date(day*DAY);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
  };
  function collect({attempts=[],problems=[],topics=[],subjects=[],days=30,now=new Date(),
    subject='all',statusOf=null}){
    if(![7,30,90].includes(Number(days)))days=30;
    const date=new Date(now),today=dayNumber(date),start=today-days+1;
    const ids=new Set(),bank=[];
    const topicById=new Map(topics.map(t=>[t.id,t]));
    const subjectById=new Map(subjects.map(s=>[s.id,s]));
    for(const p of problems){
      if(!p||!p.id||ids.has(p.id))continue;
      const t=topicById.get(p.topic_id),subjectId=t&&t.subject_id||'unknown';
      if(subject!=='all'&&subjectId!==subject)continue;
      ids.add(p.id);bank.push(p);
    }
    const byId=new Map(),history=[];
    for(const a of attempts){
      if(!a||!ids.has(a.problem_id))continue;
      if(a.id!=null){if(byId.has(a.id))continue;byId.set(a.id,true);}
      const when=dayOf(a.graded_at||a.attempted_at);
      if(when==null||when>today)continue; // invalid or future dates are not evidence
      history.push({...a,method:groupOf(a),day:when});
    }
    history.sort((a,b)=>new Date(b.graded_at||b.attempted_at)-new Date(a.graded_at||a.attempted_at));
    const recent=history.filter(a=>a.day>=start);
    const previous=history.filter(a=>a.day>=start-days&&a.day<start);
    const latest=new Map();
    for(const a of history)if(!latest.has(a.problem_id))latest.set(a.problem_id,a);
    const latestObj=Object.fromEntries(latest);
    const stateByProblem=new Map();
    const statuses={weak:0,due:0,new:0,ok:0};
    const byTopic=new Map();
    for(const p of bank){
      const t=topicById.get(p.topic_id);
      const entry=byTopic.get(p.topic_id)||{
        id:p.topic_id,name:t&&t.name||'Unsorted / removed topic',
        subjectId:t&&t.subject_id||'unknown',
        subjectName:subjectById.get(t&&t.subject_id)?.name||'Unknown subject',
        total:0,reviewed:0,weak:0,due:0,new:0,ok:0,attempts:0,correct:0,
        cowork:0,self:0,ghost:0,other:0,lastAt:null
      };
      entry.total++;
      const last=latest.get(p.id);
      if(last)entry.reviewed++;
      let state=last?'ok':'new';
      if(statusOf){
        const calculated=statusOf(p,latestObj);
        state=calculated&&calculated.code||state;
      }else if(last){
        if(last.correct===false||last.rating!=null&&last.rating<=2)state='weak';
        else {
          const gap={1:1,2:1,3:3,4:7,5:14}[Math.round(last.rating||3)]||3;
          state=last.day+gap<=today?'due':'ok';
        }
      }
      if(!(state in statuses))state='ok';
      statuses[state]++;entry[state]++;stateByProblem.set(p.id,state);
      byTopic.set(p.topic_id,entry);
    }
    const byProblem=new Map();
    for(const a of recent){
      const t=byTopic.get(a.topic_id)||(bank.find(p=>p.id===a.problem_id)&&byTopic.get(
        bank.find(p=>p.id===a.problem_id).topic_id));
      if(t){
        t.attempts++;t[a.method]++;
        if(a.correct===true)t.correct++;
        if(!t.lastAt||new Date(a.graded_at||a.attempted_at)>new Date(t.lastAt))
          t.lastAt=a.graded_at||a.attempted_at;
      }
    }
    const last90=history.filter(a=>a.day>=today-89);
    for(const a of last90){
      const e=byProblem.get(a.problem_id)||{misses:0,attempts:0,last:null,latestFeedback:null};
      e.attempts++;
      if(a.correct===false)e.misses++;
      if(!e.last)e.last=a;
      if(!e.latestFeedback&&a.method==='cowork'&&String(a.notes||'').trim())e.latestFeedback=a.notes;
      byProblem.set(a.problem_id,e);
    }
    const focus=bank.map(p=>{
      const t=byTopic.get(p.topic_id),e=byProblem.get(p.id);
      const last=latest.get(p.id);
      const state=stateByProblem.get(p.id)||'new';
      return {id:p.id,topicId:p.topic_id,topicName:t.name,
        subtitle:p.subtitle||p.prompt||p.id,state,misses:e?.misses||0,
        attempts:e?.attempts||0,notes:e?.latestFeedback||'',lastAt:last?.graded_at||null,
        priority:(state==='weak'?100:state==='due'?30:0)+Math.min(50,(e?.misses||0)*15)};
    }).filter(p=>p.state==='weak'||p.state==='due')
      .sort((a,b)=>b.priority-a.priority||(b.misses-a.misses)||
        String(a.subtitle).localeCompare(String(b.subtitle))).slice(0,8);
    const methods={};
    for(const method of Object.keys(SOURCES)){
      const filter=xs=>xs.filter(a=>a.method===method);
      methods[method]={...score(filter(recent)),previous:score(filter(previous))};
    }
    const bucketSize=days===7?1:days===30?5:7,series=[];
    for(let first=start;first<=today;first+=bucketSize){
      const last=Math.min(today,first+bucketSize-1);
      const inBucket=recent.filter(a=>a.day>=first&&a.day<=last);
      const counts={cowork:0,self:0,ghost:0,other:0};
      inBucket.forEach(a=>counts[a.method]++);
      series.push({from:first,to:last,label:labelDate(first)+(last!==first?'–'+labelDate(last):''),
        count:inBucket.length,...counts});
    }
    const topicList=[...byTopic.values()].sort((a,b)=>b.weak-a.weak||b.due-a.due||
      b.attempts-a.attempts||a.name.localeCompare(b.name));
    const repeated=[...byProblem.entries()].filter(([,e])=>e.misses>=2).length;
    return {
      days,period:{start:labelDate(start),end:labelDate(today)},
      subject,subjectName:subject==='all'?'All subjects':(subjectById.get(subject)?.name||subject),
      bankCount:bank.length,reviewedCount:bank.filter(p=>latest.has(p.id)).length,
      attempts:recent.length,distinctRecent:new Set(recent.map(a=>a.problem_id)).size,
      statuses,methods,series,topics:topicList,focus,repeated,
      unknownSources:methods.other.n,generatedAt:date.toISOString()
    };
  }
  function report(a){
    const pct=s=>s.pct==null?'—':s.pct+'%';
    const lines=[
      'LEARNING HUB — STUDY REPORT','',
      'Period: '+a.period.start+' – '+a.period.end+' ('+a.days+' calendar days)',
      'Selected subject: '+(a.subjectName||a.subject),
      'Library questions: '+a.bankCount,
      'Questions ever attempted: '+a.reviewedCount,
      'Attempts in period: '+a.attempts+' ('+a.distinctRecent+' unique questions)',
      'Current weak: '+a.statuses.weak+' · Due: '+a.statuses.due+' · New: '+a.statuses.new,
      'Repeated misses in last 90 days: '+a.repeated,'',
      'CORRECT MARKS BY SOURCE (not combined across grading methods)'
    ];
    for(const [id,desc] of Object.entries(SOURCES)){
      const s=a.methods[id];lines.push(desc.label+': '+s.correct+'/'+s.n+' ('+pct(s)+
        '); previous matching period '+s.previous.correct+'/'+s.previous.n+' ('+pct(s.previous)+')');
    }
    lines.push('','ACTIVITY');
    for(const x of a.series)lines.push(x.label+': '+x.count+' attempts');
    lines.push('','TOPICS');
    for(const t of a.topics)lines.push(t.subjectName+' / '+t.name+': '+t.reviewed+'/'+t.total+
      ' ever attempted, '+t.attempts+' attempts in period, '+t.weak+' weak, '+t.due+' due');
    lines.push('','NEXT PRACTICE');
    for(const x of a.focus)lines.push(x.topicName+' / '+x.subtitle+' — '+x.state+
      ' · '+x.misses+' misses in last 90 days');
    lines.push('','Note: Cowork grades, self-ratings and Ghost Test marks have different evidence levels.',
      'Japanese Study project data and device-only Japanese sessions are not included.',
      'This report excludes reference answers and private grader files.');
    return lines.join('\n')+'\n';
  }
  global.WTAnalytics={collect,report,SOURCES};
})(window);
