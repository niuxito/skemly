import { describe, it, expect } from 'vitest'
import { runLayout } from '../src/lib/useLayout.js'

function makeNode(id, label, shape = 'box', extra = {}) {
  return { id_key: id, label, shape, tags: [], icon: null, body: null, ...extra }
}

function makeAst({ nodes, edges, groups = [], directives = {} }) {
  return {
    nodes,
    edges,
    groups,
    directives: {
      vibe: 'clean',
      spacing: 40,
      edgeLabels: 'on',
      ...directives,
    },
  }
}

describe('runLayout – grouped edge routing', () => {
  it('preserves distinct intra-group edge labels and sections for parallel edges', async () => {
    const ast = makeAst({
      nodes: [
        makeNode('a', 'A'),
        makeNode('b', 'B'),
      ],
      edges: [
        { from: 'a', to: 'b', dir: '->', label: 'success' },
        { from: 'a', to: 'b', dir: '->', label: 'failure' },
      ],
      groups: [
        { id: 'g1', label: 'Group 1', nodeIds: ['a', 'b'] },
      ],
    })

    const result = await runLayout(ast)

    expect(result.edges).toHaveLength(2)
    expect(result.edges[0].labels?.[0]?.text).toBe('success')
    expect(result.edges[1].labels?.[0]?.text).toBe('failure')
    expect(result.edges[0].sections?.length).toBeGreaterThan(0)
    expect(result.edges[1].sections?.length).toBeGreaterThan(0)
    expect(result.edges[0].sections).not.toBe(result.edges[1].sections)
  })

  it('keeps ELK sections for cross-group edges instead of clearing them', async () => {
    const ast = makeAst({
      nodes: [
        makeNode('a', 'A'),
        makeNode('b', 'B'),
        makeNode('c', 'C'),
      ],
      edges: [
        { from: 'a', to: 'b', dir: '->', label: 'A to B' },
        { from: 'a', to: 'c', dir: '->', label: 'A to C' },
      ],
      groups: [
        { id: 'g1', label: 'Group 1', nodeIds: ['a'] },
        { id: 'g2', label: 'Group 2', nodeIds: ['b', 'c'] },
      ],
    })

    const result = await runLayout(ast)

    expect(result.edges).toHaveLength(2)
    for (const edge of result.edges) {
      expect(edge.sections?.length).toBeGreaterThan(0)
      expect(edge.labels?.[0]?.text).toMatch(/^A to /)
    }
  })
})
