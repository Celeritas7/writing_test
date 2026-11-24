'use strict';
/* Run: node --test tests/phase1-workflow.test.cjs
 * Hermetic: no live Supabase writes, iCloud calls, or production network. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;
const root=path.join(__dirname,'..');
const helper=fs.readFileSync(path.join(root,'js/worksheet_handoff.js'),'utf8');
const hub=fs.readFileSync(path.join(root,'js/learning_hub.js'),'utf8');
const app={crypto};
vm.runInNewContext(helper,{window:app,TextEncoder});
const contract=app.WTWorksheet;
function question(id,extra={}){
  return {p:{id,topic_id:'math',number:1,subtitle:'Practice',prompt:'What is 2 + 2?',
    answer:'4',worked:'add numbers',tier:'core',kind:'drill',given_data:null,...extra},why:'new'};
}
test('student manifest excludes answers; grader has stable UUIDs',async()=>{
  const args={batchId:'570e7dde-3e26-4c4a-9e90-974d64e0ab02',
    userId:'verified-user',filename:'WT2_math.pdf',createdAt:'2026-11-24T00:00:00Z',
    questions:[question('p1'),question('p2')]};
  const one=await contract.manifests(args),two=await contract.manifests(args);
  const student=JSON.parse(one.student),grader=JSON.parse(one.grader);
  assert.equal(student.manifest_version,2);
  assert.equal(student.problems[0].answer,undefined);
  assert.equal(student.problems[0].worked,undefined);
  assert.equal(student.problems[0].attempt_id,undefined);
  assert.equal(grader.problems[0].answer,'4');
  assert.match(grader.problems[0].attempt_id,/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(grader.problems[0].attempt_id,grader.problems[1].attempt_id);
  assert.equal(grader.problems[0].attempt_id,JSON.parse(two.grader).problems[0].attempt_id);
});
test('batch coverage counts only verified Cowork rows',async()=>{
  const batch={id:'570e7dde-3e26-4c4a-9e90-974d64e0ab02',problem_ids:['p1','p2']};
  const a=await contract.attemptId(batch.id,'p1');
  const b=await contract.attemptId(batch.id,'p2');
  assert.equal((await contract.coverage(batch,[{id:a,graded_by:'cowork'},{id:b,graded_by:'ghost'}])).done,1);
  const full=await contract.coverage(batch,[{id:a,graded_by:'cowork'},{id:b,graded_by:'cowork'}]);
  assert.equal(full.done,full.total);
});
function section(start,end){
  const a=hub.indexOf(start),b=hub.indexOf(end,a);
  assert.ok(a>=0&&b>a,'missing function '+start);
  return hub.slice(a,b);
}
class PdfStub{
  constructor(options){this.options=options;this.pages=[{boxes:[],text:[]}];
    const dims=options.format==='a4'?[595.28,841.89]:[612,792];
    this.internal={pageSize:{getWidth:()=>dims[0],getHeight:()=>dims[1]}};
  }
  get page(){return this.pages.at(-1);}
  addPage(){this.pages.push({boxes:[],text:[]});}
  setFont(){} setFontSize(){} setTextColor(){} setDrawColor(){} setLineWidth(){}
  setFillColor(){}setProperties(){}
  getTextWidth(s){return String(s).length*5;}
  splitTextToSize(t,width){const n=Math.max(8,Math.floor(width/5));const value=String(t);
    return value.match(new RegExp('.{1,'+n+'}','g'))||[];}
  text(s,x,y){assert.ok(y>=0&&y<=this.internal.pageSize.getHeight(),'text y out of page');
    this.page.text.push({s,x,y});}
  line(x,y,x2,y2){const height=this.internal.pageSize.getHeight();
    assert.ok(y>=0&&y2<=height,'line outside page');}
  roundedRect(x,y,w,h){assert.ok(y+h<=this.internal.pageSize.getHeight()-140,
    'given box overran the writing/answer area');
    this.page.boxes.push({x,y,w,h});}
  output(){return this;}
}
async function renderPdf(format,extra){
  let doc;
  const fn=new Function('window','buildSel','TOPICS','TIER_LABEL','pdfFont','toast',
    section('async function makePdf(', '/* ---------- cowork task')+
    '\nreturn makePdf;')({jspdf:{jsPDF:class extends PdfStub{constructor(opts){super(opts);doc=this;}}}},
      {paper:format},[{id:'math',name:'Calculus'}],{core:'core'},
      async()=>{throw new Error('font test not needed');},()=>{});
  const out=await fn([question('p1',extra)],'test.pdf','batch-uuid');
  assert.equal(out,doc);
  return doc;
}
test('long prompt and very long GIVEN data paginate for A4 and Letter',async()=>{
  for(const paper of ['a4','letter']){
    const pdf=await renderPdf(paper,{prompt:'Long calculation '.repeat(400),
      given_data:'List many data points '.repeat(500)});
    assert.ok(pdf.pages.length>=3,'should create continuation pages');
    assert.ok(pdf.pages.some(p=>p.boxes.length>0),'given data should render');
    for(const page of pdf.pages)assert.ok(page.text.some(t=>String(t.s).includes('batch:')),
      'each continuation page should identify the batch');
  }
});
test('gradering requires verification before status change',()=>{
  assert.match(hub,/phase1Batch\(b\)/);
  assert.match(hub,/coverage\.done!==coverage\.total/);
  assert.match(hub,/Check feedback/);
  assert.match(hub,/Refresh feedback from Supabase/);
});
test('folder exporter writes private key and safe manifest before publishing PDF',()=>{
  const spot=section('if(DIR){\n    try{','  if(!written){');
  assert.ok(spot.indexOf('writeText(gr, jname, key)')<spot.indexOf('getFileHandle(fname,{create:true})'));
  assert.ok(spot.indexOf('writeText(out, jname, manifest)')<spot.indexOf('getFileHandle(fname,{create:true})'));
});
test('updated JavaScript parses',()=>{
  assert.doesNotThrow(()=>new Function(hub));
  assert.doesNotThrow(()=>new Function(helper));
});
