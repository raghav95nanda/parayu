import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const nodes=new Map();
const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',dataset:{},disabled:false,open:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(key)};
const ctx=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},speechSynthesis:{getVoices:()=>[],addEventListener(){}}},localStorage:{getItem:()=>null,setItem(){}},navigator:{},location:{hash:''},history:{replaceState(){}},setTimeout,clearTimeout,URL,Blob,console});
for(const name of ['content-data.js','breakdown-data.js','breakdowns.js','vocabulary.js','app.js'])vm.runInContext(readFileSync(new URL('../dist/'+name,import.meta.url),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
run('render=()=>{}; openDialog=html=>{testHTML=html}; let testHTML="";');

// All 18 lessons must practise both phrases, finish exactly once and retain review dates.
for(let u=0;u<6;u++)for(let l=0;l<3;l++){
 run(`startLesson(${u},${l})`);
 for(let step=0;step<7;step++){
  assert.equal(run('session.step'),step);
  assert.equal(run('lessonPhraseId()'),u*6+l*2+(step>=3?1:0));
  if(step===1||step===4)run('answer(lessonPhraseId(),{classList:{add(){}}})');
  if(step===5){
   run('session.wordOrder=phrases[lessonPhraseId()].latin.split(" ").map(w=>session.wordBank.indexOf(w)); checkWords()');
   assert.equal(run('session.answered'),true);
  }
  run('lessonNext()');
 }
 assert.equal(run(`state.completed.includes('${u}-${l}')`),true);
}
assert.equal(run('state.completed.length'),18);
assert.equal(run('state.xp'),360);
assert.equal(run('Object.keys(state.reviews).length'),36);
assert.equal(run('learnedIds().length'),36);
assert.equal(run('duePhrases().length'),0);

// A retry of a learned lesson earns practice XP without duplicating completion.
run('startLesson(1,0); session.step=6; lessonNext()');
assert.equal(run('state.completed.length'),18);
assert.equal(run('state.xp'),365);

// Wrong word order can be corrected; removing a selected token permits re-selection.
run('startLesson(1,0); session.step=5; lessonStep(); session.wordBank=["Vellam","venam"]; session.wordOrder=[1,0]; checkWords()');
assert.equal(run('session.answered'),false);
assert.equal(run('session.wordOrder.length'),0);
run('addWord(0); addWord(0)');
assert.equal(run('session.wordOrder.length'),1);
run('addWord(1);checkWords()');
assert.equal(run('session.answered'),true);

// Recall reschedules remembered and still-learning phrases to distinct intervals.
run('state.reviews[0]=0;state.reviews[1]=0;startReview();rateReview(false);rateReview(true)');
assert.equal(run('duePhrases().length'),0);
assert.ok(run('state.reviews[0]-Date.now()')>9*60000);
assert.ok(run('state.reviews[1]-Date.now()')>2*86400000);
console.log('Passed: all 18 lessons, both speaking phrases, word-order recovery, practice XP and review scheduling.');
