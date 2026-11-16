# Parayu — Malayalam speaking practice

A complete GitHub Pages PWA for learning spoken Malayalam in Latin script. Includes 18 lessons, 144 travel phrases, 1,000 vocabulary words, meaning/grammar breakdowns, and all 2,290 pronunciation clips. Guest practice and audio work without a Supabase connection. Email accounts and streak sync use your Supabase project.

## Publish using GitHub’s website — no command line

1. Extract **Parayu_GitHub_PWA.zip** on your computer. Open the extracted `parayu-github` folder.
2. Create a GitHub repository, for example `parayu`. Keep its default branch as `main`. GitHub Free supports Pages for public repositories; private Pages requires an eligible plan.
3. In the repository, choose **Add file → Upload files**. Drag the **contents** of `parayu-github` into the upload area, then commit. The repository root should contain `app`, `audio-packs`, `scripts`, `tests`, `content`, `README.md`, and **`.github/workflows/pages.yml`**. Show hidden files if `.github` is not visible. Upload the folders intact, not just their loose files. The package contains fewer than 100 files and every file is below 12 MB.
4. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Open **Actions → Publish Parayu to GitHub Pages → Run workflow → main → Run workflow**. If a run started before step 4 and failed, rerun it now.
6. When the run turns green, the published link appears under **Settings → Pages** and in the deployment job. Open that HTTPS link on your phone.

**Keep the three ZIP files inside `audio-packs` compressed.** The included workflow automatically expands them into the published site. This keeps the upload small and avoids manually uploading 2,290 audio files. Do not upload the outer delivery ZIP as a single repository file; extract it first.

The workflow builds and tests the complete site, then deploys `dist/`. Subsequent pushes to `main` or `master` publish updates automatically. Manifest, audio, assets, and service worker paths support both `username.github.io/` and `username.github.io/repository-name/`.

Official Pages setup: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Enable login and streak sync

1. In Supabase **SQL Editor**, paste and run `supabase/setup.sql`. Supabase Auth owns the accounts and the setup adds one table, `parayu_practice_days`. A unique key records each account and calendar date once. Row-level security allows a signed-in user to read and add their own dates.
2. In Supabase **Authentication → URL Configuration**, add your exact Pages callback to **Redirect URLs**, including the repository path if present. For example, use `https://YOUR-USERNAME.github.io/parayu/?parayu-auth=1`. For a site at the domain root, use `https://YOUR-USERNAME.github.io/?parayu-auth=1`. Keep the **Email** provider enabled. The existing Site URL can serve your other apps if this project is shared.
3. In your GitHub repository, open **Settings → Secrets and variables → Actions → Variables**. Add the following two repository variables. The Pages workflow writes these values into the app during the build.

   | Variable | Value |
   | --- | --- |
   | `PARAYU_SUPABASE_URL` | Your Supabase project URL, such as `https://YOUR-PROJECT.supabase.co` |
   | `PARAYU_SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_…` key in the project’s API keys settings, or its legacy `anon` key |

4. Run **Publish Parayu to GitHub Pages** again. Visit the HTTPS app and use **Log in → Create account**. Verify the email if your project requires it. Use **Forgot password?** to request a recovery link.

Email confirmation and password recovery depend on your Supabase email configuration. Supabase’s default mailer only delivers to project team members. Configure custom SMTP to serve other learners. Existing confirmation and recovery email templates should link to `{{ .ConfirmationURL }}` if you use this redirect flow. [Supabase email setup](https://supabase.com/docs/guides/auth/auth-smtp) · [Redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls)

Finish a lesson, roleplay, or review to mark today as practised. Calendar days follow your device’s local time. You can keep practising offline after signing in, and pending days sync on reconnect. Only streak dates sync. XP, completed lessons, saves, and reviews remain in the browser. To bring your guest streak into an account, sign in and choose **Account → Add practice days from this device**. See your current streak, longest streak, and total practice days on the progress page.

## Install on your phone or computer

- **Android:** open the live link in Chrome, tap **Install & offline → Install Parayu**. If the browser has not offered an install prompt yet, use Chrome’s menu → **Install app / Add to Home screen**.
- **iPhone / iPad:** open the live link in Safari, use **Share → Add to Home Screen**. Enable **Open as Web App** if offered.
- **Desktop:** open the live link in Chrome or Edge and use the install icon in the address bar or **Install & offline → Install Parayu**.

Installation needs the HTTPS published site, or localhost during development. Opening `index.html` directly from your extracted ZIP will not enable service workers or installation. Actual install prompts depend on the browser and whether the app is already installed.

## Download everything before travelling

Open **Install & offline → Download all audio · 27 MB** while online. Wait for **All 2,290 pronunciation clips are ready offline**. Downloads can be paused and resumed; existing clips are reused. Keep the page open until it finishes.

Lessons, the complete word bank, examples, and breakdowns are cached after the first successful online visit. Audio otherwise caches as you play it. The full pack is about 28 MB in decimal units (27 MiB), plus a few MB for text and app files. No live speech request is needed. Device storage can be cleared or reclaimed by the browser; check the saved clip count before relying on it during travel.

The installed app opens in its own window. Microphone recording requires permission, stays on your device, and is discarded on closing practice. The app provides record/replay rather than automated accent scoring.

## Carry over your current Parayu progress

Your new GitHub Pages address has separate browser storage from the previous hosted app. On the old app, open **Your little journey → Export**. On the GitHub version, open the same progress screen and choose **Import**, then confirm the backup. Word IDs and lesson IDs are unchanged, so completed lessons, XP, and saved words/phrases can transfer. Export/import a backup for each device on which you want that progress.

## Editing and updates

Edit HTML, JavaScript, CSS, and the PWA manifest inside `app/`, then commit the changes. The workflow rebuilds the site. A content hash automatically versions the app shell cache; **Update available** appears in Install & offline when a new worker is waiting. Save or finish your current exercise before updating.

`audio-packs/` holds the bundled MP3 source files. Keep their filenames stable unless you also update the audio manifests/index. If replacing existing audio files in a future release, bump the audio cache version in **both** `app/sw.js` and `app/pwa.js` so previously downloaded clips refresh.

The `content/` folder and original vocabulary/pronunciation authoring scripts are provided for reference. Regenerating language content or audio requires their documented external build inputs; ordinary publishing and app edits require none of those inputs. The deployment build never invokes speech generation.

For local development, use Python 3 and Node 22+. If you want to enable login locally, set the same two environment variables before building and allow `http://localhost:8000/?parayu-auth=1` in Supabase:

```sh
npm ci --ignore-scripts
python scripts/build-site.py
python -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`. Run the Node test files in `tests/`, as listed in `.github/workflows/pages.yml`. Python assembles the static site and includes the pinned browser SDK locally.

## Package contents

| Folder / file | Purpose |
| --- | --- |
| `app/` | Editable static app and ready-made language content |
| `audio-packs/` | Three compressed audio bundles; automatically expanded on deploy |
| `scripts/build-site.py` | Assembles the static site and browser SDK in `dist/` |
| `supabase/setup.sql` | Creates the practice-days table and its access rules |
| `.github/workflows/pages.yml` | Builds, tests, and publishes GitHub Pages |
| `tests/` | Lessons, vocabulary, breakdowns, audio and PWA checks |
| `content/` | Authored source content, explanations and attribution |
| `CODE_LICENSE.txt` | MIT license for application code |
| `content/LICENSE.md` | Vocabulary, example and breakdown attribution/licenses |
| `THIRD_PARTY_NOTICES.md` | Speech model and other reference sources |

## Verification and scope

Checks validate all 18 lesson flows, all 1,000 word dialogs, 144 phrase breakdowns, audio checksums/routing, install manifest/icon dimensions, and offline navigation/text/audio at the domain root and two repository subpaths. Account tests cover local and synced streaks, missed days, deduplication, offline reconnection, and switching accounts. The SQL was verified in a local PostgreSQL test database with two distinct users. Live sign-up and email delivery can be tested after your project is configured. Actual home-screen installation on a physical Android or iOS device and publication in your GitHub account must be completed after upload.

This is a speaking-first starter curriculum. Vocabulary is curated and frequency-informed, rather than a definitive spoken-frequency ranking. Explanations use useful meaning units, not forced syllable splits or a complete etymological dictionary. Latin script approximates pronunciation; the included synthesized Malayalam voice and regional speech may differ.
