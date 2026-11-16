import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const elements=new Map();
const get=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',disabled:false,hidden:true,dataset:{},currentTime:0,src:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},showModal(){this.open=true},close(){this.open=false}});return elements.get(key)};
const ctx=vm.createContext({document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},navigator:{},localStorage:{getItem:()=>null,setItem(){}},location:{hash:''},history:{replaceState(){}},setTimeout,clearTimeout,URL,Blob,console});
vm.runInContext(readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
const rows=JSON.parse(run('JSON.stringify(rows)'));
const manifest=JSON.parse(readFileSync(new URL('../dist/audio/manifest.json',import.meta.url)));
assert.equal(manifest.language,'ml-IN');
assert.equal(manifest.clips.length,37);
for(const clip of manifest.clips){
 const text=clip.key==='mazha'?'മഴ':rows[Number(clip.key.slice(7))][3];
 assert.equal(clip.text_sha256,createHash('sha256').update(text).digest('hex'),'Text matches '+clip.key);
 for(const speed of ['normal','slow']){
  const url=new URL('../dist/audio/'+clip[speed].file,import.meta.url),data=readFileSync(url);
  assert.equal(data.length,clip[speed].bytes);
  assert.equal(createHash('sha256').update(data).digest('hex'),clip[speed].sha256);
  assert.ok(statSync(url).size>1500);
  run(`speak(${clip.key==='mazha'?"'mazha'":Number(clip.key.slice(7))},${speed==='slow'})`);
  const player=get('#pronunciation-audio');
  assert.equal(player.src,'audio/'+clip[speed].file);
  assert.equal(player.playbackRate,1,'Slower clip preserves original pitch');
 }
 assert.ok(clip.slow.seconds>clip.normal.seconds*1.15,'Slow clip is slower: '+clip.key);
}
const player=get('#pronunciation-audio');
run('speak(0)');player.onplaying();assert.equal(get('#audio-stop').disabled,false);assert.equal(get('#playback-bar').hidden,false);
run('stopPronunciation()');assert.equal(player.paused,true);assert.equal(get('#playback-bar').hidden,true);
run('speak(1)');player.onended();assert.equal(run('pronunciationState'),null);
run('speak(2)');player.onerror();assert.match(get('#audio-note').textContent,/Couldn’t load/);
run('clearTimeout(toastTimer)');
run('speak(3)');const previous=player.onended;run('speak(4)');previous();assert.equal(run('pronunciationState.id'),4,'Stale completion cannot stop a new clip');
const swSelf={registration:{scope:'https://parayu.test/'},addEventListener(){},skipWaiting(){},clients:{claim(){}}};
const swContext=vm.createContext({self:swSelf,URL,importScripts(){}});
vm.runInContext(readFileSync(new URL('../dist/content-audio-index.js',import.meta.url),'utf8'),swContext);
const assets=vm.runInContext(readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8')+';AUDIO_FILES',swContext);
assert.equal(assets.length,290);
for(const clip of manifest.clips)for(const speed of ['normal','slow'])assert.ok(assets.includes('./audio/'+clip[speed].file),'Clip cached offline');
console.log('Passed: all 74 audio files, text hashes, slower speeds, playback paths, stop/end/error and stale-event handling.');
