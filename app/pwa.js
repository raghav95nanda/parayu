'use strict';
let installPrompt=null,pwaRegistration=null,pwaFailure='',offlineIndex=null,offlineDone=0,offlineTotal=2290,offlineBusy=false,offlineStop=false,offlineError='',refreshingForUpdate=false,updateRequested=false;
function pwaScope(){return new URL('./',location.href)}
function pwaAudioCache(){return 'parayu-'+encodeURIComponent(pwaScope().pathname)+'-audio-v1'}
function pwaInstalled(){return window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true}
function pwaSettings(){return `<section class="pwa-settings" aria-label="Install and offline options"><div class="eyebrow">TAKE PARAYU WITH YOU</div><h2>Ready for your Kerala trip.</h2><p>Install Parayu on your home screen. Download the voice pack to hear every word and sentence without a connection.</p><div class="pwa-actions"><button class="btn" data-pwa="install">${pwaInstalled()?'Installation help':'Install Parayu'}</button><button class="btn light" data-pwa="download" ${offlineBusy?'disabled':''}>${offlineBusy?'Downloading…':'Download all audio · 27 MB'}</button><button class="textbtn" data-pwa="stop" ${offlineBusy?'':'hidden'}>Pause download</button><button class="btn light" data-pwa="update" ${pwaRegistration?.waiting?'':'hidden'}>Update available</button></div><progress class="offline-progress" max="${offlineTotal}" value="${offlineDone}" ${offlineBusy||offlineDone?'':'hidden'} aria-label="Offline audio download progress"></progress><p class="pwa-status" role="status">${pwaStatus()}</p><p class="pwa-small">Lessons, the word bank, and breakdowns are saved after your first online visit. Audio is saved as you play it, or download the whole pack here. A paused download resumes from saved clips.</p></section>`}
function pwaStatus(){if(pwaFailure)return pwaFailure;if(offlineError)return offlineError;if(offlineBusy)return `Saving audio: ${offlineDone.toLocaleString()} of ${offlineTotal.toLocaleString()} clips.`;if(offlineDone===offlineTotal)return `All ${offlineTotal.toLocaleString()} pronunciation clips are ready offline.`;if(offlineDone)return `${offlineDone.toLocaleString()} of ${offlineTotal.toLocaleString()} clips saved. Download again to resume.`;return pwaRegistration?.active?'App ready for offline use. Audio downloads need a connection.':'The first visit needs a connection while Parayu prepares offline use.'}
function refreshPwaUI(){
 document.querySelectorAll('[data-pwa="install"]').forEach(b=>b.textContent=pwaInstalled()?'Installation help':'Install Parayu');
 document.querySelectorAll('[data-pwa="download"]').forEach(b=>{b.disabled=offlineBusy;b.textContent=offlineBusy?'Downloading…':offlineDone===offlineTotal?'Check offline audio':'Download all audio · 27 MB'});
 document.querySelectorAll('[data-pwa="stop"]').forEach(b=>b.hidden=!offlineBusy);
 document.querySelectorAll('[data-pwa="update"]').forEach(b=>b.hidden=!pwaRegistration?.waiting);
 document.querySelectorAll('.pwa-status').forEach(n=>n.textContent=pwaStatus());
 document.querySelectorAll('.offline-progress').forEach(p=>{p.max=offlineTotal;p.value=offlineDone;p.hidden=!(offlineBusy||offlineDone)});
}
function showPwa(){session=null;openDialog(`${modalHeader('INSTALL & OFFLINE')}<div class="pwa-dialog">${pwaSettings()}</div><div class="modalfoot"><p>Your saved progress stays on this device.</p><button class="btn" data-action="close">Done</button></div>`);refreshPwaUI();void countOfflineAudio()}
async function installParayu(){
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;refreshPwaUI();return}
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const message=pwaInstalled()?'Parayu is already running as an installed app.':ios?'In Safari, tap Share, then Add to Home Screen. Turn on Open as Web App if shown.':'Open this site in Chrome or Edge. Use the browser menu → Install app or Add to Home screen. Installation is available on the HTTPS GitHub Pages link, rather than a ZIP preview or file opened from your computer.';
 openDialog(`${modalHeader('INSTALL PARAYU')}<div class="pwa-dialog"><h1>Keep a little Malayalam close.</h1><p>${esc(message)}</p><p>After installation, Parayu opens in its own app window. Download the voice pack from Install & offline before travelling.</p></div><div class="modalfoot"><button class="textbtn" data-pwa="open">Offline options</button><button class="btn" data-action="close">Got it</button></div>`)
}
async function getOfflineIndex(){if(!offlineIndex){const response=await fetch(new URL('offline-audio-index.json',pwaScope()));if(!response.ok)throw new Error('index');offlineIndex=await response.json();offlineTotal=offlineIndex.count}return offlineIndex}
async function countOfflineAudio(){
 if(!('caches'in window))return;try{const index=await getOfflineIndex(),cache=await caches.open(pwaAudioCache()),keys=new Set((await cache.keys()).map(r=>r.url));offlineDone=index.files.filter(path=>keys.has(new URL(path,pwaScope()).href)).length;refreshPwaUI()}catch{}
}
async function downloadOfflineAudio(){
 if(offlineBusy)return;
 if(!('caches'in window)||!window.isSecureContext){offlineError='Offline downloads require the HTTPS site in a supported browser.';refreshPwaUI();return}
 offlineBusy=true;offlineStop=false;offlineError='';refreshPwaUI();
 try{
  const index=await getOfflineIndex(),cache=await caches.open(pwaAudioCache()),keys=new Set((await cache.keys()).map(r=>r.url));
  offlineDone=index.files.filter(path=>keys.has(new URL(path,pwaScope()).href)).length;
  const pending=index.files.filter(path=>!keys.has(new URL(path,pwaScope()).href));let cursor=0,downloadFailed=false;
  async function worker(){while(!offlineStop&&!downloadFailed&&cursor<pending.length){const path=pending[cursor++];try{const url=new URL(path,pwaScope()).href,response=await fetch(url);if(!response.ok||response.redirected||response.status!==200)throw new Error('clip');await cache.put(url,response);offlineDone++;refreshPwaUI()}catch(error){downloadFailed=true;throw error}}}
  const results=await Promise.allSettled(Array.from({length:4},worker));if(results.some(r=>r.status==='rejected'))throw new Error('download');
  if(offlineDone===offlineTotal)try{await navigator.storage?.persist?.()}catch{}
 }catch(error){offlineError=error.name==='QuotaExceededError'?'There is not enough device storage. Free some space, then try again. Saved clips will be kept.':'The audio download paused. Check your connection and tap Download all audio to resume.'}
 finally{offlineBusy=false;refreshPwaUI()}
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;refreshPwaUI()});
window.addEventListener('appinstalled',()=>{installPrompt=null;refreshPwaUI()});
document.addEventListener('click',event=>{const action=event.target.closest('[data-pwa]')?.dataset.pwa;if(!action)return;if(action==='open')showPwa();if(action==='install')void installParayu();if(action==='download')void downloadOfflineAudio();if(action==='stop'){offlineStop=true}if(action==='update'){updateRequested=true;pwaRegistration?.waiting?.postMessage({type:'SKIP_WAITING'})}});
window.addEventListener('load',async()=>{
 if(!('serviceWorker'in navigator)||!window.isSecureContext){pwaFailure='Install and offline features need the HTTPS site in a supported browser.';refreshPwaUI();return}
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!updateRequested||refreshingForUpdate)return;refreshingForUpdate=true;location.reload()});
 try{
  pwaRegistration=await navigator.serviceWorker.register(new URL('sw.js',pwaScope()),{scope:pwaScope().pathname,updateViaCache:'none'});
  pwaRegistration.addEventListener('updatefound',()=>{const worker=pwaRegistration.installing;worker?.addEventListener('statechange',()=>refreshPwaUI())});
  await navigator.serviceWorker.ready;refreshPwaUI();void countOfflineAudio();
 }catch{pwaFailure='Offline setup could not finish. Reconnect and reload the HTTPS site to try again.';refreshPwaUI()}
});
