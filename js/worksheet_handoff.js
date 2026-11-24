/* Learning Hub · Phase 1 worksheet handoff contracts.
 * No credentials here. Keys are PRIVATE because of their answers, not because
 * the stable per-problem grade IDs are secrets. */
(function(global){
  'use strict';
  const enc = new TextEncoder();
  const hex = n => n.toString(16).padStart(2,'0');
  async function attemptId(batchId,problemId){
    if(!batchId||!problemId) throw new Error('Cannot grade a batch without IDs');
    if(!global.crypto||!global.crypto.subtle) throw new Error('Secure browser context required for batch IDs');
    const raw=new Uint8Array(await global.crypto.subtle.digest('SHA-256',enc.encode(
      'LearningHub:grade:v1:'+String(batchId)+':'+String(problemId))));
    const b=raw.slice(0,16);
    // Deterministic version-8 UUID (SHA-256 name-based), RFC 9562 variant.
    b[6]=(b[6]&0x0f)|0x80;
    b[8]=(b[8]&0x3f)|0x80;
    const s=Array.from(b,hex).join('');
    return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20);
  }
  function studentQuestion(q){
    const p=q.p;
    return {id:p.id,topic_id:p.topic_id,number:p.number,subtitle:p.subtitle,
      prompt:p.prompt,given_data:p.given_data||null,tier:p.tier,kind:p.kind,picked_because:q.why};
  }
  async function manifests({batchId,userId,filename,createdAt,questions}){
    if(!Array.isArray(questions)||!questions.length) throw new Error('No questions selected');
    if(!userId||!filename||!batchId) throw new Error('Missing worksheet metadata');
    const head={batch_id:batchId,user_id:userId,created_at:createdAt,filename,manifest_version:2};
    const publicQuestions=questions.map(studentQuestion);
    const graderQuestions=await Promise.all(questions.map(async(q,i)=>({
      ...publicQuestions[i],
      attempt_id:await attemptId(batchId,q.p.id),
      answer:q.p.answer||null,worked:q.p.worked||null
    })));
    return {student:JSON.stringify({...head,problems:publicQuestions},null,2),
      grader:JSON.stringify({...head,problems:graderQuestions},null,2)};
  }
  async function coverage(batch,attempts){
    const problems=Array.from(new Set(batch.problem_ids||[]));
    const expected=await Promise.all(problems.map(id=>attemptId(batch.id,id)));
    const found=new Set((attempts||[]).filter(a=>a&&a.graded_by==='cowork').map(a=>a.id));
    return {done:expected.filter(id=>found.has(id)).length,total:expected.length,ids:expected};
  }
  global.WTWorksheet={attemptId,manifests,coverage};
})(window);
