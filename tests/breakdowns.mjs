import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const nodes=new Map();
const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',dataset:{},currentTime:0,hidden:true,classList:{add(){},remove(){},toggle(){}},addEventListener(){},pause(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(key)};
const ctx=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem:()=>JSON.stringify({xp:75,completed:['0-0'],saved:[2],savedWords:['vd77d453418'],days:{},reviews:{},goal:30}),setItem(){}},navigator:{},location:{hash:''},history:{replaceState(){}},setTimeout,clearTimeout,URL,Blob,console});
const run=code=>vm.runInContext(code,ctx);
for(const file of ['content-data.js','breakdown-data.js','breakdowns.js','vocabulary.js','app.js'])run(readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'));
const data=JSON.parse(run('JSON.stringify(window.PARAYU_BREAKDOWNS)'));
const originalRows=JSON.parse(readFileSync(new URL('../content/lesson-phrases.json',import.meta.url),'utf8'));
assert.deepEqual(JSON.parse(run('JSON.stringify(rows)')),originalRows,'Authored lesson corpus matches app phrases');
assert.equal(Object.keys(data.words).length,1000);
assert.equal(Object.keys(data.phrases).length,144);
for(const [kind,entries] of Object.entries({words:data.words,phrases:data.phrases}))for(const [id,entry] of Object.entries(entries)){
 assert.ok(entry.parts.length,`${kind} ${id} has a breakdown`);
 assert.ok(entry.note.length>25,`${kind} ${id} explains the usage`);
 for(const p of [...entry.parts,...(entry.sentenceParts||[])]){
  assert.ok(p.text.trim()&&p.meaning.trim());
  assert.doesNotMatch(p.text+p.meaning,/[\u0d00-\u0d7f]/,'Learning explanations use Latin script');
 }
 if(kind==='words'){
  assert.ok(entry.sentenceParts.length>=2,`${id} example is broken down`);
  run(`openWord('${id}')`);
  const html=node('#dialog').innerHTML;
  assert.match(html,/Understand this word/);assert.match(html,/Break down the sentence/);
  assert.doesNotMatch(html,/undefined|\[object Object\]/);
 }else{
  run(`openPhrase(${id})`);assert.match(node('#dialog').innerHTML,/Break it down/);
  assert.match(run(`phraseCard(phrases[${id}])`),/Break it down/);
 }
}
// Prevent common pedagogical mistakes: copula vs question marker, irregular
// negatives, stem-vowel artifacts, and the two very different senses of vayar.
assert.deepEqual(data.phrases['2'].parts.map(x=>x.text),['sukham','aano?']);
assert.match(data.phrases['2'].note,/aanu.*-o/);
assert.match(data.phrases['2'].parts[0].meaning,/Sanskrit/);
assert.match(data.phrases['24'].parts.at(-1).meaning,/negative/);
assert.match(data.phrases['34'].parts[1].meaning,/stomach/);
assert.doesNotMatch(JSON.stringify(data.phrases['34']),/electrical/);
assert.match(data.phrases['61'].parts[0].meaning,/fare meter/);
const words=JSON.parse(run('JSON.stringify(vocabularyData())'));
const study=words.find(w=>w.native==='പഠിക്കുക');
assert.deepEqual(data.words[study.id].parts.map(x=>x.text),['padikk-','-uka']);
assert.ok(data.words[study.id].sentenceParts.some(x=>x.text==='-aan'));
const water=words.find(w=>w.native==='വെള്ളം');
assert.equal(data.words[water.id].parts.length,1,'Do not invent a meaning split in vellam');
// Lessons expose explanations before practice, without exposing a quiz answer.
for(let u=0;u<6;u++)for(let l=0;l<3;l++){
 run(`startLesson(${u},${l})`);assert.match(node('#dialog').innerHTML,/Break it down/);
 run('session.step=1;lessonStep()');assert.doesNotMatch(node('#dialog').innerHTML,/class="logic-panel/);
 run('answer(lessonPhraseId(),{classList:{add(){}}})');assert.match(node('#feedback').innerHTML,/Break it down/);
}
assert.equal(run('state.xp'),75);assert.equal(run('state.completed.length'),1);assert.equal(run('savedWords().length'),1);
const index=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
assert.ok(index.indexOf('breakdown-data.js')<index.indexOf('app.js'));
const sw=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
for(const f of ['breakdown-data.js','breakdowns.js','breakdowns.css'])assert.ok(sw.includes(`'./${f}'`),f+' cached offline');
console.log('Passed: complete breakdown coverage, Latin-script UI for all entries, morphology regressions, lesson reveal timing, progress compatibility, and offline assets.');
