import { describe, it, expect } from 'vitest'
import { listModels, runAuditWith, AuditRunError } from '@/lib/auditWithKey'

/**
 * The audit run with a key from another provider (Part F3): ChatGPT and
 * DeepSeek through OpenAI's library, Gemini through Google's. Each against a
 * fetch answering as that provider's API does, streamed: where the request
 * goes, that the key goes with it and nowhere else, and what comes back.
 */

interface Sent { url: string; headers: Headers; body: unknown }

function fakeApi(respond: (url: string) => Response) {
  const sent: Sent[] = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers)
    const raw = input instanceof Request ? await input.clone().text() : init?.body
    sent.push({ url, headers, body: raw ? JSON.parse(String(raw)) : null })
    return respond(url)
  }) as typeof globalThis.fetch
  return { fetch, sent }
}

const sse = (lines: unknown[]) => new Response(lines.map((l) => `data: ${typeof l === 'string' ? l : JSON.stringify(l)}\n\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const auth = (h: Headers) => `${h.get('authorization') ?? ''} ${h.get('x-goog-api-key') ?? ''}`

const chunk = (content: string, finish: string | null = null) => ({ id: 'c', object: 'chat.completion.chunk', created: 0, model: 'm', choices: [{ index: 0, delta: { content }, finish_reason: finish }] })

describe('ChatGPT and DeepSeek, through OpenAI’s library', () => {
  it('lists OpenAI’s chat models, and not its others', async () => {
    const api = fakeApi(() => json({ object: 'list', data: ['gpt-9', 'text-embedding-9', 'gpt-9-audio', 'o7', 'dall-e-9'].map((id) => ({ id, object: 'model', created: 0, owned_by: 'x' })) }))
    expect(await listModels('openai', 'sk-o', { fetch: api.fetch })).toEqual(['gpt-9', 'o7'])
    expect(api.sent[0].url).toBe('https://api.openai.com/v1/models')
  })

  it('sends DeepSeek’s audit to DeepSeek, with its key, and returns the reply', async () => {
    const api = fakeApi(() => sse([chunk('{"findings": '), chunk('[]}', 'stop'), '[DONE]']))
    expect(await runAuditWith('deepseek', 'deepseek-x', 'THE PROMPT', 'sk-deep', { fetch: api.fetch })).toBe('{"findings": []}')
    const [req] = api.sent
    expect(req.url).toBe('https://api.deepseek.com/chat/completions')
    expect(auth(req.headers)).toContain('sk-deep')
    expect(req.body).toMatchObject({ model: 'deepseek-x', stream: true, messages: [{ role: 'user', content: 'THE PROMPT' }] })
  })

  it('says why, in words: a reply cut off, a refused key', async () => {
    const cut = fakeApi(() => sse([chunk('{"find', 'length'), '[DONE]']))
    await expect(runAuditWith('openai', 'gpt-9', 'P', 'k', { fetch: cut.fetch })).rejects.toThrow('The reply was cut off before it finished. Try a chapter at a time.')
    const refused = fakeApi(() => json({ error: { message: 'Incorrect API key', type: 'invalid_request_error' } }, 401))
    await expect(runAuditWith('openai', 'gpt-9', 'P', 'k', { fetch: refused.fetch })).rejects.toThrow(new AuditRunError('The key was not accepted. Check it, or copy the prompt instead.'))
  })
})

describe('Gemini, through Google’s library', () => {
  it('sends the audit to Google’s API, with its key, and returns the reply', async () => {
    const part = (text: string, finishReason?: string) => ({ candidates: [{ content: { parts: [{ text }], role: 'model' }, ...(finishReason ? { finishReason } : {}) }] })
    const api = fakeApi(() => sse([part('{"findings": '), part('[]}', 'STOP')]))
    expect(await runAuditWith('gemini', 'gemini-x', 'THE PROMPT', 'AIza-g', { fetch: api.fetch })).toBe('{"findings": []}')
    const [req] = api.sent
    expect(req.url.startsWith('https://generativelanguage.googleapis.com/')).toBe(true)
    expect(req.url).toContain('gemini-x:streamGenerateContent')
    expect(auth(req.headers)).toContain('AIza-g')
    expect(JSON.stringify(req.body)).toContain('THE PROMPT')
  })

  it('lists the models that can write, and says a refused key in words', async () => {
    const api = fakeApi(() => json({ models: [
      { name: 'models/gemini-x', supportedGenerationMethods: ['generateContent', 'countTokens'] },
      { name: 'models/embedding-x', supportedGenerationMethods: ['embedContent'] },
    ] }))
    expect(await listModels('gemini', 'AIza-g', { fetch: api.fetch })).toEqual(['gemini-x'])
    const refused = fakeApi(() => json({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 400))
    await expect(runAuditWith('gemini', 'gemini-x', 'P', 'bad', { fetch: refused.fetch })).rejects.toThrow('The key was not accepted. Check it, or copy the prompt instead.')
  })
})
