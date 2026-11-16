"""Generate new phrase and vocabulary clips with Piper + FFmpeg.
Run with the same optional build dependencies as generate-pronunciation.py.
Existing clips with matching text hashes are reused. No model is deployed.
"""
import argparse,concurrent.futures,hashlib,json,os,subprocess,tempfile,wave
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VOICE=None
def initialize(model):
    global VOICE
    import onnxruntime
    from piper import PiperVoice
    from piper.config import PiperConfig
    options=onnxruntime.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1
    VOICE=PiperVoice(config=PiperConfig.from_dict(json.loads(Path(model+'.json').read_text())),session=onnxruntime.InferenceSession(model,sess_options=options,providers=['CPUExecutionProvider']))

def synthesize(job):
    from piper import SynthesisConfig
    relative,text,slow=job
    target=ROOT/'dist/audio'/relative;target.parent.mkdir(exist_ok=True,parents=True)
    with tempfile.TemporaryDirectory(prefix='parayu-clip-') as folder:
        wav=Path(folder)/'clip.wav'
        with wave.open(str(wav),'wb') as f:VOICE.synthesize_wav(text,f,syn_config=SynthesisConfig(length_scale=1.06))
        filters=('atempo=0.76,' if slow else '')+'loudnorm=I=-18:TP=-1.5:LRA=8'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-threads','1','-af',filters,'-ac','1','-ar','22050','-codec:a','libmp3lame','-b:a','48k',str(target)],check=True)
    seconds=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(target)]))
    assert .15<seconds<35,(relative,seconds)
    return {'file':relative,'text_sha256':hashlib.sha256(text.encode()).hexdigest(),'bytes':target.stat().st_size,'seconds':round(seconds,3),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--model',required=True);parser.add_argument('--workers',type=int,default=3);args=parser.parse_args()
    data=json.loads((ROOT/'content/compiled-vocabulary.json').read_text())
    manifest_path=ROOT/'dist/audio/content-manifest.json'
    previous=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'clips':[]}
    clips={x['file']:x for x in previous['clips']}
    jobs=[]
    for i,p in enumerate(data['phrases'],36):
        for slow in [False,True]:jobs.append((f'phrase-{i:02d}'+('-slow' if slow else '')+'.mp3',p['native'],slow))
    for word in data['vocabulary']:
        jobs.append(('vocabulary/'+word['id']+'-word.mp3',word['native'],False))
        jobs.append(('vocabulary/'+word['id']+'-example.mp3',word['sentenceNative'],False))
    needed=[job for job in jobs if not ((ROOT/'dist/audio'/job[0]).exists() and clips.get(job[0],{}).get('text_sha256')==hashlib.sha256(job[1].encode()).hexdigest())]
    print('Audio jobs:',len(jobs),'to build:',len(needed),flush=True)
    def checkpoint():
        manifest_path.write_text(json.dumps({'version':1,'language':'ml-IN','voice':'Piper Arjun (medium)','source':'https://huggingface.co/rhasspy/piper-voices/tree/main/ml/ml_IN/arjun/medium','clips':sorted(clips.values(),key=lambda x:x['file'])},indent=2)+'\n')
    done=0
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers,initializer=initialize,initargs=(args.model,)) as pool:
        for clip in pool.map(synthesize,needed,chunksize=4):
            clips[clip['file']]=clip;done+=1
            if done%100==0:checkpoint();print('Built',done,'/',len(needed),flush=True)
    checkpoint()
    print('Complete:',len(clips),'clips;',sum(x['bytes'] for x in clips.values()),'bytes',flush=True)
