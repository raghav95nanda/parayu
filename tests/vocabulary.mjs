import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const nodes=new Map();
const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',dataset:{},currentTime:0,hidden:true,classList:{add(){},remove(){},toggle(){}},addEventListener(){},pause(){},play(){return Promise.resolve()},showModal(){this.open=true},close(){this.open=false}});return nodes.get(key)};
const ctx=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem:()=>null,setItem(){}},navigator:{},location:{hash:''},history:{replaceState(){}},setTimeout,clearTimeout,URL,Blob,console});
const run=code=>vm.runInContext(code,ctx);
for(const name of ['content-data.js','breakdown-data.js','breakdowns.js','vocabulary.js','app.js'])run(readFileSync(new URL('../dist/'+name,import.meta.url),'utf8'));
const data=JSON.parse(run('JSON.stringify(window.PARAYU_CONTENT)'));
assert.equal(data.vocabulary.length,1000);
assert.equal(new Set(data.vocabulary.map(w=>w.native)).size,1000);
assert.equal(new Set(data.vocabulary.map(w=>w.id)).size,1000);
assert.equal(new Set(data.vocabulary.map(w=>w.category)).size,18);
for(const [native,latin] of [['ഇപ്പോൾ','ippol'],['കാപ്പി','kaappi'],['പുതിയ','puthiya'],['ഇവിടെ','ivide'],['പഠിക്കുക','padikkuka'],['വെള്ളം','vellam']])assert.equal(data.vocabulary.find(w=>w.native===native)?.latin,latin);
assert.equal(run('phrases.length'),144);
const allPhrases=JSON.parse(run('JSON.stringify(phrases)'));
assert.equal(new Set(allPhrases.map(p=>p.native.replace(/[\s.,!?]/g,''))).size,144);
run("view='vocabulary';render()");
assert.match(node('#word-results-count').textContent,/1–36 of 1,000/);
assert.equal(run('vocabularyMatches().length'),1000);
run("wordQuery='VELLAM'");
assert.ok(run("vocabularyMatches().some(w=>w.native==='വെള്ളം')"));
run("wordQuery='water';wordCategory='food'");
assert.ok(run('vocabularyMatches().length')>0);
run("wordQuery='';wordCategory='all';wordFilter='saved'");
assert.equal(run('vocabularyMatches().length'),0);
const first=data.vocabulary[0],last=data.vocabulary.at(-1);
run(`saveWord('${first.id}');clearTimeout(toastTimer)`);
assert.equal(run('vocabularyMatches().length'),1);
run(`saveWord('${last.id}');clearTimeout(toastTimer)`);
assert.equal(run('savedWords().length'),2);
const oldXP=run('state.xp');
for(const word of data.vocabulary){
 for(const field of ['latin','meaning','sentence','sentenceNative','translation'])assert.ok(typeof word[field]==='string'&&word[field].trim().length>0,word.id+' '+field);
 assert.ok(!/[\u0d00-\u0d7f]/.test(word.latin+word.sentence));
 run(`openWord('${word.id}')`);
 const html=node('#dialog').innerHTML;
 assert.ok(html.includes(word.translation.replaceAll('&','&amp;').replaceAll('“','“'))||html.includes('USE IT IN A SENTENCE'));
 assert.ok(!/[\u0d00-\u0d7f]/.test(html),'Learning UI stays in Latin script');
 for(const kind of ['word','example']){
  run(`speak('${kind}:${word.id}')`);
  const expected='audio/vocabulary/'+word.id+'-'+kind+'.mp3';
  assert.equal(node('#pronunciation-audio').src,expected);
  assert.ok(existsSync(new URL('../dist/'+expected,import.meta.url)),expected);
 }
}
run(`speak('word:${first.id}',true)`);
assert.equal(node('#pronunciation-audio').playbackRate,.78);
assert.equal(node('#pronunciation-audio').preservesPitch,true);
assert.equal(run('state.xp'),oldXP);

const manifest=JSON.parse(readFileSync(new URL('../dist/audio/content-manifest.json',import.meta.url),'utf8'));
assert.equal(manifest.clips.length,2216);
const expected=new Map();
for(const word of data.vocabulary){expected.set('vocabulary/'+word.id+'-word.mp3',word.native);expected.set('vocabulary/'+word.id+'-example.mp3',word.sentenceNative)}
for(let i=36;i<144;i++){expected.set('phrase-'+String(i).padStart(2,'0')+'.mp3',allPhrases[i].native);expected.set('phrase-'+String(i).padStart(2,'0')+'-slow.mp3',allPhrases[i].native)}
for(const clip of manifest.clips){
 assert.ok(expected.has(clip.file),clip.file);
 const bytes=readFileSync(new URL('../dist/audio/'+clip.file,import.meta.url));
 assert.equal(bytes.length,clip.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),clip.sha256);
 assert.equal(createHash('sha256').update(expected.get(clip.file)).digest('hex'),clip.text_sha256);
 assert.ok(clip.seconds>.15&&clip.seconds<35);
}
const backup=JSON.parse(run('JSON.stringify(state)'));
ctx.backupText=JSON.stringify({app:'parayu',version:1,state:backup});
run('importProgress({size:backupText.length,text:()=>Promise.resolve(backupText)})');
await new Promise(resolve=>setImmediate(resolve));
assert.equal(typeof node('#confirm-import').onclick,'function');
node('#confirm-import').onclick();
assert.equal(run('savedWords().length'),2);run('clearTimeout(toastTimer)');
delete backup.savedWords;ctx.backupText=JSON.stringify({app:'parayu',version:1,state:backup});
run('importProgress({size:backupText.length,text:()=>Promise.resolve(backupText)})');
await new Promise(resolve=>setImmediate(resolve));node('#confirm-import').onclick();
assert.equal(run('savedWords().length'),0);run('clearTimeout(toastTimer)');
console.log('Passed: 1000 unique entries, 18 topics, 144 unique phrases, search/filter/save, all word dialogs, all 2216 new clips, and vocabulary audio routing.');
