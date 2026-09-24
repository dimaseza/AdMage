# Task 01: UGC Creator
**Status:** ✅ Done

## Description
Implement the UGC Creator feature that allows users to generate user-generated content style videos.

## Checklist
- [x] Build UGC Creator UI in Dashboard.
- [x] Connect with Kling 3.0 + prompt engine API.
- [x] Test the pipeline for credit deduction.

## Implementation notes

- Reuses the existing shared generator pattern (`GenerationInterface` + `POST /api/generate` +
  `GET /api/generate/[id]`) rather than a new pipeline — consistent with Refine / Product Shot /
  Campaign / Video Ads.
- **Model:** `kling-video/o3/image-reference`, via the existing Higgsfield passthrough. Quality
  tier (`mode: 'std' | 'pro'`) and `sound` are user-selectable — see Pricing and Sound below.

  **Why not the v3.0 image-to-video endpoints (the original implementation):** those take the
  uploaded image as the *literal first frame*. Given a product packshot on a plain background, the
  clip opened on that static packshot and then cut to the UGC scene — it never read as something a
  real person filmed. No prompt can fix this; it's the endpoint's contract. The `image-reference`
  variants instead use the image purely as a subject reference, so the video can open already
  inside a populated scene with the product faithful to the photo.

  Two further wins over v3.0 image-to-video: `aspect_ratio` is actually honoured with an image
  attached (v3.0 infers it from the source frame, so UGC's 9:16 picker was silently ignored
  before), and multiple reference images are supported.

  Contract discovered via `POST /estimate/<slug>`, which validates strictly without queuing —
  see the comment block in `higgsfield-models.ts`. **The image field is `image_urls` (array);
  `image_url` singular is silently ignored on this model**, so reusing the i2v field name would
  have dropped the product reference and produced a prompt-only video.
- **Prompt engine:** `buildUgcPrompt()` in `src/app/api/generate/route.ts` — a template tuned for
  the handheld, unscripted, creator-shot look, distinct from `buildVideoPrompt()`'s polished
  commercial look used by Video Ads.
- **Pricing — deviates from the PRD's flat "15 credits":** the codebase's established convention
  (see `higgsfield-models.ts` pricing comments and `assertPublishedCreditsMatchCost()`) is to never
  charge a flat price for video, because real Kling cost is per-second and a flat rate would
  undersell longer/pricier clips. Cost is per second and depends on two knobs — `mode` (std/pro)
  and `sound` — which each add exactly one 0.3808 HF credit/s step over the 1.1424 base, and stack:

  | | silent | sound |
  |---|---|---|
  | **std** | 7 credits/s (26.6% margin) | 9 (23.8%) |
  | **pro** | 9 credits/s (23.8%) | 12 (28.6%) |

  `assertPublishedCreditsMatchCost()` checks every combination is published and that none sells
  below cost. Defaults are std + sound, i.e. 45 credits for a 5s clip.

- **Sound:** Kling O3 accepts `sound: 'on' | 'off'` and **defaults to off**, which is why early
  clips were silent. The generator exposes an On/Silent toggle defaulting to On (a silent
  talking-head clip is useless for social), and the prompt asks for conversational delivery with
  room tone rather than music or announcer-style voiceover. Verified: output carries an AAC stereo
  44.1kHz track at mean −28.2 dB / peak −3.7 dB.

- **Product fidelity:** O3 is a multi-shot model and will cut to new setups on its own; each cut
  re-derives the product from the reference, which is where the label re-letters and the colour
  drifts. The prompt therefore demands a single unbroken take and an unchanging product. A further
  limit: fine label text only resolves when the product occupies enough pixels — held small or far
  from the lens it renders blank and pops in later — so the prompt also asks for the product to be
  kept close to the camera and large in frame. Pro (1080x1920) holds detail noticeably better than
  std (720x1280).
- **UI:** `src/app/dashboard/ugc/page.tsx`, added to `SidebarNav`. Defaults to a 9:16 vertical
  aspect ratio (TikTok/Reels/Shorts native) instead of Video Ads' 1:1 default. Quality picker shows
  Standard/Pro (drives `mode`, not `resolution` — O3 takes its tier as a body field, not via the
  endpoint), and a separate Sound on/off toggle, both feeding the derived per-second price. The
  upload is labelled "Product Reference" with a note explaining it is not used as the first frame,
  since that behaviour surprised us in testing.
- Gated behind `allowsVideo` plans (Starter and up), same as Video Ads.
- Gallery (`src/app/dashboard/gallery/page.tsx`) updated to render `type: 'ugc'` results as
  `<video>` instead of `<img>`.
