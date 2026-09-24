'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PromptBuilder.module.css';
import PromptEditorNotes from './PromptEditorNotes';
import { CheckIcon, CopyIcon, StarIcon, TrashIcon } from './PromptIcons';
import { modeInfoFor, type PromptEntryDTO, type PromptKind } from '@/lib/prompt-builder/config';
import { copyText } from '@/lib/prompt-builder/client';

type KindFilter = 'all' | PromptKind;

const KIND_FILTERS: readonly { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function LibraryCard({
  entry,
  onFavorite,
  onDelete,
}: {
  entry: PromptEntryDTO;
  onFavorite: (entry: PromptEntryDTO) => void;
  onDelete: (entry: PromptEntryDTO) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    if (await copyText(entry.promptText)) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete(entry);
    // On success the card unmounts; on failure it stays, so hand the controls back.
    setDeleting(false);
    setConfirming(false);
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.cardTitle}>{entry.title}</h3>
          <div className={styles.cardMeta}>
            <span className={styles.badge}>{modeInfoFor(entry).label}</span>
            <span>{entry.brief?.aspectRatio}</span>
            {entry.kind === 'video' && <span>{entry.brief.duration}s</span>}
            <span aria-hidden="true">·</span>
            <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
          </div>
        </div>
      </div>

      <p className={`${styles.cardText} ${expanded ? '' : styles.clamped}`}>{entry.promptText}</p>
      <div>
        <button
          type="button"
          className={styles.textBtn}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Show full prompt'}
        </button>
      </div>
      {expanded && entry.kind === 'video' && entry.editorNotes && (
        <PromptEditorNotes notes={entry.editorNotes} />
      )}

      <div className={styles.cardActions}>
        {confirming ? (
          <div className={styles.confirm} role="group" aria-label="Confirm delete">
            <span>Delete this prompt?</span>
            <button
              type="button"
              className={styles.confirmDelete}
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              className={styles.textBtnMuted}
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleCopy}
              className={`btn-primary ${styles.cardCopy} ${copied ? styles.copied : ''}`}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <span className={styles.spacer} />
            <button
              type="button"
              className={`${styles.iconBtn} ${entry.favorite ? styles.iconBtnFav : ''}`}
              aria-pressed={entry.favorite}
              aria-label={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
              title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => onFavorite(entry)}
            >
              <StarIcon filled={entry.favorite} />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              aria-label="Delete prompt"
              title="Delete prompt"
              onClick={() => setConfirming(true)}
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function PromptLibrary({ onStartBuilding }: { onStartBuilding: () => void }) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [entries, setEntries] = useState<PromptEntryDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // Which filter set `entries` belongs to; "loading" is simply "not loaded for the current filters".
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filterKey = `${kind}|${favoritesOnly}|${debouncedQuery}`;
  const loading = loadedKey !== filterKey;

  const fetchPage = useCallback(
    async (cursor: string | null, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (kind !== 'all') params.set('kind', kind);
      if (favoritesOnly) params.set('favorite', '1');
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/prompt-builder/library?${params}`, { cache: 'no-store', signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(
          res.status === 401 ? 'Your session expired. Please sign in again.' : 'Could not load your library.'
        );
      }
      return data as { entries: PromptEntryDTO[]; nextCursor: string | null };
    },
    [kind, favoritesOnly, debouncedQuery]
  );

  // First page, restarted whenever a filter changes. The abort guards against a
  // slow earlier request landing after a newer one.
  useEffect(() => {
    const controller = new AbortController();
    fetchPage(null, controller.signal)
      .then((page) => {
        setEntries(page.entries);
        setNextCursor(page.nextCursor);
        setError('');
        setLoadedKey(filterKey);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setEntries([]);
        setNextCursor(null);
        setError(err instanceof Error ? err.message : 'Could not load your library.');
        setLoadedKey(filterKey);
      });
    return () => controller.abort();
  }, [fetchPage, filterKey]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextCursor);
      setEntries((prev) => [...prev, ...page.entries.filter((e) => !prev.some((p) => p.id === e.id))]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleFavorite(entry: PromptEntryDTO) {
    const next = !entry.favorite;
    // Optimistic: flip now, put it back if the server says no.
    setEntries((prev) =>
      favoritesOnly && !next
        ? prev.filter((e) => e.id !== entry.id)
        : prev.map((e) => (e.id === entry.id ? { ...e, favorite: next } : e))
    );
    try {
      const res = await fetch(`/api/prompt-builder/library/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('Could not update the favorite. Please try again.');
      setEntries((prev) =>
        prev.some((e) => e.id === entry.id)
          ? prev.map((e) => (e.id === entry.id ? { ...e, favorite: entry.favorite } : e))
          : [entry, ...prev].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    }
  }

  async function handleDelete(entry: PromptEntryDTO) {
    try {
      const res = await fetch(`/api/prompt-builder/library/${entry.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error();
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch {
      setError('Could not delete that prompt. Please try again.');
    }
  }

  const filtering = kind !== 'all' || favoritesOnly || debouncedQuery !== '';

  return (
    <div>
      <div className={styles.libToolbar}>
        <input
          type="search"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your prompts…"
          aria-label="Search your prompts"
        />
        <div className={styles.filterRow} role="group" aria-label="Filter prompts">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={kind === f.value}
              className={`${styles.chip} ${kind === f.value ? styles.chipActive : ''}`}
              onClick={() => setKind(f.value)}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={favoritesOnly}
            className={`${styles.chip} ${favoritesOnly ? styles.chipActive : ''}`}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            Favorites
          </button>
        </div>
      </div>

      {error && (
        <p className={styles.alert} role="alert" style={{ marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className={styles.centered} style={{ padding: '3rem 0' }} aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <p>Loading your prompts…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className={`${styles.centered} ${styles.emptyLib}`}>
          {filtering ? (
            <>
              <h3>No prompts match</h3>
              <p>Try a different search or clear the filters.</p>
            </>
          ) : (
            <>
              <h3>No saved prompts yet</h3>
              <p>Every prompt you build is saved here so you can copy it again later.</p>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: '0.75rem', font: 'inherit', fontWeight: 600 }}
                onClick={onStartBuilding}
              >
                Build your first prompt
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {entries.map((entry) => (
              <LibraryCard
                key={entry.id}
                entry={entry}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
              />
            ))}
          </div>
          {nextCursor && (
            <button type="button" className={styles.loadMore} disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
