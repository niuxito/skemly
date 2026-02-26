/**
 * Strips the `attachment` field from the request body and rebuilds the last
 * user message as a multi-part content array for the Anthropic Messages API.
 */
export function buildAnthropicBody(rawBody) {
  const { attachment, ...rest } = rawBody
  if (!attachment) return rest

  const messages = rawBody.messages.map((m, i, arr) => {
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

  return { ...rest, messages }
}
