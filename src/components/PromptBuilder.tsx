'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './PromptBuilder.module.css';
import PromptLibrary from './PromptLibrary';
import PromptEditorNotes from './PromptEditorNotes';
import { CheckIcon, CopyIcon, ImageIcon } from './PromptIcons';
import {
  BRIEF_LIMITS,
  DIALOG_LANGUAGES,
  IMAGE_MODES,
  IMAGE_MODE_INFO,
  MAX_VIBES,
  PROMPT_ASPECT_RATIOS,
  VIBES,
  VIDEO_MODES,
  VIDEO_MODE_INFO,
  modeInfoFor,
  type DialogLanguage,
  type ImageMode,
  type ModeInfo,
  type PromptEntryDTO,
  type PromptKind,
  type UsageSnapshot,
  type VideoMode,
} from '@/lib/prompt-builder/config';
import { copyText, resizeToDataUrl } from '@/lib/prompt-builder/client';

type Tab = 'builder' | 'library';

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function messageFor(status: number, data: { error?: string }, fallback: string) {
  if (status === 401) return 'Your session expired. Please sign in again.';
  return data.error || fallback;
}

export default function PromptBuilder() {
  const [tab, setTab] = useState<Tab>('builder');

  // What is being built
  const [kind, setKind] = useState<PromptKind>('image');
  const [imageMode, setImageMode] = useState<ImageMode>('ugc');
  const [videoMode, setVideoMode] = useState<VideoMode>('ugc');

  // Brief (shared by image and video)
  const [product, setProduct] = useState('');
  const [subject, setSubject] = useState('');
  const [scene, setScene] = useState('');
  const [vibes, setVibes] = useState<string[]>([]);
  const [aspect, setAspect] = useState<string>(IMAGE_MODE_INFO.ugc.defaultAspect);
  const [notes, setNotes] = useState('');
  // Once the user picks a ratio themselves, changing mode must not overwrite it.
  const aspectTouched = useRef(false);

  // Brief (video only)
  const [duration, setDuration] = useState<number>(6);
  const [sound, setSound] = useState(true);
  const [dialogLanguage, setDialogLanguage] = useState<DialogLanguage>('Indonesian');
  const [hook, setHook] = useState('');
  const [cta, setCta] = useState('');

  // Product photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoFilled, setPhotoFilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PromptEntryDTO | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [usage, setUsage] = useState<UsageSnapshot | null>(null);

  const isVideo = kind === 'video';
  const mode: string = isVideo ? videoMode : imageMode;
  const modes: readonly string[] = isVideo ? VIDEO_MODES : IMAGE_MODES;
  const infoOf = (m: string): ModeInfo =>
    isVideo ? VIDEO_MODE_INFO[m as VideoMode] : IMAGE_MODE_INFO[m as ImageMode];
  const info = infoOf(mode);
  const videoInfo = VIDEO_MODE_INFO[videoMode];
  const ratios: readonly string[] = isVideo ? videoInfo.aspects : PROMPT_ASPECT_RATIOS;

  const promptsLeft = usage ? Math.max(0, usage.prompts.limit - usage.prompts.used) : null;
  const outOfPrompts = promptsLeft === 0;
  const canSubmit = product.trim().length > 0 && !generating && !analyzing && !outOfPrompts;

  // Today's counters. Purely informational: the server enforces the limits regardless.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/prompt-builder/usage', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success) setUsage(data.usage);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Free the object URL created for the photo thumbnail.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  /** Keep the user's ratio if it is valid here, otherwise fall back to the mode's default. */
  function settleAspect(nextRatios: readonly string[], fallback: string) {
    setAspect((prev) => (aspectTouched.current && nextRatios.includes(prev) ? prev : fallback));
  }

  function selectKind(next: PromptKind) {
    setKind(next);
    const nextMode = next === 'video' ? VIDEO_MODE_INFO[videoMode] : IMAGE_MODE_INFO[imageMode];
    settleAspect(
      next === 'video' ? VIDEO_MODE_INFO[videoMode].aspects : PROMPT_ASPECT_RATIOS,
      nextMode.defaultAspect
    );
  }

  function selectMode(next: string) {
    if (isVideo) {
      const nextInfo = VIDEO_MODE_INFO[next as VideoMode];
      setVideoMode(next as VideoMode);
      settleAspect(nextInfo.aspects, nextInfo.defaultAspect);
      // Each tool renders different lengths; keep the closest one it offers.
      setDuration((d) =>
        nextInfo.durations.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best))
      );
    } else {
      setImageMode(next as ImageMode);
      settleAspect(ratios, infoOf(next).defaultAspect);
    }
  }

  function toggleVibe(vibe: string) {
    setVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : prev.length < MAX_VIBES ? [...prev, vibe] : prev
    );
  }

  /* ---------- Photo ---------- */

  const analyze = useCallback(async (dataUrl: string) => {
    setAnalyzing(true);
    setPhotoError('');
    try {
      const { res, data } = await postJson('/api/prompt-builder/analyze', { image: dataUrl });
      if (data.usage) setUsage(data.usage);
      if (!res.ok || !data.success) {
        throw new Error(messageFor(res.status, data, 'Could not read the photo. Describe the product by typing instead.'));
      }
      // Never clobber what the user already typed: add the description after it.
      setProduct((prev) => {
        const typed = prev.trim();
        return (typed ? `${typed}\n${data.description}` : data.description).slice(0, BRIEF_LIMITS.product);
      });
      setPhotoFilled(true);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not read the photo.');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be picked again after removing it
    if (!file) return;

    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Upload a JPG, PNG or WebP photo.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('That photo is over 15 MB. Try a smaller one.');
      return;
    }

    setPhotoError('');
    setPhotoFilled(false);
    setPhotoPreview(URL.createObjectURL(file));
    try {
      const dataUrl = await resizeToDataUrl(file);
      setPhotoData(dataUrl);
      await analyze(dataUrl);
    } catch {
      setPhotoData(null);
      setPhotoError('Could not open that photo. Try another one.');
    }
  }

  function removePhoto() {
    setPhotoPreview(null);
    setPhotoData(null);
    setPhotoError('');
    setPhotoFilled(false);
  }

  /* ---------- Generate ---------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const shared = { product, subject, scene, vibes, aspectRatio: aspect, notes };
    const brief = isVideo
      ? { ...shared, duration, sound, dialogLanguage, hook, cta }
      : shared;

    setGenerating(true);
    setError('');
    setCopied(false);
    try {
      const { res, data } = await postJson('/api/prompt-builder/generate', { kind, mode, brief });
      if (data.usage) setUsage(data.usage);
      if (!res.ok || !data.success) {
        throw new Error(messageFor(res.status, data, 'Something went wrong. Please try again.'));
      }
      setResult(data.entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    if (await copyText(result.promptText)) {
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  function onTabKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setTab((t) => (t === 'builder' ? 'library' : 'builder'));
    }
  }

  const wordCount = result ? result.promptText.trim().split(/\s+/).length : 0;
  const resultInfo = result ? modeInfoFor(result) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Prompt Builder</h1>
          <p>
            Tell us a few details, in any language, and get a full production-ready English prompt
            for your image or video. Each result says which tool to paste it into.
          </p>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Prompt Builder sections" onKeyDown={onTabKeyDown}>
          {(['builder', 'library'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`pb-tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`pb-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'builder' ? 'Builder' : 'Library'}
            </button>
          ))}
        </div>
      </div>

      <div
        className={styles.builderGrid}
        role="tabpanel"
        id="pb-panel-builder"
        aria-labelledby="pb-tab-builder"
        hidden={tab !== 'builder'}
      >
        <form className={styles.form} onSubmit={handleSubmit}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>I want a prompt for</legend>
            <div className={styles.ratioRow}>
              {(['image', 'video'] as const).map((k) => (
                <label key={k} className={`${styles.ratioBtn} ${kind === k ? styles.ratioBtnActive : ''}`}>
                  <input
                    type="radio"
                    name="pb-kind"
                    className={styles.srOnly}
                    checked={kind === k}
                    onChange={() => selectKind(k)}
                  />
                  {k === 'image' ? 'An image' : 'A video'}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Mode</legend>
            <div className={styles.modeGrid} style={{ '--cols': modes.length } as React.CSSProperties}>
              {modes.map((m) => (
                <label
                  key={m}
                  className={`${styles.modeCard} ${mode === m ? styles.modeCardActive : ''}`}
                >
                  <input
                    type="radio"
                    name={`pb-mode-${kind}`}
                    className={styles.srOnly}
                    checked={mode === m}
                    onChange={() => selectMode(m)}
                  />
                  <span className={styles.modeName}>{infoOf(m).label}</span>
                  <span className={styles.modeBlurb}>{infoOf(m).blurb}</span>
                </label>
              ))}
            </div>
            <p className={styles.hint} style={{ marginTop: '0.5rem' }}>
              Paste the result into <strong>{info.pasteInto}</strong>.
            </p>
          </fieldset>

          <div className={styles.field}>
            <span className={styles.label}>
              <span>
                Product photo <span className={styles.optional}>(optional)</span>
              </span>
            </span>
            <label className={styles.dropzone}>
              <input
                ref={fileInputRef}
                type="file"
                accept={PHOTO_TYPES.join(',')}
                className={styles.srOnly}
                onChange={handlePhoto}
              />
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Your product" className={styles.thumb} />
              ) : (
                <ImageIcon size={28} />
              )}
              <span className={styles.dropzoneText}>
                <strong>{photoPreview ? 'Change photo' : 'Upload a photo'}</strong>
                We&apos;ll read it and fill in the description below. You can edit it.
              </span>
            </label>
            <div className={styles.photoActions} aria-live="polite">
              {analyzing && (
                <span className={styles.inlineStatus}>
                  <span className={styles.spinnerSmall} aria-hidden="true" /> Reading your photo…
                </span>
              )}
              {photoFilled && !analyzing && (
                <span className={styles.hint}>Filled from your photo. Fix anything that looks off.</span>
              )}
              {photoError && <span className={styles.inlineError}>{photoError}</span>}
              {photoData && !analyzing && photoError && (
                <button type="button" className={styles.textBtn} onClick={() => analyze(photoData)}>
                  Try again
                </button>
              )}
              {photoPreview && !analyzing && (
                <button type="button" className={styles.textBtnMuted} onClick={removePhoto}>
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pb-product">
              <span>Product</span>
              <span className={styles.counter}>
                {product.length}/{BRIEF_LIMITS.product}
              </span>
            </label>
            <textarea
              id="pb-product"
              className={styles.textarea}
              value={product}
              maxLength={BRIEF_LIMITS.product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder={info.productPlaceholder}
              required
            />
            <p className={styles.hint}>Name, type, packaging, colors and any text on the label.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pb-subject">
              <span>
                Person / subject <span className={styles.optional}>(optional)</span>
              </span>
            </label>
            <input
              id="pb-subject"
              className={styles.input}
              value={subject}
              maxLength={BRIEF_LIMITS.subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={info.subjectPlaceholder}
            />
            <div>
              <button
                type="button"
                className={styles.textBtn}
                onClick={() => setSubject('No person, product only')}
              >
                Product only, no person
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pb-scene">
              <span>
                Scene / setting <span className={styles.optional}>(optional)</span>
              </span>
            </label>
            <input
              id="pb-scene"
              className={styles.input}
              value={scene}
              maxLength={BRIEF_LIMITS.scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder={info.scenePlaceholder}
            />
          </div>

          {isVideo && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="pb-hook">
                <span>
                  Key message <span className={styles.optional}>(optional)</span>
                </span>
              </label>
              <input
                id="pb-hook"
                className={styles.input}
                value={hook}
                maxLength={BRIEF_LIMITS.hook}
                onChange={(e) => setHook(e.target.value)}
                placeholder={videoInfo.hookPlaceholder}
              />
              <p className={styles.hint}>The one benefit the video should land. Only what you write here is claimed.</p>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>
              <span>
                Vibe <span className={styles.optional}>(pick up to {MAX_VIBES})</span>
              </span>
            </span>
            <div className={styles.chips}>
              {VIBES.map((vibe) => {
                const active = vibes.includes(vibe);
                return (
                  <button
                    key={vibe}
                    type="button"
                    aria-pressed={active}
                    disabled={!active && vibes.length >= MAX_VIBES}
                    className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                    onClick={() => toggleVibe(vibe)}
                  >
                    {vibe}
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Aspect ratio</legend>
            <div className={styles.ratioRow}>
              {ratios.map((ratio) => {
                const [w, h] = ratio.split(':').map(Number);
                return (
                  <label
                    key={ratio}
                    className={`${styles.ratioBtn} ${aspect === ratio ? styles.ratioBtnActive : ''}`}
                  >
                    <input
                      type="radio"
                      name="pb-aspect"
                      className={styles.srOnly}
                      checked={aspect === ratio}
                      onChange={() => {
                        aspectTouched.current = true;
                        setAspect(ratio);
                      }}
                    />
                    <span className={styles.ratioShapeBox} aria-hidden="true">
                      <span className={styles.ratioShape} style={{ aspectRatio: `${w}/${h}` }} />
                    </span>
                    {ratio}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {isVideo && (
            <>
              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Length</legend>
                <div className={styles.ratioRow}>
                  {videoInfo.durations.map((d) => (
                    <label
                      key={d}
                      className={`${styles.ratioBtn} ${duration === d ? styles.ratioBtnActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="pb-duration"
                        className={styles.srOnly}
                        checked={duration === d}
                        onChange={() => setDuration(d)}
                      />
                      {d}s
                    </label>
                  ))}
                </div>
                <p className={styles.hint} style={{ marginTop: '0.5rem' }}>
                  Pick the same length in the video tool so the beats line up.
                </p>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Sound</legend>
                <div className={styles.ratioRow}>
                  {([true, false] as const).map((on) => (
                    <label
                      key={String(on)}
                      className={`${styles.ratioBtn} ${sound === on ? styles.ratioBtnActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="pb-sound"
                        className={styles.srOnly}
                        checked={sound === on}
                        onChange={() => setSound(on)}
                      />
                      {on ? 'Speech on' : 'Silent'}
                    </label>
                  ))}
                </div>
              </fieldset>

              {sound && (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="pb-language">
                    <span>Spoken language</span>
                  </label>
                  <select
                    id="pb-language"
                    className={styles.input}
                    value={dialogLanguage}
                    onChange={(e) => setDialogLanguage(e.target.value as DialogLanguage)}
                  >
                    {DIALOG_LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <p className={styles.hint}>Only the spoken lines use this language. The rest of the prompt stays English.</p>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="pb-cta">
                  <span>
                    Call to action <span className={styles.optional}>(optional)</span>
                  </span>
                </label>
                <input
                  id="pb-cta"
                  className={styles.input}
                  value={cta}
                  maxLength={BRIEF_LIMITS.cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder={videoInfo.ctaPlaceholder}
                />
              </div>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pb-notes">
              <span>
                Anything else <span className={styles.optional}>(optional)</span>
              </span>
            </label>
            <textarea
              id="pb-notes"
              className={styles.textarea}
              style={{ minHeight: 72 }}
              value={notes}
              maxLength={BRIEF_LIMITS.notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isVideo
                  ? 'How the product is used step by step, must-haves, things to avoid…'
                  : 'Must-haves, things to avoid, a reference look…'
              }
            />
          </div>

          <button type="submit" className={`btn-primary ${styles.submit}`} disabled={!canSubmit}>
            {generating
              ? 'Writing your prompt…'
              : analyzing
                ? 'Reading your photo…'
                : outOfPrompts
                  ? 'Daily limit reached'
                  : 'Build my prompt'}
          </button>

          {usage && (
            <div className={styles.usage}>
              <span>
                Prompts today{' '}
                <strong>
                  {usage.prompts.used}/{usage.prompts.limit}
                </strong>
              </span>
              <span>
                Photo reads{' '}
                <strong>
                  {usage.photos.used}/{usage.photos.limit}
                </strong>
              </span>
              <span>Resets daily at midnight WIB</span>
            </div>
          )}

          {error && (
            <p className={styles.alert} role="alert">
              {error}
            </p>
          )}

          {outOfPrompts && usage?.isFree && (
            <Link href="/dashboard/credits" className={styles.upgradeLink}>
              Need more? Paid plans get 15 prompts a day &rarr;
            </Link>
          )}
        </form>

        <div className={styles.resultPanel} aria-live="polite" aria-busy={generating}>
          {generating ? (
            <div className={styles.centered}>
              <div className={styles.spinner} aria-hidden="true" />
              <h3>Writing your prompt</h3>
              <p>
                {isVideo
                  ? 'Scripting the beats, the speech and the camera for your clip.'
                  : 'Expanding your details into a full scene, camera and lighting spec.'}
              </p>
            </div>
          ) : result && resultInfo ? (
            <>
              <div className={styles.resultHead}>
                <div>
                  <h2 className={styles.resultTitle}>{result.title}</h2>
                  <div className={styles.badges}>
                    <span className={styles.badge}>{resultInfo.label}</span>
                    <span className={styles.badgeMuted}>{result.brief.aspectRatio}</span>
                    {result.kind === 'video' && (
                      <span className={styles.badgeMuted}>{result.brief.duration}s</span>
                    )}
                    <span className={styles.badgeMuted}>{wordCount} words</span>
                  </div>
                </div>
              </div>
              <p className={styles.promptText}>{result.promptText}</p>
              <div className={styles.resultActions}>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`btn-primary ${styles.copyBtn} ${copied ? styles.copied : ''}`}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? 'Copied' : 'Copy prompt'}
                </button>
                <span className={styles.meta}>
                  Paste into <strong>{resultInfo.pasteInto}</strong>. Saved to your{' '}
                  <button type="button" className={styles.textBtn} onClick={() => setTab('library')}>
                    Library
                  </button>
                </span>
              </div>
              {result.kind === 'video' && result.editorNotes && (
                <PromptEditorNotes notes={result.editorNotes} />
              )}
            </>
          ) : (
            <div className={styles.centered}>
              <h3>Your prompt appears here</h3>
              <p>
                {isVideo
                  ? 'Add your product, pick a length and sound, and we’ll script the beats and the speech.'
                  : 'Add your product and pick a mode. Everything else is optional, and we’ll fill in the rest.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {tab === 'library' && (
        <div role="tabpanel" id="pb-panel-library" aria-labelledby="pb-tab-library">
          <PromptLibrary onStartBuilding={() => setTab('builder')} />
        </div>
      )}
    </div>
  );
}
