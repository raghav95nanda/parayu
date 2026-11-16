"""Build Parayu's fixed Malayalam audio pack; no speech service runs in the app.

Install the optional build dependency: pip install piper-tts==1.8.0
Download ml_IN-arjun-medium.onnx and its .onnx.json from the voice source below.
Run: python scripts/generate-pronunciation.py --model /path/to/model.onnx
FFmpeg must also be installed. The model is a build input, not a deployed asset.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import wave

from piper import PiperVoice, SynthesisConfig

SOURCE = 'https://huggingface.co/rhasspy/piper-voices/tree/main/ml/ml_IN/arjun/medium'
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--model', required=True)
args = parser.parse_args()
extract = """const fs=require('fs'),vm=require('vm');const s=fs.readFileSync('dist/app.js','utf8');const c=s.slice(s.indexOf('const rows='),s.indexOf('const phrases='));console.log(JSON.stringify(vm.runInNewContext(c+';rows').map((p,id)=>({key:'phrase-'+String(id).padStart(2,'0'),text:p[3]}))));"""
phrases = json.loads(subprocess.check_output(['node', '-e', extract], cwd=ROOT))
phrases.append({'key': 'mazha', 'text': 'മഴ'})
voice = PiperVoice.load(args.model)
output = ROOT / 'dist' / 'audio'
output.mkdir(exist_ok=True)
manifest = {'version': 1, 'language': 'ml-IN', 'voice': 'Piper Arjun (medium)',
            'source': SOURCE, 'engine': 'piper-tts 1.8.0', 'clips': []}

with tempfile.TemporaryDirectory(prefix='parayu-audio-') as temp:
    temp = Path(temp)
    for phrase in phrases:
        wav = temp / (phrase['key'] + '.wav')
        with wave.open(str(wav), 'wb') as wav_file:
            voice.synthesize_wav(phrase['text'], wav_file,
                                 syn_config=SynthesisConfig(length_scale=1.06))
        entry = {'key': phrase['key'], 'text_sha256': hashlib.sha256(phrase['text'].encode()).hexdigest()}
        for speed in ['normal', 'slow']:
            name = phrase['key'] + ('-slow' if speed == 'slow' else '') + '.mp3'
            target = output / name
            filters = ('atempo=0.76,' if speed == 'slow' else '') + 'loudnorm=I=-18:TP=-1.5:LRA=8'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav),
                            '-af', filters, '-ac', '1', '-ar', '22050',
                            '-codec:a', 'libmp3lame', '-b:a', '64k', str(target)], check=True)
            duration = float(subprocess.check_output(['ffprobe', '-v', 'error',
                              '-show_entries', 'format=duration', '-of', 'csv=p=0', str(target)]))
            if duration < .2 or target.stat().st_size < 1500:
                raise RuntimeError('Invalid audio: ' + name)
            entry[speed] = {'file': name, 'seconds': round(duration, 3),
                            'bytes': target.stat().st_size,
                            'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
        manifest['clips'].append(entry)
        print('Built ' + phrase['key'], flush=True)
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Finished: {len(phrases)} Malayalam phrases, normal and slow.', flush=True)
