"""Build deterministic, Latin-script teaching breakdowns. No runtime guessing/API.

Exact lexical forms and authored analyses take precedence. Case/verb forms are
expanded only from a bounded allowlist built from known stems, and every phrase
and example must resolve completely before output is written.
"""
import json,re,runpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'content/compiled-vocabulary.json').read_text())
words=data['vocabulary']; bynative={w['native']:w for w in words}
# Share the existing transliteration implementation without running its build.
source=(ROOT/'scripts/build-vocabulary.py').read_text()
ns={'re':re,'unicodedata':__import__('unicodedata')}
ns['norm']=lambda s:ns['unicodedata'].normalize('NFC',s).replace('\u200c','').replace('\u200d','').strip()
exec(source[source.index('vowels='):source.index('\nlabels=')],ns)
latin=ns['latin']
parts=lambda *items:[{'text':text,'meaning':meaning} for text,meaning in items]
lex={}
def add(native,gloss,note='',segments=None,literal=None):
    lex[native]={'parts':segments or parts((latin(native),gloss))}
    if note:lex[native]['note']=note
    if literal:lex[native]['literal']=literal
# Token glosses are contextual and intentionally shorter than dictionary senses.
for w in words:add(w['native'],w['meaning'])
# Every authored row is exact-match, never a suffix guess.
for line in (ROOT/'content/breakdown-forms.txt').read_text().splitlines():
    if not line or line.startswith('#'):continue
    f=line.split('|'); native,gloss=f[:2]; note=f[2] if len(f)>2 else ''
    seg=[]
    if len(f)>3:
        for item in re.split(r' / (?=[^/=]+=[^=])',f[3]):
            text,meaning=item.split('=',1);seg.append((text,meaning))
    add(native,gloss,note,parts(*seg) if seg else None)
loan_labels={'രാഘവ്':'Raghav','അനു':'Anu','റെയിൽവേ':'railway','സ്റ്റേഷൻ':'station','സ്റ്റാൻഡ്':'stand','സ്റ്റോപ്പ്':'stop','ഇംഗ്ലീഷ്':'English','ആംബുലൻസ്':'ambulance','ഗൈഡ്':'guide','കണ്ടീഷൻ':'condition','ബിൽ':'bill','ബുക്ക്':'book','ചാർജ്':'charge','ഫീസ്':'fees','പേയ്മെന്റ്':'payment','നെറ്റ്വർക്ക്':'network','ബോട്ട്':'boat'}
for native,label in loan_labels.items():
    if native in lex and len(lex[native]['parts'])==1:lex[native]['parts'][0]['text']=label
# Ordinary verb citation forms: -uka is not a tense or a person ending.
for w in words:
    if w['pos']!='verb':continue
    base=w['native']; assert base.endswith('ുക')
    stem=base[:-2]; stemLatin=latin(stem)
    # Final bare Malayalam consonants need no extra romanized u here.
    if stem.endswith('്') and stemLatin.endswith('u'):stemLatin=stemLatin[:-1]
    elif stem[-1] in ns['consonants'] and stemLatin.endswith('a'):stemLatin=stemLatin[:-1]
    stemLatin+='-'
    gloss=re.sub(r'\s*\([^)]*\)','',w['meaning'].split(';')[0])
    if base not in lex or len(lex[base]['parts'])==1:
        add(base,w['meaning'],'This is a dictionary form. The stem may change before other endings; the stem is not always a word you can use on its own.',parts((stemLatin,gloss+' (verb stem)'),('-uka','dictionary / verbal-noun ending; often listed as “to …”')))
    form=stem+'ാൻ'
    add(form,'to '+gloss,'The -aan form is an infinitive. With kazhiyum, the whole expression means “can …”.',parts((stemLatin,gloss+' (verb stem)'),('-aan','to … (infinitive ending)')))
# Bounded, named case forms used in this exact teaching corpus.
case_forms={
 'മാസത്തിൽ':('maasam','month','-thil','in; during'), 'ഡൽഹിയിൽ':('Delhi','Delhi','-yil','in'),
 'കേരളത്തിൽ':('Keralam','Kerala','-thil','in'), 'കൊച്ചിയിൽ':('Kochi','Kochi','-yil','in'),
 'കൊച്ചിയിലേക്ക്':('Kochi','Kochi','-yilekku','to; towards'), 'കേരളത്തിലേക്ക്':('Keralam','Kerala','-thilekku','to; towards'),
 'ഭക്ഷണത്തിന്':('bhakshanam','food / a meal','-thinu','for'), 'സഹായത്തിന്':('sahaayam','help','-thinu','for'),
 'ഡോക്ടറെ':('doctor','doctor','-e','marks the person being seen'), 'നിങ്ങളെ':('ningal','you (polite / plural)','-e','marks you as the object of the action'),
 'നിങ്ങൾക്ക്':('ningal','you (polite / plural)','-kku','to / for'), 'പേർക്ക്':('per','people','-kku','for'),
 'വശത്ത്':('vasham','side','-ththu','at / on'), 'കൈയിൽ':('kai','hand','-yil','in'),
 'കടകൾ':('kada','shop','-kal','plural: shops'), 'പൂക്കൾ':('poovu','flower','-kkal','plural: flowers'),
 'വഴികൾ':('vazhi','way / route','-kal','plural: ways / routes'), 'പക്ഷികൾക്ക്':('pakshi','bird','-kalkku','for birds (plural + to / for)'),
 'കടയുടെ':('kada','shop','-yude','of'), 'വീടിന്റെ':('veedu','house','-inte','of'),
 'ആളുകളുടെ':('aalukal','people','-ude','of'), 'കഥയുടെ':('katha','story','-yude','of'),
 'യാത്രയ്ക്ക്':('yaathra','trip / journey','-ykku','for'), 'യാത്രയുടെ':('yaathra','trip / journey','-yude','of'),
 'മുറിയുടെ':('muri','room','-yude','of'), 'രൂപയുടെ':('roopa','rupee','-yude','of'),
 'ബസിൽ':('bus','bus','-il','in / on'), 'ബാഗിൽ':('bag','bag','-il','in'),
 'കാറിന്റെ':('car','car','-inte','of'), 'ചായയ്ക്ക്':('chaaya','tea','-ykku','for'),
 'വണ്ടിയിൽ':('vandi','vehicle','-yil','in'), 'സമയത്ത്':('samayam','time','-ththu','at the time'),
 'ഫോണിൽ':('phone','phone','-il','on / in'), 'ആപ്പിന്':('app','app','-inu','for'),
 'മുറിവിൽ':('murivu','wound','-il','in / on'), 'ജീവിതത്തിൽ':('jeevitham','life','-thil','in'),
 'കച്ചവടത്തിൽ':('kachchavadam','business / trade','-thil','in'), 'കാലത്ത്':('kaalam','time / period','-ththu','at / during'),
 'വാക്കിന്റെ':('vaakku','word','-inte','of'), 'മലയാളത്തിൽ':('Malayalam','Malayalam','-thil','in'),
 'പോലീസിനെ':('police','police','-ine','marks who is called'), 'രാത്രിക്ക്':('raathri','night','-kku','for / per'),
 'മണിക്ക്':('mani','hour / clock time','-kku','at; used for “at … o’clock”'),
}
for native,(base,meaning,suffix,role) in case_forms.items():
    add(native,meaning+'; '+role,'The ending marks the word’s relationship to the rest of the sentence. Joining can change the end of the base word.',parts((base,meaning),(suffix,role)))
# Selected joined copulas: do not indiscriminately strip endings from all words.
joined={
 'പ്രധാനമാണ്':('pradhaanam','important'), 'ഇഷ്ടമാണ്':('ishtam','liking / preference'), 'രൂപയാണ്':('roopa','rupees'),
 'തന്നെയാണ്':('thanne','exactly / the very same'), 'അധ്യാപകനാണ്':('adhyaapakan','male teacher'),
 'ബാഗാണ്':('bag','bag'), 'സ്ഥലമാണ്':('sthalam','place'), 'സുഹൃത്താണ്':('suhriththu','friend'),
 'മഴയാണ്':('mazha','rain'), 'മനോഹരമാണ്':('manoharam','beautiful'), 'ചൂടാണ്':('choodu','hot / heat'),
 'കൂടുതലാണ്':('kooduthal','more / a lot'), 'കുറവാണ്':('kuravu','less / a shortage'), 'തയ്യാറാണ്':('thayyaar','ready'),
 'തിരക്കാണ്':('thirakku','busy / a crowd'), 'വൈകുന്നേരമാണ്':('vaikunneram','evening'), 'ആഴ്ചയാണ്':('aazhcha','week'),
 'പഴയതാണ്':('pazhayathu','old one'), 'നല്ലതാണ്':('nallathu','good thing / good one'),
 'ഭാര്യയാണ്':('bhaarya','wife'), 'ഭർത്താവാണ്':('bharthaavu','husband'), 'വിനോദസഞ്ചാരിയാണ്':('vinodasanjaari','tourist'),
}
for native,(base,meaning) in joined.items():add(native,meaning+'; is / are','Aanu links the description or identity to the person or thing. A joining y can appear after a vowel.',parts((base,meaning),('aanu','is / am / are')))
# Existence / possession compounds. The English subject is supplied by context.
for native,base,meaning in [('യാത്രയുണ്ട്','yaathra','trip'),('പരീക്ഷയുണ്ട്','pareeksha','exam'),('അവധിയുണ്ട്','avadhi','holiday / leave'),('മഴയുണ്ട്','mazha','rain'),('രുചിയുണ്ട്','ruchi','taste / flavour'),('അലർജിയുണ്ട്','allergy','allergy'),('വേദനയുണ്ട്','vedana','pain')]:
    add(native,meaning+'; there is / have','Undu expresses existence or possession. With enikku (“to me”), the natural English meaning is “I have …”.',parts((base,meaning),('undu','there is / exists; have')))
# Finite forms with known stems in this content. Endings are explained in context.
finite={
 'വരുന്നു':('var','come','-unnu','present: come / is coming'), 'താമസിക്കുന്നു':('thaamasikk','live / stay','-unnu','present: live / am staying'),
 'നടക്കുന്നു':('nadakk','walk / happen','-unnu','present: walking / taking place'), 'ചെയ്യുന്നു':('cheyy','do','-unnu','present: do / is doing'),
 'കാത്തിരിക്കുന്നു':('kaathirikk','wait','-unnu','present: waiting'), 'പോകുന്നു':('pok','go','-unnu','present: go / is going'),
 'പെയ്യുന്നു':('peyy','rain / fall (of rain)','-unnu','present: is raining'), 'പഠിക്കുന്നു':('padikk','learn / study','-unnu','present: am studying'),
 'തുടരുന്നു':('thudar','continue','-unnu','present: continues'), 'തോന്നുന്നു':('thonn','seem / feel','-unnu','present: feels / seems'),
 'ആശംസിക്കുന്നു':('aashamsikk','wish','-unnu','present: wish'),
 'വരും':('var','come','-um','will come'), 'പോകും':('pok','go','-um','will go'), 'നടക്കും':('nadakk','walk / happen','-um','will walk / will happen'),
 'തുറക്കും':('thurakk','open','-um','will open'), 'താമസിക്കും':('thaamasikk','stay','-um','will stay'),
 'തുടങ്ങും':('thudang','start','-um','will start'), 'വിശ്രമിക്കും':('vishramikk','rest','-um','will rest'),
 'ചിരിക്കും':('chirikk','laugh / smile','-um','will laugh / smile'), 'കുടിക്കും':('kudikk','drink','-um','will drink'),
 'മടങ്ങും':('madang','return','-um','will return'), 'സംഭവിക്കും':('sambhavikk','happen','-um','will happen'),
 'തീരും':('theer','finish / end','-um','will finish'), 'വിരിയും':('viriy','bloom / unfold','-um','will bloom'),
 'എടുക്കും':('edukk','take','-um','will take'), 'അടയ്ക്കും':('adaykk','close','-um','will close'), 'പറയും':('paray','say','-um','will say'),
 'പോകണം':('pok','go','-anam','need to / should go'), 'കഴിക്കണം':('kazhikk','eat / take (medicine)','-anam','should eat / take'),
 'സഹായിക്കണം':('sahaayikk','help','-anam','should help'), 'അടയ്ക്കണം':('adaykk','close','-anam','should close'),
 'ഉപയോഗിക്കണം':('upayogikk','use','-anam','should use'), 'എടുക്കണം':('edukk','take','-anam','should take'),
 'വിശ്രമിക്കണം':('vishramikk','rest','-anam','should rest'), 'പരിശോധിക്കണം':('parishodhikk','check / examine','-anam','should check'),
 'കൊടുക്കണം':('kodukk','give','-anam','should give'), 'കാണണം':('kaan','see','-anam','need to see'),
 'താമസിക്കണം':('thaamasikk','stay','-anam','need to stay'),
 'വിളിക്കൂ':('vilikk','call','-oo','request / instruction: call'), 'പറയൂ':('paray','say','-oo','request: say / speak'),
 'വരൂ':('var','come','-oo','request: come'), 'കാത്തിരിക്കൂ':('kaathirikk','wait','-oo','request: wait'),
 'നിൽക്കൂ':('nilkk','stand / wait','-oo','request: stand / wait'), 'കാണൂ':('kaan','see / look','-oo','request: look'),
 'ഇരിക്കൂ':('irikk','sit','-oo','request: sit'), 'കുറയ്ക്കൂ':('kuraykk','reduce','-oo','request: reduce'),
 'തിരിയൂ':('thiriy','turn','-oo','request: turn'), 'സംസാരിക്കൂ':('samsaarikk','speak','-oo','request: speak'),
 'കേൾക്കൂ':('kelkk','listen','-oo','request: listen'), 'പോകൂ':('pok','go','-oo','request: go'),
 'തരൂ':('thar','give (to me / us)','-oo','request: give'), 'നിർത്തൂ':('nirthth','stop','-oo','request: stop'),
}
for native,(base,meaning,end,role) in finite.items():add(native,role,'The ending supplies the tense or kind of request. Malayalam verbs do not change to match “I”, “you”, or “they”.',parts((base,meaning+' (verb stem)'),(end,role)))
# Read independently authored whole-phrase notes, keyed by stable phrase ID.
phrase_notes=json.loads((ROOT/'content/phrase-breakdown-notes.json').read_text())
def tokens(text):return [t for t in re.findall(r'[^\s.,?!;:“”]+',text)]
missing=set()
def analyze(text):
    result=[];notes=[]
    for token in tokens(text):
        a=lex.get(token)
        if not a:missing.add(token);continue
        for p in a['parts']:result.append(dict(p))
        if token=='ഒന്ന്' and any(x in text for x in ['നോക്കട്ടെ','ഉപയോഗിക്കാമോ','പറയാമോ','സഹായിക്കാമോ']):
            result[-1]['meaning']='just; a little (softens the request; literally “one”)'
        if a.get('note') and a['note'] not in notes:notes.append(a['note'])
    return result,notes

def construction(text):
    # One actionable explanation, selected from grammar actually present.
    if 'വേണം' in text:return 'The wanted item comes before venam (“want / need”). Enikku means “to me”; together this becomes “I would like / I need …” in natural English.'
    if 'വേണ്ട' in text:return 'Venda declines something: “do not want / do not need”. Keep it distinct from venam (“want / need”).'
    if 'കഴിയും' in text:return 'Enikku (“to me”) + an action in -aan + kazhiyum (“is possible”) expresses “I can …”. The word for the action comes before kazhiyum.'
    if any(t in text for t in ['എവിടെ','എവിടേ']):return 'Often the place or thing comes first, followed by evide (“where”). Malayalam often leaves out words that English needs, such as “is the”.'
    if 'തോന്നുന്നു' in text:return 'Enikku (“to me”) names the person experiencing a feeling. The feeling comes before thonnunnu (“feels / seems”): natural English is “I feel …”.'
    if 'ഉണ്ട്' in text or 'യുണ്ട്' in text:return 'Undu says that something exists. A place + item + undu means “there is … here/there”; enikku + item + undu naturally means “I have …”.'
    if 'ആണ്' in text or any(t in text for t in ['മാണ്','യാണ്','നാണ്','ത്താണ്','താണ്','ഗാണ്']):return 'Aanu (“is / am / are”) links a thing to its identity or description. It can join the preceding word, with small sound changes at the join.'
    if any(t.endswith('മോ') for t in tokens(text)):return 'The final -o makes a yes/no question. In a request such as tharaamo (“could you give …?”), the full verb form makes the question polite; -o alone does not mean “please”.'
    return 'Read the parts in Malayalam order, then use the natural English meaning above. A word or ending can do a job that needs several words in English.'

def word_analysis(w):
    a=lex[w['native']]; ps=a['parts']; note=a.get('note','')
    if not note:
        if len(ps)>1:note='These are useful meaning units. The joined spoken form can change slightly at the boundary.'
        elif w['pos']=='noun':note='Learn this as one vocabulary unit. In a sentence, it can name a person, thing, place, or idea; extra endings can show “in”, “to”, or “of”. There is no useful smaller split taught here.'
        elif w['pos']=='adjective':note='This word describes the noun after it. In the example, look for the thing being described, then aanu (“is”). Learn the word as a unit rather than splitting its syllables.'
        elif w['pos']=='time / number':note='Use this as a time or quantity word. Its position and any added ending determine whether it gives a number, a date, or a time. Learn this entry as one unit.'
        else:note='This is a meaning-bearing word or expression. Its grammatical job is shown by the example breakdown below; it is not split into smaller sounds here.'
    sentence,notes=analyze(w['sentenceNative'])
    return {'parts':ps,'note':note,'sentenceParts':sentence,'sentenceNote':construction(w['sentenceNative']),'formNotes':notes}
word_output={w['id']:word_analysis(w) for w in words}
original=json.loads((ROOT/'content/lesson-phrases.json').read_text())
phrase_rows=[{'native':r[3],'latin':r[0],'english':r[1]} for r in original]+data['phrases']
phrase_output={}
for i,p in enumerate(phrase_rows):
    ps,notes=analyze(p['native']); custom=phrase_notes.get(str(i),{})
    phrase_output[str(i)]={'parts':custom.get('parts',ps),'literal':custom.get('literal'), 'note':custom.get('note',notes[0] if len(tokens(p['native']))==1 and notes else construction(p['native'])),'formNotes':notes}
if missing:
    print('UNRESOLVED',len(missing));print('\n'.join(sorted(missing)));sys.exit(1)
meta={'version':1,'approach':'Meaning units for speaking, not a syllable-by-syllable etymology. Joining can change sounds and spelling. Simple words are kept whole; only supported grammatical forms and selected compounds are split. Literal glosses are memory aids, not natural English translations.',
'sources':[{'title':'Moag & Moag — A Course in Colloquial Malayalam (University of Wisconsin / Peace Corps)','url':'https://files.eric.ed.gov/fulltext/ED030093.pdf'},{'title':'Universal Dependencies — Malayalam grammar and segmentation','url':'https://universaldependencies.org/ml/'},{'title':'Wiktionary — sukham (Sanskrit borrowing)','url':'https://en.wiktionary.org/wiki/സുഖം#Malayalam'}]}
output={'words':word_output,'phrases':phrase_output,'meta':meta}
(ROOT/'dist/breakdown-data.js').write_text('window.PARAYU_BREAKDOWNS = '+json.dumps(output,ensure_ascii=False,separators=(',',':'))+';\n')
print(f'Built breakdowns for {len(word_output)} words + their example sentences, and {len(phrase_output)} phrases. Every token resolved.')
