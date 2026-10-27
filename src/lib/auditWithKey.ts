import Anthropic from '@anthropic-ai/sdk'

/*
  The AI audit, run from the app with the writer's own API key (next-plan.md,
  Part F3; decision D-2): one click for a chapter's audit, where the paste
  route is several. Paste-only stays. Nothing leaves the device unless a key
  is entered — then the prompt goes to the provider the writer chose, from
  this browser, and to nowhere else; there is no server of ours in between.

  Four providers, each through its own official library: Anthropic's for
  Claude, OpenAI's for ChatGPT — and for DeepSeek, whose API is OpenAI's shape
  at DeepSeek's address — and Google's for Gemini. The libraries other than
  Anthropic's are loaded only when a run or a list of models asks for one.
*/

/** Where Claude's key and the prompt go, and nowhere else. */
export const API_URL = 'https://api.anthropic.com'

/** The model Claude's audit runs on. */
export const AUDIT_MODEL = 'claude-opus-5-5'

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'deepseek'

/**
 * Each provider: what the writer calls it, where its key goes (pinned: no
 * setting can point a key elsewhere), and how a key of its looks. Claude's
 * model is fixed; the others' are listed from the provider, since which of
 * theirs are current is theirs to say.
 */
export const PROVIDERS: Record<ProviderId, { name: string; company: string; url: string; keyHint: string; model?: string }> = {
  anthropic: { name: 'Claude (Anthropic)', company: 'Anthropic', url: API_URL, keyHint: 'sk-ant-…', model: AUDIT_MODEL },
  openai: { name: 'ChatGPT (OpenAI)', company: 'OpenAI', url: 'https://api.openai.com/v1', keyHint: 'sk-…' },
  gemini: { name: 'Gemini (Google)', company: 'Google', url: 'https://generativelanguage.googleapis.com', keyHint: 'AIza…' },
  deepseek: { name: 'DeepSeek', company: 'DeepSeek', url: 'https://api.deepseek.com', keyHint: 'sk-…' },
}
export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

/** Why an audit did not come back with a reply, said for the writer. */
export class AuditRunError extends Error {}

/**
 * The assistant's reply to `prompt`: the text `parseAuditReply` reads. Streamed,
 * since a book so far is a long input and the reply can take minutes.
 * `fetch` is for tests.
 */
export async function runAudit(prompt: string, apiKey: string, options: { signal?: AbortSignal; fetch?: typeof fetch } = {}): Promise<string> {
  /*
    The address pinned, rather than left to the SDK's environment lookup: the
    key goes to Anthropic's API and to nothing a setting could point it at.
    Two retries at most, on the SDK's own rules (never on a refused key).
  */
  const client = new Anthropic({ apiKey, baseURL: API_URL, maxRetries: 2, dangerouslyAllowBrowser: true, ...(options.fetch ? { fetch: options.fetch } : {}) })
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
  Where the key is kept between audits, if the writer asks (it is otherwise
  held only while the audit is open):

  - **The desktop app** keeps it encrypted by the operating system's keychain,
    in the main process (`electron/secrets.cjs`), reached through a bridge that
    knows this one secret. The page never stores it. Where the system offers no
    real encryption, it is not kept.
  - **A browser** keeps it until the tab is closed (`sessionStorage`), and no
    longer: a page's storage is readable by anything running in the page and
    by anyone with a copy of the browser profile, and there is nothing in a
    browser to encrypt it with that the page could not also use to decrypt it.
    Never in `localStorage`, which would outlive the tab.
*/
interface KeyBridge {
  available: () => Promise<boolean>
  get: (provider: ProviderId) => Promise<string>
  set: (provider: ProviderId, value: string) => Promise<boolean>
  clear: (provider: ProviderId) => Promise<boolean>
}

const bridge = (): KeyBridge | undefined =>
  (window as unknown as { electronAPI?: { aiKeys?: KeyBridge } }).electronAPI?.aiKeys

const tabKey = (provider: ProviderId) => `kathala-ai-key:${provider}`

/** Where a kept key would be: the system keychain, this tab, or nowhere (a desktop with no keychain). */
export type KeyPlace = 'keychain' | 'tab' | 'none'

export async function keyPlace(): Promise<KeyPlace> {
  const b = bridge()
  if (!b) return 'tab'
  return (await b.available()) ? 'keychain' : 'none'
}

/** The provider's key kept from before, or empty. */
export async function keptKey(provider: ProviderId): Promise<string> {
  const b = bridge()
  if (b) return (await b.get(provider)) ?? ''
  try { return sessionStorage.getItem(tabKey(provider)) ?? '' } catch { return '' }
}

/** Keep the provider's key, where `keyPlace` says; false where it cannot be kept. */
export async function keepKey(provider: ProviderId, apiKey: string): Promise<boolean> {
  const b = bridge()
  if (b) return b.set(provider, apiKey)
  try { sessionStorage.setItem(tabKey(provider), apiKey); return true } catch { return false }
}

/** Forget the provider's kept key, wherever it was kept. */
export async function forgetKey(provider: ProviderId): Promise<void> {
  const b = bridge()
  if (b) await b.clear(provider)
  try { sessionStorage.removeItem(tabKey(provider)) } catch { /* nothing kept */ }
}

/*
  The provider and model last chosen, so the next audit starts there. Not
  secrets — a name and a model — so they are remembered as any setting is.
*/
const CHOICE = 'kathala-ai-choice'

export function lastChoice(): { provider: ProviderId; models: Partial<Record<ProviderId, string>> } {
  try {
    const raw = JSON.parse(localStorage.getItem(CHOICE) ?? '{}') as { provider?: string; models?: Partial<Record<ProviderId, string>> }
    return { provider: PROVIDER_IDS.includes(raw.provider as ProviderId) ? raw.provider as ProviderId : 'anthropic', models: raw.models ?? {} }
  } catch {
    return { provider: 'anthropic', models: {} }
  }
}

export function rememberChoice(provider: ProviderId, model: string | undefined) {
  const was = lastChoice()
  try { localStorage.setItem(CHOICE, JSON.stringify({ provider, models: { ...was.models, ...(model ? { [provider]: model } : {}) } })) } catch { /* starts at Claude next time */ }
}

type Options = { signal?: AbortSignal; fetch?: typeof fetch }

/** What a provider's library threw, said for the writer. */
function said(e: unknown, status: number | undefined): AuditRunError | null {
  if (e instanceof AuditRunError) return e
  if (e instanceof Error && e.name === 'AbortError') return new AuditRunError('Stopped.')
  // Gemini answers a bad key with a 400 that says so, not a 401.
  if (status === 401 || status === 403 || (status === 400 && e instanceof Error && /api[ _-]?key/i.test(e.message))) return new AuditRunError('The key was not accepted. Check it, or copy the prompt instead.')
  if (status === 429) return new AuditRunError('Too many requests just now, or the key has no credit left. Try again later.')
  return null
}

/**
 * The provider's models that can write an audit, for the writer to choose
 * from: chat models only — not embeddings, speech or pictures.
 */
export async function listModels(provider: ProviderId, apiKey: string, options: Options = {}): Promise<string[]> {
  const p = PROVIDERS[provider]
  if (p.model) return [p.model]
  try {
    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: p.url, ...(options.fetch ? { fetch: options.fetch } : {}) } })
      const out: string[] = []
      for await (const m of await ai.models.list()) {
        if (m.name && (m.supportedActions ?? []).includes('generateContent')) out.push(m.name.replace(/^models\//, ''))
      }
      return out.sort()
    }
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey, baseURL: p.url, maxRetries: 2, dangerouslyAllowBrowser: true, ...(options.fetch ? { fetch: options.fetch } : {}) })
    const out: string[] = []
    for await (const m of client.models.list()) out.push(m.id)
    const chat = provider === 'openai'
      ? out.filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct|moderation)/.test(id))
      : out
    return chat.sort()
  } catch (e) {
    const status = (e as { status?: number }).status
    throw said(e, status) ?? new AuditRunError(`Could not list ${p.name}'s models: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** The audit's reply from the provider and model chosen: the text `parseAuditReply` reads. */
export async function runAuditWith(provider: ProviderId, model: string, prompt: string, apiKey: string, options: Options = {}): Promise<string> {
  if (provider === 'anthropic') return runAudit(prompt, apiKey, options)
  const p = PROVIDERS[provider]
  try {
    if (provider === 'gemini') {
      const { GoogleGenAI, FinishReason } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey, httpOptions: { baseUrl: p.url, ...(options.fetch ? { fetch: options.fetch } : {}) } })
      let text = ''
      let finish: string | undefined
      for await (const chunk of await ai.models.generateContentStream({ model, contents: prompt, config: { abortSignal: options.signal } })) {
        text += chunk.text ?? ''
        finish = chunk.candidates?.[0]?.finishReason ?? finish
      }
      if (finish === FinishReason.SAFETY || finish === FinishReason.PROHIBITED_CONTENT || finish === FinishReason.BLOCKLIST) throw new AuditRunError('The assistant declined to audit this. The prompt can still be copied and pasted into another.')
      if (finish === FinishReason.MAX_TOKENS) throw new AuditRunError('The reply was cut off before it finished. Try a chapter at a time.')
      return text
    }
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey, baseURL: p.url, maxRetries: 2, dangerouslyAllowBrowser: true, ...(options.fetch ? { fetch: options.fetch } : {}) })
    const stream = await client.chat.completions.create({ model, stream: true, messages: [{ role: 'user', content: prompt }] }, { signal: options.signal })
    let text = ''
    let finish: string | null = null
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? ''
      finish = chunk.choices[0]?.finish_reason ?? finish
    }
    if (finish === 'content_filter') throw new AuditRunError('The assistant declined to audit this. The prompt can still be copied and pasted into another.')
    if (finish === 'length') throw new AuditRunError('The reply was cut off before it finished. Try a chapter at a time.')
    return text
  } catch (e) {
    const status = (e as { status?: number }).status
    const known = said(e, status)
    if (known) throw known
    if (status === undefined && e instanceof TypeError) throw new AuditRunError(`Could not reach ${p.name}. Check the connection, or copy the prompt instead.`)
    throw new AuditRunError(`${p.name} said: ${e instanceof Error ? e.message : String(e)}`)
  }
}
