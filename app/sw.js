'use strict';
importScripts('./content-audio-index.js');
const PREFIX='parayu-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+'shell-__PARAYU_BUILD__';
const AUDIO_CACHE=PREFIX+'audio-v1';
const AUDIO_KEYS=[...Array.from({length:self.PARAYU_AUDIO_INDEX.phraseCount},(_,i)=>'phrase-'+String(i).padStart(2,'0')),'mazha'];
const AUDIO_FILES=AUDIO_KEYS.flatMap(key=>['./audio/'+key+'.mp3','./audio/'+key+'-slow.mp3']);
const ASSETS=['./','./index.html','./style.css','./rebuild.css','./vocabulary.css','./breakdowns.css','./pwa.css','./account.css','./account.js','./parayu-config.js','./vendor/supabase.js','./breakdown-data.js','./breakdowns.js','./content-data.js','./content-audio-index.js','./vocabulary.js','./app.js','./pwa.js','./icon.svg','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./manifest.webmanifest','./offline-audio-index.json','./vocabulary-data.json'];
const ALLOWED=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
const VOCABULARY_AUDIO=new Set(self.PARAYU_AUDIO_INDEX.vocabularyIds.flatMap(id=>['word','example'].map(kind=>new URL('./audio/vocabulary/'+id+'-'+kind+'.mp3',self.registration.scope).href)));
const ALL_AUDIO=new Set([...AUDIO_FILES.map(p=>new URL(p,self.registration.scope).href),...VOCABULARY_AUDIO]);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(PREFIX+'shell-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()})())});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
async function audioResponse(request){
 const cache=await caches.open(AUDIO_CACHE);let response=await cache.match(request.url);
 if(!response){const headers=new Headers(request.headers);headers.delete('range');response=await fetch(new Request(request,{headers}));if(response.ok&&!response.redirected&&response.status===200)await cache.put(request.url,response.clone())}
 const range=request.headers.get('range');if(!range||!response.ok)return response;
 const bytes=await response.arrayBuffer(),match=/^bytes=(\d*)-(\d*)$/.exec(range);
 if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength}});
 const start=match[1]?Number(match[1]):Math.max(0,bytes.byteLength-Number(match[2]));const end=match[1]?(match[2]?Math.min(Number(match[2]),bytes.byteLength-1):bytes.byteLength-1):bytes.byteLength-1;
 if(start>=bytes.byteLength||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+bytes.byteLength}});
 const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${bytes.byteLength}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
 return new Response(bytes.slice(start,end+1),{status:206,headers});
}
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 if(ALL_AUDIO.has(url.href)){event.respondWith(audioResponse(request));return}
 if(request.mode==='navigate'&&url.pathname.startsWith(new URL(self.registration.scope).pathname)){
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('./index.html'))||fetch(request)));return;
 }
 if(ALLOWED.has(url.href))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request))||fetch(request)));
});
