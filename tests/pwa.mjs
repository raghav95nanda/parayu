import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.webmanifest',root),'utf8'));
assert.equal(manifest.display,'standalone');
for(const name of ['id','scope','start_url'])assert.equal(manifest[name],'./');
for(const size of [192,512]){
 const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`&&i.purpose==='any');assert.ok(icon);
 const bytes=readFileSync(new URL(icon.src,root));assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
}
assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
const source=readFileSync(new URL('sw.js',root),'utf8');assert.ok(!source.includes('__PARAYU_BUILD__'));
const index=JSON.parse(readFileSync(new URL('offline-audio-index.json',root),'utf8'));
assert.equal(index.count,2290);assert.equal(new Set(index.files).size,2290);
assert.ok(index.files.every(p=>existsSync(new URL(p,root))));
for(const pathname of ['/','/parayu/','/malayalam-practice/']){
 const scope='https://example.github.io'+pathname,handlers={},stores=new Map();let offline=false,reads=0;
 const keyOf=r=>new URL(typeof r==='string'?r:r.url,scope).href;
 const cache=name=>{
  if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
  return {async addAll(paths){for(const p of paths)await this.put(p,await fetchFile(new Request(keyOf(p))))},async put(key,response){store.set(keyOf(key),response.clone())},async match(key){return store.get(keyOf(key))?.clone()},async keys(){return [...store.keys()].map(p=>new Request(p))}};
 };
 async function fetchFile(request){if(offline)throw Error('Offline');reads++;const path=new URL(request.url).pathname.slice(pathname.length)||'index.html';assert.ok(!path.startsWith('/'));return new Response(readFileSync(new URL(path,root)),{status:200,headers:{'Content-Type':path.endsWith('.mp3')?'audio/mpeg':'text/plain'}})}
 const caches={async open(name){return cache(name)},async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)}};
 const self={registration:{scope},location:{origin:'https://example.github.io'},addEventListener(type,fn){handlers[type]=fn},skipWaiting(){},clients:{async claim(){}}};
 const ctx=vm.createContext({self,URL,Request,Response,Headers,caches,fetch:fetchFile,importScripts(){}});
 vm.runInContext(readFileSync(new URL('content-audio-index.js',root),'utf8'),ctx);vm.runInContext(source,ctx);
 let promise;handlers.install({waitUntil(p){promise=p}});await promise;
 const cacheName=vm.runInContext('CACHE',ctx);assert.ok(stores.get(cacheName).size>=22);
 stores.set('parayu-other-project-shell-old',new Map());stores.set(vm.runInContext('PREFIX',ctx)+'shell-old',new Map());
 handlers.activate({waitUntil(p){promise=p}});await promise;
 assert.ok(stores.has('parayu-other-project-shell-old'),'Keep unrelated installed apps');assert.ok(!stores.has(vm.runInContext('PREFIX',ctx)+'shell-old'));
 offline=true;
 let result;handlers.fetch({request:{url:scope+'index.html?source=pwa',method:'GET',mode:'navigate'},respondWith(p){result=p}});
 assert.match(await (await result).text(),/<title>Parayu/,'Offline navigation works at project paths');
 result=undefined;handlers.fetch({request:new Request(scope+'breakdown-data.js'),respondWith(p){result=p}});assert.match(await (await result).text(),/PARAYU_BREAKDOWNS/);
 offline=false;const audio=scope+'audio/phrase-02.mp3';ctx.request=new Request(audio);await vm.runInContext('audioResponse(request)',ctx);
 const priorReads=reads;offline=true;ctx.request=new Request(audio,{headers:{Range:'bytes=0-19'}});const replay=await vm.runInContext('audioResponse(request)',ctx);assert.equal(replay.status,206);assert.equal((await replay.arrayBuffer()).byteLength,20);assert.equal(reads,priorReads);
 result=undefined;handlers.fetch({request:new Request('https://unrelated.test/a.mp3'),respondWith(p){result=p}});assert.equal(result,undefined);
}
const pwa=readFileSync(new URL('pwa.js',root),'utf8');assert.match(pwa,/beforeinstallprompt/);assert.match(pwa,/Add to Home Screen/);assert.match(pwa,/allSettled/);assert.match(pwa,/offlineStop/);
console.log('Passed: install manifest and icons, all 2290 bundled audio paths, scoped shell caches, offline navigation/text/audio ranges at root and two GitHub project paths, update and download controls.');
