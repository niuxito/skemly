import { describe, it, expect } from 'vitest'
import { mindmapLayout } from '../src/lib/mindmapLayout.js'

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeAst(nodes, edges = []) {
  return {
    nodes,
    edges,
    directives: { vibe: 'clean', layout: 'MM', spacing: 40, edgeLabels: 'on' },
    groups: [],
  }
}

function makeNode(id, label, shape = 'box', extra = {}) {
  return { id_key: id, label, shape, tags: [], icon: null, body: null, ...extra }
}

// ─── Card node sizing ─────────────────────────────────────────────────────────

describe('mindmapLayout – card node sizing', () => {
  it('card with body has headerH >= 36', () => {
    const ast = makeAst([
      makeNode('c1', 'My Header', 'card', { body: 'Some body text here' }),
    ])
    const result = mindmapLayout(ast)
    const child = result.children.find(c => c.id === 'c1')
    expect(child.headerH).toBeGreaterThanOrEqual(36)
  })

  it('card with body has bodyLines as a non-empty array', () => {
    const ast = makeAst([
      makeNode('c1', 'Header', 'card', { body: 'Body content here' }),
    ])
    const result = mindmapLayout(ast)
    const child = result.children.find(c => c.id === 'c1')
    expect(Array.isArray(child.bodyLines)).toBe(true)
    expect(child.bodyLines.length).toBeGreaterThan(0)
  })

  it('card with body uses width === 220 (CARD_MAX_W)', () => {
    const ast = makeAst([
      makeNode('c1', 'Header', 'card', { body: 'Body content here' }),
    ])
    const result = mindmapLayout(ast)
    const child = result.children.find(c => c.id === 'c1')
    expect(child.width).toBe(220)
  })

  it('card without body uses width <= 220', () => {
    const ast = makeAst([
      makeNode('c1', 'Short', 'card', { body: null }),
    ])
    const result = mindmapLayout(ast)
    const child = result.children.find(c => c.id === 'c1')
    expect(child.width).toBeLessThanOrEqual(220)
  })

  it('regular box node does not have bodyLines', () => {
    const ast = makeAst([makeNode('a', 'Regular Box', 'box')])
    const result = mindmapLayout(ast)
    const child = result.children.find(c => c.id === 'a')
    expect(child.bodyLines).toBeUndefined()
  })
})

// ─── Root detection ───────────────────────────────────────────────────────────

describe('mindmapLayout – root detection', () => {
  it('root is the node with no incoming edges (A→B means A is root)', () => {
    const ast = makeAst(
      [makeNode('a', 'Root'), makeNode('b', 'Child')],
      [{ from: 'a', to: 'b', dir: '->', label: null }],
    )
    const result = mindmapLayout(ast)
    // Root should be placed close to center (smaller x approximately)
    const aChild = result.children.find(c => c.id === 'a')
    const bChild = result.children.find(c => c.id === 'b')
    expect(aChild).toBeDefined()
    expect(bChild).toBeDefined()
    // a has no incoming edges — it is root, placed before b horizontally
    expect(aChild.x).toBeLessThan(bChild.x)
  })
})

// ─── Result structure ─────────────────────────────────────────────────────────

describe('mindmapLayout – result structure', () => {
  it('returns isMindmap:true', () => {
    const ast = makeAst([makeNode('a', 'A')])
    const result = mindmapLayout(ast)
    expect(result.isMindmap).toBe(true)
  })

  it('result has positive width and height', () => {
    const ast = makeAst([makeNode('a', 'A'), makeNode('b', 'B')],
      [{ from: 'a', to: 'b', dir: '->', label: null }])
    const result = mindmapLayout(ast)
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(0)
  })

  it('all children have numeric x, y, width, height', () => {
    const ast = makeAst(
      [makeNode('a', 'Root'), makeNode('b', 'Child 1'), makeNode('c', 'Child 2')],
      [
        { from: 'a', to: 'b', dir: '->', label: null },
        { from: 'a', to: 'c', dir: '->', label: null },
      ],
    )
    const result = mindmapLayout(ast)
    for (const child of result.children) {
      expect(typeof child.x).toBe('number')
      expect(typeof child.y).toBe('number')
      expect(typeof child.width).toBe('number')
      expect(typeof child.height).toBe('number')
      expect(child.x).toBeGreaterThanOrEqual(0)
      expect(child.y).toBeGreaterThanOrEqual(0)
      expect(child.width).toBeGreaterThan(0)
      expect(child.height).toBeGreaterThan(0)
    }
  })

  it('edges in result have sections with isBezier:true', () => {
    const ast = makeAst(
      [makeNode('a', 'Root'), makeNode('b', 'Child')],
      [{ from: 'a', to: 'b', dir: '->', label: null }],
    )
    const result = mindmapLayout(ast)
    expect(result.edges).toHaveLength(1)
    const edge = result.edges[0]
    expect(edge.sections).toHaveLength(1)
    expect(edge.sections[0].isBezier).toBe(true)
  })

  it('returns null for empty nodes array', () => {
    const ast = makeAst([])
    expect(mindmapLayout(ast)).toBeNull()
  })

  it('single node with no edges returns valid layout', () => {
    const ast = makeAst([makeNode('a', 'Alone')])
    const result = mindmapLayout(ast)
    expect(result).not.toBeNull()
    expect(result.children).toHaveLength(1)
    expect(result.edges).toHaveLength(0)
  })
})
