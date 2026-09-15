# Fontain — 4 × 10s Omni Flash prompts (Qatari Arabic VO)

Story arc: Problem → Website + domain → Google Business Profile + Search Console → Result + CTA.
Same presenter and same office in all four clips so they cut together as one 40s ad.

## CHARACTER BLOCK (paste unchanged into every prompt for consistency)

Qatari man in his early 30s, neatly trimmed short beard, crisp white thobe, white ghutra with black agal, calm confident face, natural skin texture with visible pores, no makeup look, relaxed posture, speaks directly to camera like he is talking to a friend.

## SETTING BLOCK (paste unchanged into every prompt)

Modern minimalist office in Doha, floor-to-ceiling window with soft morning daylight, West Bay skyline softly out of focus in the background, light oak desk with a MacBook and an iPhone, one small plant. Vertical 9:16, 4K, 24 fps, 35mm lens look, shallow depth of field, eye-level, subtle handheld micro-movement, natural color grade, no over-saturation, no film grain overlay.

## AUDIO BLOCK (paste unchanged into every prompt)

Dialogue in Qatari Gulf Arabic dialect, male voice, natural conversational pace, warm and confident, not a TV announcer. Precise lip-sync to the dialogue. Ambient: quiet room tone, faint distant traffic, soft keyboard taps when he uses the laptop. No background music.

## NEGATIVE (paste into every prompt)

No on-screen Arabic text rendered by the model, no subtitles, no logos, no extra fingers, no warped hands, no distorted face when turning, no cartoon look, no stock-footage feel, no jump in identity between shots.

---

## CLIP 1 — THE PROBLEM (0–10s)

**Prompt:**
[CHARACTER BLOCK] [SETTING BLOCK]
0–3s: Medium close-up. He holds his iPhone toward the camera, screen showing a Google search results page with no useful result, and gives a small knowing shrug.
3–7s: He lowers the phone, leans slightly toward the lens, speaks.
7–10s: Slow push-in to a tight close-up on his face as he finishes the question, one eyebrow raised, slight pause at the end.
Dialogue (Qatari Arabic): «زبونك يدوّر عليك في قوقل... وما يلقاك. تدري كم زبون خسرته اليوم بس لأن ما عندك موقع؟»
[AUDIO BLOCK] [NEGATIVE]

**Translation for QA:** "Your customer searches for you on Google… and can't find you. Do you know how many customers you lost today just because you don't have a website?"

---

## CLIP 2 — THE WEBSITE + DOMAIN (10–20s)

**Prompt:**
[CHARACTER BLOCK] [SETTING BLOCK]
0–3s: Medium shot. He turns the MacBook toward the camera; the screen shows a clean modern restaurant-style website scrolling smoothly, mobile and desktop mockups side by side.
3–7s: He taps the browser address bar, camera racks focus from his face to the screen and back, he speaks with a relaxed smile.
7–10s: He picks up the iPhone showing the same website in mobile view with a green WhatsApp button, holds both up briefly, then looks at camera.
Dialogue (Qatari Arabic): «إحنا نسوّي لك موقع احترافي بدومين باسمك، سريع، يشتغل على الجوال، ومربوط بالواتساب مباشرة.»
[AUDIO BLOCK] [NEGATIVE]

**Translation for QA:** "We build you a professional website with a domain in your name, fast, works on mobile, and connected directly to WhatsApp."

---

## CLIP 3 — GOOGLE BUSINESS PROFILE + SEARCH CONSOLE (20–30s)

**Prompt:**
[CHARACTER BLOCK] [SETTING BLOCK]
0–3s: Over-the-shoulder shot of the MacBook. Screen shows a Google Maps business listing with a red pin, star rating and photos; he points at it with one finger.
3–6s: Cut to medium shot facing camera; behind him, out of focus, the laptop screen shows a Google Search Console-style dashboard with a rising performance graph.
6–10s: He counts two points on his fingers as he speaks, then gives a small confident nod on the last word.
Dialogue (Qatari Arabic): «ونسجّل نشاطك في Google Business Profile، ونربطه بـ Search Console، عشان تطلع أول ما يدوّرون عليك.»
[AUDIO BLOCK] [NEGATIVE] Keep the English product names "Google Business Profile" and "Search Console" pronounced in English inside the Arabic sentence.

**Translation for QA:** "And we register your business on Google Business Profile and connect it to Search Console, so you show up the moment they search for you."

---

## CLIP 4 — THE RESULT + CTA (30–40s)

**Prompt:**
[CHARACTER BLOCK] [SETTING BLOCK]
0–3s: Close-up on the iPhone in his hand: a Google search, a business result appears at the top, thumb taps it, the website opens, thumb taps the WhatsApp button, a chat opens. Fast but readable.
3–7s: Cut to medium close-up, he looks up from the phone to the camera with a genuine smile and speaks.
7–10s: He slowly raises the phone toward the lens as an invitation, holds it steady on the last word, gentle push-in, hold for a clean end frame.
Dialogue (Qatari Arabic): «النتيجة؟ زبون يدوّر، يلقاك، ويطلب بضغطة وحدة. راسلنا على الواتساب ونرسل لك تصوّر مجاني.»
[AUDIO BLOCK] [NEGATIVE]

**Translation for QA:** "The result? A customer searches, finds you, and orders with one tap. Message us on WhatsApp and we'll send you a free concept."

---

## PRODUCTION NOTES

1. **Consistency:** generate Clip 1 first, then reuse its first frame (or the same seed) as the reference image for clips 2–4. Identity drift between clips is the most common failure.
2. **Arabic speech:** if the model's Qatari pronunciation is off, generate the video with the same prompt but muted, record or generate the voice separately, and lip-sync it. The dialogue is 18–22 words per clip, which fits 10 seconds at a natural pace.
3. **Arabic on screen:** video models render Arabic letters badly. Keep all Arabic captions, the Fontain logo, and the WhatsApp number as overlays added in editing (CapCut / Premiere), not inside the generation.
4. **Screens:** if the laptop/phone UI comes out blurry or fake, generate the clip with a plain screen and composite a real screen recording of one of your sites over it.
5. **Aspect ratio:** 9:16 for Instagram Reels / TikTok / Snapchat. Re-render at 16:9 only if you need YouTube.
