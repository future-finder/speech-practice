# Workspace asset inventory

All runtime images are local. No private reference screenshots are bundled.
Development records are not part of the source distribution.

| File | Use |
| --- | --- |
| public/assets/backgrounds/folded-light.png | Optional window wallpaper |
| public/assets/convergence/entry-script.png | Script entry illustration |
| public/assets/convergence/entry-record.png | Recording entry illustration |
| public/assets/convergence/entry-collection.png | Collection entry illustration |
| public/assets/convergence/cover-small-actions.png | Small Actions cover |
| public/assets/convergence/cover-challenges.png | Challenges cover |
| public/assets/convergence/cover-health.png | Health cover |
| public/assets/convergence/cover-interview.png | Interview cover |
| public/assets/convergence/cover-focus.png | Focus cover |
| public/assets/convergence/cover-future.png | Future of Work cover |
| public/assets/convergence/home-hero.png | Home header artwork |
| public/images/practice-botanical.png | Optional botanical decoration |
| public/images/decor/*.svg | Optional local appearance decorations |
| public/images/practice-mountains.jpg | Image-upload test fixture; attribution in THIRD_PARTY_NOTICES.md |
| public/notices/fonts/* | Font copyright and OFL notices |

Speech covers currently use title-based theme selection. Per-speech uploaded
cover persistence is not implemented; different titles can select the same image.
The Home header image is separate from speech covers.

Icons use Lucide. Functional waveforms use actual decoded audio or the live
microphone stream; missing audio displays a neutral baseline. Scores and feedback
retain their data-source semantics and are not encoded in artwork.

Third-party font, icon and photograph licenses remain separate from the application
license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
