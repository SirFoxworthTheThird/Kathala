import Anthropic from '@anthropic-ai/sdk'

/*
  The AI audit, run from the app with the writer's own API key (next-plan.md,
  Part F3; decision D-2): one click for a chapter's audit, where the paste
  route is several. Paste-only stays. Nothing leaves the device unless a key
  is entered — then the prompt goes to Anthropic's API, from this browser, and
  to nowhere else; there is no server of ours in between.
*/

/** The model the audit runs on. */
export const AUDIT_MODEL = 'claude-opus-5-5'

/** Why an audit did not come back with a reply, said for the writer. */
export class AuditRunError extends Error {}

/**
 * The assistant's reply to `prompt`: the text `parseAuditReply` reads. Streamed,
 * since a book so far is a long input and the reply can take minutes.
 * `fetch` is for tests.
 */
export async function runAudit(prompt: string, apiKey: string, options: { signal?: AbortSignal; fetch?: typeof fetch } = {}): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, ...(options.fetch ? { fetch: options.fetch } : {}) })
  try {
    const stream = client.beta.messages.stream({
      model: AUDIT_MODEL,
      max_tokens: 64000,
      thinking: { type: 'adaptive' },
      // The arithmetic of ages and dates across a book is the work: not the lowest effort.
      output_config: { effort: 'high' },
      // A request the model declines is answered by another, rather than coming back empty.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    }, { signal: options.signal })
    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') throw new AuditRunError('The assistant declined to audit this. The prompt can still be copied and pasted into another.')
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    if (message.stop_reason === 'max_tokens') throw new AuditRunError('The reply was cut off before it finished. Try a chapter at a time.')
    return text
  } catch (e) {
    if (e instanceof AuditRunError) throw e
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AuditRunError('The key was not accepted. Check it, or copy the prompt instead.')
    if (e instanceof Anthropic.RateLimitError) throw new AuditRunError('Too many requests just now. Try again in a minute.')
    if (e instanceof Anthropic.APIUserAbortError) throw new AuditRunError('Stopped.')
    if (e instanceof Anthropic.APIConnectionError) throw new AuditRunError('Could not reach the API. Check the connection, or copy the prompt instead.')
    if (e instanceof Anthropic.APIError) throw new AuditRunError(`The API said: ${e.message}`)
    throw e
  }
}

/*
  The key, remembered on this device only if the writer asks: in the
  browser's own storage, never in the book or its backups.
*/
const KEY = 'kathala-anthropic-key'

export function rememberedKey(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

export function rememberKey(apiKey: string | null) {
  try {
    if (apiKey) localStorage.setItem(KEY, apiKey)
    else localStorage.removeItem(KEY)
  } catch { /* not remembered: it is asked for again */ }
}
