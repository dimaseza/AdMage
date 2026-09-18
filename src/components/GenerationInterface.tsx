'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './GenerationInterface.module.css';
import { refreshCredits } from './CreditBalance';
// Client-safe pricing only. Importing '@/lib/higgsfield-models' here would ship
// the Higgsfield model slugs and wholesale cost table to the browser.
import {
  IMAGE_OPTIONS,
  FEATURE_IMAGE_MODEL,
  VIDEO_RESOLUTIONS,
  VIDEO_TIER_LABELS,
  VIDEO_DURATIONS,
  resolveVideoTier,
  videoCreditsPerSecond,
  imageCreditsFor,
  type ImageFeature,
} from '@/lib/credit-costs';

interface GenerationInterfaceProps {
  title: string;
  description: string;
  type: 'refine' | 'product-shot' | 'campaign' | 'video';
  requiresImage: boolean;
}

/**
 * What each feature's backing Higgsfield model actually accepts.
 * Kept in sync with src/lib/higgsfield-models.ts - offering a value the model
 * rejects (e.g. `high` quality on Grok, `4k` on a video model) is a hard 400.
 */
/**
 * Options each feature can offer. Quality/resolution come straight from the
 * shared model registry so the UI can never present a value the API rejects.
 * Aspect ratios are a curated subset of what the models accept.
 */
const UI_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'];

const FEATURE_CAPS = {
  refine: {
    qualities: IMAGE_OPTIONS[FEATURE_IMAGE_MODEL.refine].qualities,
    resolutions: IMAGE_OPTIONS[FEATURE_IMAGE_MODEL.refine].resolutions,
    aspectRatios: UI_ASPECT_RATIOS,
    supportsStyleRef: true,
  },
  'product-shot': {
    qualities: IMAGE_OPTIONS[FEATURE_IMAGE_MODEL['product-shot']].qualities,
    resolutions: IMAGE_OPTIONS[FEATURE_IMAGE_MODEL['product-shot']].resolutions,
    aspectRatios: UI_ASPECT_RATIOS,
    supportsStyleRef: true,
  },
  campaign: {
    qualities: IMAGE_OPTIONS[FEATURE_IMAGE_MODEL.campaign].qualities,
    resolutions: IMAGE_OPTIONS[FEATURE_IMAGE_MODEL.campaign].resolutions,
    aspectRatios: UI_ASPECT_RATIOS,
    supportsStyleRef: true,
  },
  video: {
    qualities: [] as readonly string[],
    // Kling 3.0 encodes quality in the endpoint, so this picks the model variant.
    resolutions: VIDEO_RESOLUTIONS as readonly string[],
    // Only Kling text-to-video validates aspect ratio; with a source image it is inferred.
    aspectRatios: ['16:9', '1:1', '9:16'],
    supportsStyleRef: false,
  },
} as const;


export default function GenerationInterface({ title, description, type, requiresImage }: GenerationInterfaceProps) {
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [stylePreview, setStylePreview] = useState<string | null>(null);
  
  const caps = FEATURE_CAPS[type];

  // Advanced Settings
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [variations, setVariations] = useState(1);
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState<string>(
    type === 'video' ? '1080p' : caps.resolutions[0]
  );
  const [quality, setQuality] = useState<string>(caps.qualities[caps.qualities.length - 1] ?? 'medium');

  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleFileInputRef = useRef<HTMLInputElement>(null);

  const getBaseCost = () => {
    if (type === 'video') return videoCreditsPerSecond(resolution) * duration;
    return imageCreditsFor(type as ImageFeature, quality, resolution);
  };
  const totalCost = getBaseCost() * variations;
  const videoTierLabel = type === 'video' ? VIDEO_TIER_LABELS[resolveVideoTier(resolution)] : null;

  useEffect(() => {
    if (!generationId || !isGenerating) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/${generationId}`);
        const data = await res.json();
        
        if (data.status === 'COMPLETED') {
          setResultUrls(data.resultUrls || [data.resultUrl]);
          setIsGenerating(false);
          setStatus('Completed!');
          clearInterval(interval);
        } else if (data.status === 'FAILED') {
          setIsGenerating(false);
          setStatus(data.error || 'Generation failed. Please try again.');
          clearInterval(interval);
          // A failed generation refunds its reservation.
          refreshCredits();
        } else {
          setStatus(`Status: ${data.status}...`);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [generationId, isGenerating]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleStyleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setStyleFile(selectedFile);
      setStylePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresImage && !file) {
      alert('Please upload a Product Image.');
      return;
    }
    if (!requiresImage && !prompt && !file) {
      alert('Please enter a prompt or upload an image.');
      return;
    }

    setIsGenerating(true);
    setStatus('Preparing...');
    setResultUrls([]);

    let uploadedImageUrl = undefined;
    let uploadedStyleImageUrl = undefined;

    try {
      if (file) {
        setStatus('Uploading product image...');
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-prod-${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(fileName, file, { contentType: file.type, upsert: false });
          
        if (error) throw new Error("Failed to upload product image.");
        
        const { data: signedData, error: signedError } = await supabase.storage
          .from('uploads')
          .createSignedUrl(fileName, 3600);
          
        if (signedError || !signedData) throw new Error("Failed to generate accessible URL for product image.");
        uploadedImageUrl = signedData.signedUrl;
      }

      if (styleFile) {
        setStatus('Uploading style image...');
        const ext = styleFile.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-style-${Math.random().toString(36).substring(7)}.${ext}`;
        
        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(fileName, styleFile, { contentType: styleFile.type, upsert: false });
          
        if (error) throw new Error("Failed to upload style image.");
        
        const { data: signedData, error: signedError } = await supabase.storage
          .from('uploads')
          .createSignedUrl(fileName, 3600);
          
        if (signedError || !signedData) throw new Error("Failed to generate accessible URL for style image.");
        uploadedStyleImageUrl = signedData.signedUrl;
      }

      setStatus('Starting AI engine...');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error("Could not load user session");

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          userId: session.user.id,
          payload: {
            prompt,
            imageUrl: uploadedImageUrl,
            styleImageUrl: uploadedStyleImageUrl,
            aspectRatio,
            variations,
            quality,
            resolution,
            duration: type === 'video' ? duration : undefined
          }
        })
      });

      const data = await res.json();
      if (!data.success) {
        if (data.upgradeRequired) setNeedsUpgrade(true);
        throw new Error(data.error);
      }

      setGenerationId(data.generationId);
      setStatus('Generation running...');
      // Credits are reserved at submit time, so the sidebar is already stale.
      refreshCredits();

    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
      setIsGenerating(false);
    }
  };

  const aspectRatios: readonly string[] = caps.aspectRatios;

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <div className={styles.header}>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '1rem' }}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label>
                  {type === 'video' ? 'Source Image' : 'Product Image'}{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {requiresImage ? '(Required)' : '(Optional)'}
                  </span>
                </label>
                <div className={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className={styles.fileInput}
                  />
                  {!preview ? (
                    <p>Upload Product</p>
                  ) : (
                    <img src={preview} alt="Product" className={styles.previewImage} />
                  )}
                </div>
              </div>

              {caps.supportsStyleRef && (
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label>Style Reference <span style={{ color: 'var(--text-secondary)' }}>(Optional)</span></label>
                <div className={styles.uploadBox} onClick={() => styleFileInputRef.current?.click()}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={styleFileInputRef} 
                    onChange={handleStyleFileChange} 
                    className={styles.fileInput}
                  />
                  {!stylePreview ? (
                    <p>Upload Style</p>
                  ) : (
                    <img src={stylePreview} alt="Style" className={styles.previewImage} />
                  )}
                </div>
              </div>
              )}
            </div>
          
          <div className={styles.formGroup}>
            <label>Prompt</label>
            <textarea 
              className={styles.textarea} 
              value={prompt} 
              onChange={e => setPrompt(e.target.value)} 
              placeholder="Describe your creative vision in detail..."
            />
          </div>

          {aspectRatios.length > 0 && (
          <div className={styles.formGroup}>
            <label>Aspect Ratio</label>
            <div className={styles.segmentedControl}>
              {aspectRatios.map(ratio => {
                const [w, h] = ratio.split(':').map(Number);
                return (
                  <button 
                    type="button" 
                    key={ratio} 
                    className={`${styles.segmentBtn} ${aspectRatio === ratio ? styles.active : ''}`}
                    onClick={() => setAspectRatio(ratio)}
                  >
                    <div className={styles.arShapeWrapper}>
                      <div className={styles.arShape} style={{ aspectRatio: `${w}/${h}` }} />
                    </div>
                    <span>{ratio}</span>
                  </button>
                )
              })}
            </div>
          </div>
          )}

          <div className={styles.settingRow}>
            <div className={styles.formGroup}>
              <label>Variations (Max 4)</label>
              <div className={styles.segmentedControl}>
                {[1, 2, 3, 4].map(num => (
                  <button 
                    type="button" 
                    key={num} 
                    className={`${styles.segmentBtn} ${variations === num ? styles.active : ''}`}
                    onClick={() => setVariations(num)}
                  >
                    x{num}
                  </button>
                ))}
              </div>
            </div>

            {caps.qualities.length > 0 && (
            <div className={styles.formGroup}>
              <label>Quality</label>
              <div className={styles.segmentedControl}>
                {caps.qualities.map(q => (
                  <button 
                    type="button" 
                    key={q} 
                    className={`${styles.segmentBtn} ${quality === q ? styles.active : ''}`}
                    onClick={() => setQuality(q)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                      <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13"/><path d="M13 3l3 6-4 13"/>
                    </svg>
                    {q}
                  </button>
                ))}
              </div>
            </div>
            )}

            <div className={styles.formGroup}>
              <label>{videoTierLabel ? `Quality - ${videoTierLabel}` : 'Resolution'}</label>
              <div className={styles.segmentedControl}>
                {caps.resolutions.map(res => (
                  <button 
                    type="button" 
                    key={res} 
                    className={`${styles.segmentBtn} ${resolution === res ? styles.active : ''}`}
                    onClick={() => setResolution(res)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                      <path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13"/><path d="M13 3l3 6-4 13"/>
                    </svg>
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {type === 'video' && (
              <div className={styles.formGroup}>
                <label>Duration</label>
                <select 
                  className={styles.select} 
                  value={duration} 
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {VIDEO_DURATIONS.map(d => (
                    <option key={d} value={d}>{d} Seconds</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <button style={{ marginTop: '0.5rem' }} type="submit" className="btn-primary" disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Content'}
          </button>
          
          <div className={styles.smallCostText}>
            Generating will use <span>{totalCost} credits</span>
          </div>
          
          {status && <div className={styles.status}>{status}</div>}

          {needsUpgrade && (
            <a href="/dashboard/credits" className={styles.upgradeNotice}>
              Video ads need a paid plan &mdash; see plans &rarr;
            </a>
          )}
        </form>
      </div>
      
      <div className={styles.rightPanel}>
        {isGenerating ? (
          <>
            <div className={styles.loadingSpinner}></div>
            <p style={{ color: 'var(--text-secondary)' }}>AI is rendering your content...</p>
          </>
        ) : resultUrls.length > 0 ? (
          <div className={styles.resultsGrid}>
            {resultUrls.map((url, i) => (
              type === 'video' ? (
                <video key={i} src={url} controls autoPlay loop className={styles.resultMedia} />
              ) : (
                <img key={i} src={url} alt={`Result ${i+1}`} className={styles.resultMedia} />
              )
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>Ready to Generate</h3>
            <p>Your results will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
