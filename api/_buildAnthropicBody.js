import { SYSTEM_PROMPT } from './_systemPrompt.js'

export const MAX_TOKENS = 2048
export const MAX_MESSAGES = 10
export const MAX_MESSAGE_CHARS = 30_000
export const MAX_TOTAL_CHARS = 60_000

/**
 * Validates the client's messages. Only plain-text user/assistant turns are
 * accepted, and the last one must come from the user (no assistant prefill).
 * The client sends the last few turns, so the first one may be the assistant's.
 * Returns an error message, or null when they are valid.
 */
export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array'
  if (messages.length > MAX_MESSAGES) return `at most ${MAX_MESSAGES} messages are allowed`
  let total = 0
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return 'invalid message role'
    if (typeof m.content !== 'string') return 'message content must be a string'
    if (m.content.length > MAX_MESSAGE_CHARS) return 'message too long'
    total += m.content.length
  }
  if (total > MAX_TOTAL_CHARS) return 'conversation too long'
  if (messages[messages.length - 1].role !== 'user') return 'the last message must come from the user'
  return null
}

/**
 * Builds the Anthropic request from validated client messages. Everything
 * else (system prompt, max_tokens, sampling, tools…) is set here and any
 * other client field is ignored. The model is added by the caller.
 * With an attachment, the last user message becomes a multi-part content
 * array for the Messages API.
 */
export function buildAnthropicBody(rawBody) {
  const { attachment } = rawBody
  const base = { max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT }
  const plain = rawBody.messages.map(({ role, content }) => ({ role, content }))
  if (!attachment) return { ...base, messages: plain }

  const messages = plain.map((m, i, arr) => {
    // Only transform the last user message
    if (i !== arr.length - 1 || m.role !== 'user') return m

    const textBlock = { type: 'text', text: m.content }
    let contentBlocks

    if (attachment.isText) {
      contentBlocks = [{
        type: 'text',
        text: `[Attached file: ${attachment.name}]\n\`\`\`\n${attachment.text}\n\`\`\`\n\n${m.content}`,
      }]
    } else if (attachment.mediaType.startsWith('image/')) {
      contentBlocks = [
        { type: 'image', source: { type: 'base64', media_type: attachment.mediaType, data: attachment.data } },
        textBlock,
      ]
    } else if (attachment.mediaType === 'application/pdf') {
      contentBlocks = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: attachment.data } },
        textBlock,
      ]
    } else {
      return m
    }

    return { ...m, content: contentBlocks }
  })

  return { ...base, messages }
}
