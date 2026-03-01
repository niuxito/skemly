import { describe, it, expect } from 'vitest'
import { buildAnthropicBody } from '../api/_buildAnthropicBody.js'

function makeBody(overrides = {}) {
  return {
    model: 'claude-haiku-4-5',
    system: 'You are helpful.',
    messages: [
      { role: 'user', content: 'Hello' },
    ],
    isFirstShot: false,
    ...overrides,
  }
}

// ─── No attachment ────────────────────────────────────────────────────────────

describe('buildAnthropicBody – no attachment', () => {
  it('strips isFirstShot from the result', () => {
    const result = buildAnthropicBody(makeBody())
    expect(result).not.toHaveProperty('isFirstShot')
  })

  it('attachment is undefined in result when not provided', () => {
    const result = buildAnthropicBody(makeBody())
    expect(result).not.toHaveProperty('attachment')
  })

  it('messages pass through unchanged when no attachment', () => {
    const body = makeBody()
    const result = buildAnthropicBody(body)
    expect(result.messages).toEqual(body.messages)
  })

  it('preserves other fields like model and system', () => {
    const result = buildAnthropicBody(makeBody())
    expect(result.model).toBe('claude-haiku-4-5')
    expect(result.system).toBe('You are helpful.')
  })
})

// ─── Text attachment ──────────────────────────────────────────────────────────

describe('buildAnthropicBody – text attachment', () => {
  const attachment = {
    isText: true,
    name: 'notes.txt',
    text: 'file contents here',
  }

  it('last user message content becomes a single text block with file header', () => {
    const body = makeBody({ attachment })
    const result = buildAnthropicBody(body)
    const lastMsg = result.messages[result.messages.length - 1]
    expect(Array.isArray(lastMsg.content)).toBe(true)
    expect(lastMsg.content).toHaveLength(1)
    expect(lastMsg.content[0].type).toBe('text')
    expect(lastMsg.content[0].text).toContain('[Attached file: notes.txt]')
    expect(lastMsg.content[0].text).toContain('file contents here')
    expect(lastMsg.content[0].text).toContain('Hello')
  })

  it('strips attachment field from result', () => {
    const result = buildAnthropicBody(makeBody({ attachment }))
    expect(result).not.toHaveProperty('attachment')
  })
})

// ─── Image attachment ─────────────────────────────────────────────────────────

describe('buildAnthropicBody – image attachment', () => {
  const attachment = {
    isText: false,
    name: 'screenshot.png',
    mediaType: 'image/png',
    data: 'base64datahere==',
  }

  it('last user message has image block followed by text block', () => {
    const result = buildAnthropicBody(makeBody({ attachment }))
    const lastMsg = result.messages[result.messages.length - 1]
    expect(Array.isArray(lastMsg.content)).toBe(true)
    expect(lastMsg.content).toHaveLength(2)
    expect(lastMsg.content[0].type).toBe('image')
    expect(lastMsg.content[0].source.media_type).toBe('image/png')
    expect(lastMsg.content[0].source.data).toBe('base64datahere==')
    expect(lastMsg.content[1].type).toBe('text')
    expect(lastMsg.content[1].text).toBe('Hello')
  })
})

// ─── PDF attachment ───────────────────────────────────────────────────────────

describe('buildAnthropicBody – PDF attachment', () => {
  const attachment = {
    isText: false,
    name: 'document.pdf',
    mediaType: 'application/pdf',
    data: 'pdfbase64data==',
  }

  it('last user message has document block followed by text block', () => {
    const result = buildAnthropicBody(makeBody({ attachment }))
    const lastMsg = result.messages[result.messages.length - 1]
    expect(lastMsg.content).toHaveLength(2)
    expect(lastMsg.content[0].type).toBe('document')
    expect(lastMsg.content[0].source.media_type).toBe('application/pdf')
    expect(lastMsg.content[0].source.data).toBe('pdfbase64data==')
    expect(lastMsg.content[1].type).toBe('text')
  })
})

// ─── Unknown media type ───────────────────────────────────────────────────────

describe('buildAnthropicBody – unknown media type', () => {
  it('last user message is left unchanged for unknown media type', () => {
    const attachment = {
      isText: false,
      name: 'data.bin',
      mediaType: 'application/octet-stream',
      data: 'somedata',
    }
    const body = makeBody({ attachment })
    const result = buildAnthropicBody(body)
    const lastMsg = result.messages[result.messages.length - 1]
    // Should remain a plain string, not transformed
    expect(typeof lastMsg.content).toBe('string')
    expect(lastMsg.content).toBe('Hello')
  })
})

// ─── Only last user message is transformed ────────────────────────────────────

describe('buildAnthropicBody – only last user message transformed', () => {
  it('earlier messages remain untouched', () => {
    const attachment = {
      isText: true,
      name: 'file.txt',
      text: 'content',
    }
    const body = {
      model: 'test-model',
      messages: [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Last message' },
      ],
      isFirstShot: false,
      attachment,
    }
    const result = buildAnthropicBody(body)
    expect(result.messages[0].content).toBe('First message')
    expect(result.messages[1].content).toBe('Response')
    expect(Array.isArray(result.messages[2].content)).toBe(true)
  })

  it('assistant messages are never transformed', () => {
    const attachment = {
      isText: true,
      name: 'file.txt',
      text: 'content',
    }
    const body = {
      model: 'test-model',
      messages: [
        { role: 'user', content: 'User msg' },
        { role: 'assistant', content: 'Assistant last msg' },
      ],
      isFirstShot: false,
      attachment,
    }
    const result = buildAnthropicBody(body)
    // Last message is assistant — should remain string
    const lastMsg = result.messages[result.messages.length - 1]
    expect(typeof lastMsg.content).toBe('string')
  })
})
