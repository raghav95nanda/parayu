'use strict';
function breakdownParts(items){return `<ul class="meaning-parts">${items.map(p=>`<li><strong lang="ml-Latn">${esc(p.text)}</strong><span>${esc(p.meaning)}</span></li>`).join('')}</ul>`}
function breakdownPanel(data,{title='Break it down',open=false,sentence=false}={}){
 if(!data)return '';
 const items=sentence?data.sentenceParts:data.parts,note=sentence?data.sentenceNote:data.note;
 const notes=[...new Set(!sentence&&data.sentenceParts?[]:data.formNotes||[])].filter(n=>n!==note);
 return `<details class="logic-panel${sentence?' sentence-logic':''}" ${open?'open':''}><summary><span class="logic-mark" aria-hidden="true">＋</span><span>${esc(title)}</span><span class="logic-hint">${sentence?'WORD BY WORD':'MEANING & GRAMMAR'}</span></summary><div class="logic-body">${breakdownParts(items)}${!sentence&&data.literal?`<div class="logic-literal"><span>LITERAL SENSE</span><p>${esc(data.literal)}</p></div>`:''}<p class="logic-explanation">${esc(note)}</p>${notes.length?`<details class="form-logic"><summary>Why these forms?</summary><ul>${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></details>`:''}<p class="logic-foot">Meaning units, not syllables. Sounds can change where parts join.</p></div></details>`;
}
function phraseBreakdown(id,open=false){return breakdownPanel(window.PARAYU_BREAKDOWNS?.phrases[String(id)],{open})}
function wordBreakdown(id){return breakdownPanel(window.PARAYU_BREAKDOWNS?.words[id],{title:'Understand this word',open:true})}
function sentenceBreakdown(id){return breakdownPanel(window.PARAYU_BREAKDOWNS?.words[id],{title:'Break down the sentence',sentence:true})}
function breakdownSources(){const meta=window.PARAYU_BREAKDOWNS?.meta;if(!meta)return '';return `<p>${esc(meta.approach)}</p><p>Grammar explanations draw on ${meta.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join('; ')}. The explanations are concise teaching analyses, not a claim that every word has a smaller literal meaning. Sanskrit origin is noted only for selected supported entries.</p>`}
