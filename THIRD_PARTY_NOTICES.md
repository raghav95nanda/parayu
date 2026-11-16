# Third-party sources and notices

Keep this file, `content/LICENSE.md`, and the audio manifests when sharing the app.

## Synthesized pronunciation

The included audio was generated with Piper TTS 1.8.0 using the `ml_IN-arjun-medium` Malayalam voice. Voice/model source and model card:

https://huggingface.co/rhasspy/piper-voices/tree/main/ml/ml_IN/arjun/medium

Source text hashes, per-file checksums, durations, and engine details are retained in `app/audio/manifest.json` and `app/audio/content-manifest.json`. These JSON files describe MP3s that are stored in `audio-packs` and restored by the build. Model weights and speech-generation dependencies are not included in this package. Refer to the original model card for its source/dataset notices.

## Language data and grammar

Data attribution and share-alike licenses are retained in `content/LICENSE.md`. Word-bank entries keep corpus ranks and individual Wiktionary cross-references where available.

Grammar references:

- Moag & Moag, *A Course in Colloquial Malayalam*, University of Wisconsin / Peace Corps: https://files.eric.ed.gov/fulltext/ED030093.pdf
- Universal Dependencies, Malayalam: https://universaldependencies.org/ml/
- Selected Wiktionary etymological references, including https://en.wiktionary.org/wiki/സുഖം#Malayalam
- Pronunciation resources: https://malayalam.la.utexas.edu/resources/pronunciation-the-basics/
- Kerala Tourism visitor phrases: https://www.keralatourism.org/faq/the-must-know-10-malayalam-words-when-you-visit-kerala

## Fonts

The app optionally loads DM Sans and Manrope through Google Fonts. These font families are released under the SIL Open Font License; their font files are not bundled here. When offline or font loading is unavailable, the app uses system sans-serif fallbacks.

## Supabase browser client

The Pages build includes the MIT-licensed `@supabase/supabase-js` browser SDK pinned in `package-lock.json`. The SDK source and license are available at https://github.com/supabase/supabase-js.

## Original code

Original application code is covered by `CODE_LICENSE.txt` (MIT). Source-derived language content retains its separate attribution and licensing.
