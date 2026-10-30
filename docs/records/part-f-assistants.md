# Part F, after: four assistants for the audit

After Part F (`part-f-numbers-and-time.md`, #637), the writer asked to run the
AI audit with Gemini, ChatGPT and DeepSeek as well as Claude.

## What changed

The audit runs with a key from any of four providers, each through its own
official library:

| Assistant | Library | Address |
|---|---|---|
| Claude (Anthropic) | `@anthropic-ai/sdk` | `https://api.anthropic.com` |
| ChatGPT (OpenAI) | `openai` | `https://api.openai.com/v1` |
| Gemini (Google) | `@google/genai` | `https://generativelanguage.googleapis.com` |
| DeepSeek | `openai` (DeepSeek's API is OpenAI's shape) | `https://api.deepseek.com` |

- **Libraries loaded on demand.** `openai` and `@google/genai` load only when a run or a model list asks for one, as their own chunks, so the app is no heavier for anyone who does not use them.
- **Claude's model is fixed** (`claude-opus-5-5`), with server-side fallbacks on a refusal, as before.
- **The others' models are listed from the provider.** **List models** offers chat models only: no embeddings, speech or pictures. Which models are current is the provider's to say, so the app names none of its own. The writer chooses one, or types its name. The provider and model chosen are remembered as settings, in `localStorage`; they are not secrets.
- **The reply is checked the same way whichever assistant wrote it:** every quote looked for in the book, and a chapter's finding kept only if it quotes the chapter.
- **Failures are said in words,** in each provider's own terms: a reply cut off (`length`, `MAX_TOKENS`), a declined request (`content_filter`, `SAFETY`), a refused key. Gemini refuses a bad key with a 400 that says so, not a 401, and that is read as a refused key too.

## The key, for each provider

Every protection Part F gave Claude's key now holds for each provider's, separately:

- **Kept only when asked,** and in only one of two places:
  - **On the desktop:** the system keychain, behind a bridge that answers to the four providers' names only, so a name can never become a path.
  - **In a browser:** the tab, until it closes. Never `localStorage`.
- **Forgotten per provider.** Forgetting one provider's key leaves the others'.
- **Pinned addresses.** Each provider's address is fixed in code, and no setting can change where a key goes.
- **The content-security policy** applies to all of them. The libraries' own chunks are the app's, so they run under `script-src 'self'`.

## Browser access, as far as it could be checked

A page with no server can call a provider only if the provider allows a browser to.

- **Google's API allows it.** Its CORS preflight answers this app's origin and allows the `x-goog-api-key` header (checked from here).
- **OpenAI's and DeepSeek's could not be checked from this container,** whose network proxy refuses them. Where a provider does not allow a browser to call it, the run fails with *Could not reach …*, and the prompt is there to copy.

## Tests

- **`auditProviders.test.ts`,** against a fetch answering as each API does, streamed:
  - OpenAI's model list, with its chat models kept and others left out;
  - DeepSeek's run, which goes to DeepSeek with DeepSeek's key and returns the reply;
  - a reply cut off, and a refused key, said in words;
  - Gemini's run, which goes to Google with Google's key, and its model list, writing models only;
  - Gemini's 400 for a bad key, said as a refused key.
- **`apiKeyProtection.test.ts`,** now per provider:
  - each key encrypted and kept apart;
  - the keychain refusing any name but the four;
  - one provider's key forgotten while another's stays;
  - the four pinned addresses;
  - `localStorage` used only for the remembered choice.
- **`e2e/chapterAudit.spec.ts`,** with Gemini through the real panel on the production build:
  - the models listed, and the writing model chosen;
  - the run sent to Google, with its key and the chapter's prompt;
  - the reply checked;
  - Claude's key field still empty.
  - Google's library loads under the policy.
- **Mutants, each turning its test red:**
  - Gemini's bad-key 400 no longer recognised;
  - DeepSeek's address changed;
  - the cut-off check removed.
