const HIGGSFIELD_API_URL = process.env.HIGGSFIELD_API_URL || 'https://api.higgsfield.ai';
const API_KEY = process.env.HIGGSFIELD_API_KEY;

export interface HiggsfieldGenerationRequest {
  /** Model slug, used as the URL path (not sent in the body). */
  model: string;
  prompt: string;
  /**
   * Reference images for image models. This is the ONLY field Higgsfield reads;
   * unknown fields are accepted with a 200 and then ignored, which silently
   * produces a prompt-only generation.
   */
  image_urls?: string[];
  /** Single source image for image-to-video models. */
  image_url?: string;
  aspect_ratio?: string;
  quality?: string;
  resolution?: string;
  num_images?: number;
  duration?: number;
  negative_prompt?: string;
  seed?: number;
}

export async function startGeneration(payload: HiggsfieldGenerationRequest): Promise<string> {
  if (!API_KEY) {
    console.warn('No HIGGSFIELD_API_KEY set. Returning mock request_id.');
    return `mock_req_${Math.random().toString(36).substring(7)}`;
  }

  const { model, ...body } = payload;

  // Drop undefined/empty so we never trip a format validator with a null URL.
  const requestBody = Object.fromEntries(
    Object.entries(body).filter(([, v]) =>
      v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)
    )
  );

  const response = await fetch(`${HIGGSFIELD_API_URL}/${model}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Higgsfield expects `Key <api_key_id>:<api_key_secret>`.
      'Authorization': `Key ${API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Higgsfield] request failed', {
      model,
      status: response.status,
      error: errorText,
      body: requestBody,
    });
    throw new Error(`Higgsfield API Error (${model}): ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.request_id;
}

export interface GenerationStatus {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw' | 'canceled';
  output_url?: string;
  output_urls?: string[];
  error?: string;
}

export async function checkStatus(requestId: string): Promise<GenerationStatus> {
  if (requestId.startsWith('mock_req_')) {
    return Math.random() > 0.5
      ? { status: 'completed', output_urls: ['/mock-output.jpg'] }
      : { status: 'in_progress' };
  }

  const response = await fetch(`${HIGGSFIELD_API_URL}/requests/${requestId}/status`, {
    headers: { 'Authorization': `Key ${API_KEY}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Higgsfield Status Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Images come back as `images: [{url}]`; video as a single `video: {url}`.
  const outputUrls: string[] = [
    ...(Array.isArray(data.images) ? data.images : []),
    ...(Array.isArray(data.videos) ? data.videos : []),
    ...(data.video ? [data.video] : []),
  ]
    .map((m: any) => m?.url)
    .filter(Boolean);

  return {
    status: data.status,
    output_url: outputUrls[0],
    output_urls: outputUrls,
    error: data.error ?? undefined,
  };
}

/** Terminal states that will never produce output. `nsfw` and `canceled` are easy to miss. */
export function isTerminalFailure(status: GenerationStatus['status']): boolean {
  return status === 'failed' || status === 'nsfw' || status === 'canceled';
}
