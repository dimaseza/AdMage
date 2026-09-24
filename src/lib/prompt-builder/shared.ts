/**
 * Helpers shared by the image and video prompt builders: cleaning user input
 * and coercing whatever the model returns into a known shape.
 */

import { MAX_VIBES, VIBES } from './config';

/** Collapses whitespace and clips to `max`; anything that is not a string becomes "". */
export function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** Same as {@link cleanText}, with a default cap suited to a single template field. */
export const str = (v: unknown, max = 700): string => cleanText(v, max);

export const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Keeps only known vibe labels, capped at MAX_VIBES. */
export function parseVibes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is (typeof VIBES)[number] => (VIBES as readonly unknown[]).includes(v))
    .slice(0, MAX_VIBES);
}

/** Pulls the JSON object out of a reply that may be wrapped in code fences or chatter. */
export function extractJson(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(content.slice(start, end + 1));
}

/** The model's reply could not be turned into a usable spec (worth one retry). */
export class PromptParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptParseError';
  }
}
