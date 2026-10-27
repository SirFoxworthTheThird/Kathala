import { describe, it, expect } from 'vitest'
import { runAudit, AuditRunError, AUDIT_MODEL } from '@/lib/auditWithKey'

/**
 * The audit run with the writer's own key (Part F3, decision D-2): the request
 * that leaves the device, and what comes back — a reply, or a reason in words.
 * Against a fetch that answers as the Messages API does, streamed.
 */

const sse = (events: Array<Record<string, unknown>>) =>
  events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('')

const replyWith = (text: string, stopReason = 'end_turn') => sse([
  { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: AUDIT_MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 5 } },
  { type: 'message_stop' },
])

function fakeApi(respond: () => Response) {
  const sent: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) })
    return respond()
  }) as typeof globalThis.fetch
  return { fetch, sent }
}

const stream = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })

describe('an audit run with the writer’s key', () => {
  it('sends the prompt to the Messages API from the browser, and returns the reply', async () => {
    const api = fakeApi(() => stream(replyWith('{"findings": []}')))
    expect(await runAudit('THE PROMPT', 'sk-ant-test', { fetch: api.fetch })).toBe('{"findings": []}')
    const [req] = api.sent
    expect(req.url).toMatch(/\/v1\/messages/)
    // The key, in whichever header the SDK sends it: `Authorization: Bearer` in this version.
    expect(`${req.headers.get('x-api-key') ?? ''} ${req.headers.get('authorization') ?? ''}`).toContain('sk-ant-test')
    expect(req.headers.get('anthropic-dangerous-direct-browser-access')).toBe('true')
    expect(req.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
    expect(req.body).toMatchObject({ model: AUDIT_MODEL, stream: true, fallbacks: 'default', messages: [{ role: 'user', content: 'THE PROMPT' }] })
  })

  it('says why, in words, when there is no reply to read', async () => {
    const refused = fakeApi(() => stream(replyWith('', 'refusal')))
    await expect(runAudit('P', 'k', { fetch: refused.fetch })).rejects.toThrow(new AuditRunError('The assistant declined to audit this. The prompt can still be copied and pasted into another.'))
    const badKey = fakeApi(() => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } }))
    await expect(runAudit('P', 'k', { fetch: badKey.fetch })).rejects.toThrow('The key was not accepted. Check it, or copy the prompt instead.')
    // A 401 is not tried again: once.
    expect(badKey.sent).toHaveLength(1)
  })
})
