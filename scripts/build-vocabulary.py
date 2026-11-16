"""Compile the curated, frequency-informed word bank and expanded phrasebook.

Usage: python scripts/build-vocabulary.py --frequency /path/to/ml.vocabfreq.tsv
       --dictionary /path/to/kaikki.org-dictionary-Malayalam.jsonl
Raw corpora are not shipped; per-entry source ranks and attribution are retained.
"""
import argparse,collections,hashlib,json,re,unicodedata
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--frequency',required=True);parser.add_argument('--dictionary',required=True);args=parser.parse_args()
norm=lambda s:unicodedata.normalize('NFC',s).replace('\u200c','').replace('\u200d','').strip()
frequency={}
for rank,line in enumerate(Path(args.frequency).read_text().splitlines()[1:],1):
    word,count=line.split('\t');frequency[norm(word)]=(rank,int(count))
dictionary=collections.defaultdict(list)
for line in Path(args.dictionary).read_text().splitlines():
    entry=json.loads(line);dictionary[norm(entry['word'])].append(entry)

vowels=dict(zip('അആഇഈഉഊഋഎഏഐഒഓഔ',['a','aa','i','ee','u','oo','ri','e','e','ai','o','o','au']))
consonants=dict(zip('കഖഗഘങചഛജഝഞടഠഡഢണതഥദധനപഫബഭമയരറലളഴവശഷസഹ',['k','kh','g','gh','ng','ch','chh','j','jh','nj','t','th','d','dh','n','th','th','d','dh','n','p','ph','b','bh','m','y','r','r','l','l','zh','v','sh','sh','s','h']))
signs=dict(zip('ാിീുൂൃെേൈൊോൗ',['aa','i','ee','u','oo','ri','e','e','ai','o','o','au']))
chillu=dict(zip('ൺൻർൽൾൿ',['n','n','r','l','l','k']))
loan_spellings={'വൈഫൈ':'wifi','പാസ്വേഡ്':'password','എയർ':'air','ഫോൺ':'phone','ബുക്കിങ്':'booking','ബാഗ്':'bag','ചെക്കൗട്ട്':'checkout','ഇന്റർനെറ്റ്':'internet','സിം':'SIM','യുപിഐ':'UPI','എടിഎം':'ATM','കാർഡ്':'card','ഡാറ്റ':'data','കാർ':'car','ബസ്':'bus','ട്രെയിൻ':'train','ഹോട്ടൽ':'hotel','ക്ലാസ്':'class','സ്കൂൾ':'school','ടിക്കറ്റ്':'ticket','ഫോട്ടോ':'photo','വീഡിയോ':'video','ആപ്പ്':'app','ഓട്ടോ':'auto','കമ്പ്യൂട്ടർ':'computer','ലാപ്ടോപ്പ്':'laptop','സ്മാർട്ട്ഫോൺ':'smartphone'}
def latin(text):
    text=norm(text)
    pieces=re.split(r'(\s+|[?.!,])',text)
    if len(pieces)>1:return ''.join(latin(piece) if re.search(r'[\u0d00-\u0d7f]',piece) else piece for piece in pieces)
    if text in loan_spellings:return loan_spellings[text]
    out=[];i=0
    while i<len(text):
        c=text[i]
        if c in consonants:
            sound=consonants[c];nextc=text[i+1:i+2]
            previous=text[i-1:i] if i else ''
            following=text[i+2:i+3]
            if previous and (previous in vowels or previous in signs or previous in consonants) and (nextc!='്' or not following or not ('\u0d00'<=following<='\u0d7f')):
                sound={'ട':'d','ഠ':'d'}.get(c,sound)
            if c=='ഠ':sound='d'
            if i>=2 and text[i-1]=='്' and ((text[i-2]=='ണ' and c=='ട') or (text[i-2]=='മ' and c=='പ')):sound='d' if c=='ട' else 'b'
            if nextc=='്':
                following=text[i+2:i+3]
                out.append(sound+('u' if not following or not ('\u0d00'<=following<='\u0d7f') else ''));i+=2;continue
            if nextc in signs:out.append(sound+signs[nextc]);i+=2;continue
            out.append(sound+'a')
        elif c in vowels:out.append(vowels[c])
        elif c in chillu:out.append(chillu[c])
        elif c=='ം':out.append('m')
        elif c=='ഃ':out.append('h')
        elif c not in {'്','ൗ'}:out.append(c)
        i+=1
    value=''.join(out).replace('nre','nte').replace('nra','nta').replace('nru','ntu').replace('rra','tta').replace('rri','tti').replace('rru','ttu')
    return value

labels={'core':'Conversation','verbs':'Everyday verbs','describing':'Describing things','food':'Food & drink','home':'At home','people':'People & family','body':'Body & health','places':'Places','travel':'Travel & transport','nature':'Nature & weather','animals':'Animals','clothing':'Clothes & belongings','time':'Time & numbers','work':'Work & study','money':'Money','technology':'Phone & technology','feelings':'Feelings','concepts':'Ideas & everyday life'}
quotas={'core':95,'verbs':115,'describing':80,'food':90,'home':65,'people':55,'body':45,'places':60,'travel':45,'nature':45,'animals':30,'clothing':30,'time':70,'work':55,'money':30,'technology':30,'feelings':25,'concepts':35}
assert sum(quotas.values())==1000
exclude={'പാചകംചെയ്യുക','നൃത്തംചെയ്യുക','യാത്രചെയ്യുക','ജോലിചെയ്യുക','നന്ദിപറയുക','ആസൂത്രണംചെയ്യുക','അയക്കുക','പോലീസ്സ്റ്റേഷൻ','ബസ്സ്റ്റാൻഡ്','ബോർഡിങ്പാസ്','സുരക്ഷാജീവനക്കാരൻ','സമയംക്രമം','പണംമാറ്റം','മടക്കിനൽകൽ','കുഞ്ഞിക്കോഴി','കാല്വിരൽ','പതുക്കെയുള്ള'}
overrides={}
for line in (ROOT/'content/example-overrides.txt').read_text().splitlines():
    if line and not line.startswith('#'):
        word,ml,en=line.split('|');overrides[norm(word)]=(ml,en)
overrides.update({'സംഭവിക്കുക':('ഇത് എപ്പോൾ സംഭവിക്കും?','When will this happen?'),'തീരുക':('ജോലി എപ്പോൾ തീരും?','When will the work finish?'),'കേടാക്കുക':('ഇത് കേടാക്കരുത്.','Do not damage this.'),'മറക്കുക':('ദയവായി എന്നെ മറക്കരുത്.','Please do not forget me.'),'പറക്കുക':('പക്ഷികൾക്ക് പറക്കാൻ കഴിയും.','Birds can fly.'),'വളരുക':('ചെടികൾക്ക് വളരാൻ വെള്ളം വേണം.','Plants need water to grow.')})

def first_meaning(meaning):return re.sub(r'\s*\([^)]*\)','',meaning.split(';')[0]).strip()
def example(fields,category):
    word,meaning=fields[:2];meaning=first_meaning(meaning)
    if norm(word) in overrides:return (*overrides[norm(word)],None)
    if len(fields)>=4 and re.search(r'[.!?]$',fields[2]):return fields[2],fields[3],None
    if category=='verbs':
        assert word.endswith('ുക'),word
        form=word[:-2]+'ാൻ'
        return f'എനിക്ക് {form} കഴിയും.',f'I can {meaning}.',form
    if category=='describing':
        if len(fields)<4:raise ValueError(fields)
        noun,en=fields[2:4]
        uncountable={'information','weather','food','water','tea','curd','wood','cloth','help'}
        article='' if en in uncountable or meaning.startswith('another') else 'an ' if meaning[0].lower() in 'aeiou' or meaning.startswith('honest') else 'a '
        return f'ഇത് {word} {noun} ആണ്.',f'This is {article}{meaning} {en}.',None
    if category=='food':return f'എനിക്ക് {word} വേണം.',f'I would like {meaning if meaning.startswith("a ") else "some "+meaning}.',None
    if category=='home':return f'ഇത് {word} ആണ്.',f'This is the {"pair of " if meaning=="scissors" else ""}{meaning}.',None
    if category=='people':
        if len(fields)>2 and fields[2]=='family':return f'എന്റെ {word} ഇവിടെ ഉണ്ട്.',f'My {meaning} {"are" if meaning=="parents" else "is"} here.',None
        return f'ആ {word} ഇവിടെ ഉണ്ട്.',f'That {meaning} is here.',None
    if category=='body':return f'ഇത് എന്റെ {word} ആണ്.',f'This is my {meaning}.',None
    if category=='places':return f'{word} എവിടെയാണ്?',f'Where is the {meaning}?',None
    if category=='travel':return f'എനിക്ക് ഈ {word} വേണം.',f'I need this {meaning}.',None
    if category=='nature':
        if len(fields)>2 and fields[2]=='there':return f'ഇവിടെ {word} ഉണ്ട്.',f'There is {meaning} here.',None
        return f'ഞാൻ {word} കണ്ടു.',f'I saw the {meaning}.',None
    if category=='animals':
        article='an' if meaning[0].lower() in 'aeiou' else 'a'
        return f'അവിടെ ഒരു {word} ഉണ്ട്.',f'There is {article} {meaning} over there.',None
    if category=='clothing':
        determiner='these' if meaning in {'trousers','jeans','socks','spectacles','sunglasses'} else 'this'
        return f'എനിക്ക് ഈ {word} വേണം.',f'I would like {determiner} {meaning}.',None
    if category=='work':return f'ഈ {word} പ്രധാനമാണ്.',f'This {meaning} is important.',None
    if category=='money':return f'എനിക്ക് {word} വേണം.',f'I need the {meaning}.',None
    if category=='technology':return f'എനിക്ക് {word} ഉപയോഗിക്കാം.',f'I can use the {meaning}.',None
    if category=='feelings':return f'എനിക്ക് {word} തോന്നുന്നു.',f'I feel {meaning}.',None
    if category=='concepts':return f'{word} പ്രധാനമാണ്.',f'{meaning[0].upper()+meaning[1:]} is important.',None
    raise ValueError((category,fields))

groups=collections.defaultdict(list);seen={};category='';duplicate=[]
for line in (ROOT/'content/vocabulary-source.txt').read_text().splitlines():
    if line.startswith('@'):category=line[1:];continue
    if not line or line.startswith('#'):continue
    fields=line.split('|');word=norm(fields[0]);fields[0]=word
    if word in exclude:continue
    if word in seen:
        duplicate.append(word)
        if fields[1] not in seen[word]['meaning']:seen[word]['meaning']+='; '+fields[1]
        continue
    ml,en,form=example(fields,category)
    pos='verb' if category=='verbs' else 'adjective' if category=='describing' else 'expression' if category=='core' else 'noun'
    if category=='time':pos='time / number'
    if category=='technology' and word in {'ഓൺലൈൻ','ഓഫ്ലൈൻ'}:pos='adverb'
    rank,count=frequency.get(word,(None,None))
    row={'id':'v'+hashlib.sha256(word.encode()).hexdigest()[:10],'native':word,'latin':latin(word),'meaning':fields[1],'category':category,'pos':pos,'sentenceNative':ml,'sentence':latin(ml),'translation':en,'sentenceForm':latin(form) if form else None,'frequencyRank':rank,'frequency':count,'dictionaryUrl':'https://en.wiktionary.org/wiki/'+word+'#Malayalam' if word in dictionary else None,'exampleType':'original teaching example'}
    seen[word]=row;groups[category].append(row)
selected=[]
for category,quota in quotas.items():
    candidates=groups[category]
    # Source order favours simple spoken forms when the written corpus has no rank.
    candidates=sorted(enumerate(candidates),key=lambda x:(0 if x[1]['frequencyRank'] else 1,x[1]['frequencyRank'] or x[0]))
    if len(candidates)<quota:raise ValueError((category,len(candidates),quota))
    selected.extend(row for _,row in candidates[:quota])
selected.sort(key=lambda x:(x['frequencyRank'] is None,x['frequencyRank'] or 999999))
for i,row in enumerate(selected,1):row['order']=i
assert len(selected)==1000 and len({x['native'] for x in selected})==1000

extra=[]
for line in (ROOT/'content/phrasebook-source.txt').read_text().splitlines():
    if not line or line.startswith('#'):continue
    fields=line.split('|');topic=int(fields[0]);native=fields[1];roman=latin(native)
    tip=fields[3] if len(fields)>3 else ('Hold aa, ee and oo a little longer. Listen once at normal speed, then try the slower version.' if re.search('aa|ee|oo',roman) else 'Keep the syllables light and connected. Listen to the full phrase, then repeat it aloud.')
    extra.append({'topic':topic,'native':native,'latin':roman[0].upper()+roman[1:],'english':fields[2],'say':roman,'tip':tip})
assert len(extra)==108
meta={'count':1000,'labels':labels,'selection':'A curated, frequency-informed learning collection, not a definitive top-1,000 ranking of spoken Malayalam. Written-corpus frequency guides ordering; practical spoken vocabulary and useful dictionary forms are included.','frequencySource':'https://huggingface.co/datasets/kavyamanohar/ml-word-frequency','dictionarySource':'https://kaikki.org/dictionary/Malayalam/index.html','examples':'Original short teaching examples. Word forms may change in a sentence.','licenses':['Frequency data: Kavya Manohar / AI4Bharat Indic NLP corpus, CC BY-SA 3.0.','Dictionary cross-references: English Wiktionary via Kaikki / Wiktextract, CC BY-SA 4.0.','Curated definitions, examples and word-bank arrangement: CC BY-SA 4.0.']}
data={'vocabulary':selected,'phrases':extra,'meta':meta}
(ROOT/'dist/content-data.js').write_text('window.PARAYU_CONTENT = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'dist/vocabulary-data.json').write_text(json.dumps({'vocabulary':selected,'meta':meta},ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'dist/content-audio-index.js').write_text('self.PARAYU_AUDIO_INDEX = '+json.dumps({'phraseCount':36+len(extra),'vocabularyIds':[x['id'] for x in selected]})+';\n')
(ROOT/'content/compiled-vocabulary.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Built 1000 unique words and',36+len(extra),'phrasebook entries.')
print('Dictionary matches:',sum(bool(x['dictionaryUrl']) for x in selected),'Frequency matches:',sum(bool(x['frequencyRank']) for x in selected))
print('Categories:',dict(collections.Counter(x['category'] for x in selected)))
