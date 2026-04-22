// Sequence diagram layout — actors as columns, messages as ordered horizontal arrows.
// Activated when directive: layout: SEQ
//
// DSL convention:
//   layout: SEQ
//   [Actor A] -> [Actor B] : login
//   [Actor B] -> [DB] : query
//   [DB] -> [Actor B] : result
//   [Actor B] -> [Actor A] : token
//
// Nodes are actors (appear at the top). Edges are messages (ordered top-to-bottom).
// Self-loops are allowed: [A] -> [A] : think

const ACTOR_W    = 120  // actor box width
const ACTOR_H    = 40   // actor box height
const ACTOR_GAP  = 100  // horizontal gap between actors
const MSG_STEP   = 56   // vertical step between messages
const LIFELINE_PADDING_TOP    = 20   // gap below actor box before first message
const LIFELINE_PADDING_BOTTOM = 40   // gap after last message
const CHAR_W = 7.2
const PAD_W  = 24

function actorLabelLines(label) {
  const words = (label || '').split(' ')
  const maxW = ACTOR_W - PAD_W
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (test.length * CHAR_W <= maxW) { cur = test }
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : [label || '']
}

export function sequenceLayout(ast) {
  const { nodes, edges } = ast
  if (!nodes.length) return null

  // Actor order: preserve DSL declaration order (nodes appear in the order they're first seen)
  // Nodes are already in declaration order from the parser.
  const actors = nodes  // every node is an actor in SEQ mode
  const actorIdx = Object.fromEntries(actors.map((a, i) => [a.id_key, i]))

  const nActors = actors.length
  const totalActorW = nActors * ACTOR_W + (nActors - 1) * ACTOR_GAP
  const padding = 48

  // X center for each actor column
  const actorCX = actors.map((_, i) => padding + i * (ACTOR_W + ACTOR_GAP) + ACTOR_W / 2)

  // Actor positions
  const actorBoxes = actors.map((actor, i) => ({
    id: actor.id_key,
    x: actorCX[i] - ACTOR_W / 2,
    y: padding,
    width: ACTOR_W,
    height: ACTOR_H,
    label: actor.label,
    lines: actorLabelLines(actor.label),
  }))

  // Message positions — one per edge, top to bottom
  const nMessages = edges.length
  const lifelineStart = padding + ACTOR_H + LIFELINE_PADDING_TOP
  const messageY = edges.map((_, i) => lifelineStart + i * MSG_STEP)
  const lifelineEnd = nMessages > 0
    ? messageY[nMessages - 1] + LIFELINE_PADDING_BOTTOM
    : lifelineStart + LIFELINE_PADDING_BOTTOM

  const totalH = lifelineEnd + padding
  const totalW = totalActorW + padding * 2

  // Lifelines (dashed vertical lines)
  const lifelines = actors.map((actor, i) => ({
    id: actor.id_key,
    x: actorCX[i],
    y1: padding + ACTOR_H,
    y2: lifelineEnd,
  }))

  // Messages (edges become horizontal/diagonal arrows with labels)
  const messages = edges.map((edge, i) => {
    const fromIdx = actorIdx[edge.from] ?? 0
    const toIdx   = actorIdx[edge.to]   ?? 0
    const y = messageY[i]
    const isSelf = fromIdx === toIdx

    const x1 = actorCX[fromIdx]
    const x2 = actorCX[toIdx]

    return {
      id: `msg_${i}`,
      from: edge.from,
      to: edge.to,
      label: edge.label ?? '',
      dir: edge.dir,
      y,
      x1,
      x2,
      isSelf,
      isBidi: edge.dir === '<->',
      // For self-loops: small right-angle path that loops right of the actor
      selfLoop: isSelf ? {
        loopX: x1 + ACTOR_W / 2 + 24,
        y1: y - 10,
        y2: y + 10,
      } : null,
    }
  })

  return {
    id: 'root',
    isSequence: true,
    x: 0, y: 0,
    width: totalW,
    height: totalH,
    actors: actorBoxes,
    lifelines,
    messages,
    // ELK-compatible children for node lookup (needed for export / node rendering fallback)
    children: actorBoxes.map(a => ({
      id: a.id,
      x: a.x,
      y: a.y,
      width: a.width,
      height: a.height,
      labels: [{ text: a.label }],
      lines: a.lines,
    })),
    edges: [],
  }
}
