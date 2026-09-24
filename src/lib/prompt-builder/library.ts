import type { PromptEntry } from '@prisma/client';
import {
  isImageMode,
  isVideoMode,
  type EditorNotes,
  type ImageBrief,
  type PromptEntryDTO,
  type VideoBrief,
} from './config';
import { obj, str } from './shared';

/** Overlay text and captions saved with a video prompt, for the user's editor. */
function editorNotesFrom(promptJson: unknown): EditorNotes | null {
  const json = obj(promptJson);
  const overlay = obj(json.on_screen_text);
  const notes = {
    headline: str(overlay.headline, 120),
    tagline: str(overlay.tagline, 160),
    callToAction: str(overlay.call_to_action, 160),
    subtitles: str(json.subtitles, 900),
  };
  return Object.values(notes).some(Boolean) ? notes : null;
}

/** Maps a database row to what the browser is allowed to see (no raw JSON spec). */
export function toEntryDTO(row: PromptEntry): PromptEntryDTO {
  const base = {
    id: row.id,
    title: row.title,
    promptText: row.promptText,
    favorite: row.favorite,
    createdAt: row.createdAt.toISOString(),
  };

  if (row.kind === 'video' && isVideoMode(row.mode)) {
    return {
      ...base,
      kind: 'video',
      mode: row.mode,
      brief: row.brief as unknown as VideoBrief,
      editorNotes: editorNotesFrom(row.promptJson),
    };
  }

  return {
    ...base,
    kind: 'image',
    mode: isImageMode(row.mode) ? row.mode : 'ugc',
    brief: row.brief as unknown as ImageBrief,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids are `@db.Uuid`; a malformed one would make Prisma throw instead of finding nothing. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
