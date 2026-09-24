'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './PromptBuilder.module.css';
import { CheckIcon, CopyIcon } from './PromptIcons';
import { copyText } from '@/lib/prompt-builder/client';
import type { EditorNotes } from '@/lib/prompt-builder/config';

function NoteRow({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    if (await copyText(text)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className={styles.noteRow}>
      <div className={styles.noteBody}>
        <span className={styles.noteLabel}>{label}</span>
        <span className={styles.noteText}>{text}</span>
      </div>
      <button
        type="button"
        className={`${styles.iconBtn} ${copied ? styles.iconBtnOk : ''}`}
        aria-label={`Copy ${label.toLowerCase()}`}
        title={`Copy ${label.toLowerCase()}`}
        onClick={handleCopy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

/**
 * Overlay text and captions that go with a video prompt. Video models draw text
 * badly, so the prompt never asks for it; the seller adds it in their editor.
 */
export default function PromptEditorNotes({ notes }: { notes: EditorNotes }) {
  const rows = [
    ['Headline', notes.headline],
    ['Tagline', notes.tagline],
    ['Call to action', notes.callToAction],
    ['Subtitles', notes.subtitles],
  ].filter(([, text]) => text);

  if (rows.length === 0) return null;

  return (
    <section className={styles.notes} aria-label="Text for your video editor">
      <h3 className={styles.notesTitle}>For your video editor</h3>
      <p className={styles.hint}>
        Video tools draw text badly, so add these in CapCut or your editor instead.
      </p>
      {rows.map(([label, text]) => (
        <NoteRow key={label} label={label} text={text} />
      ))}
    </section>
  );
}
