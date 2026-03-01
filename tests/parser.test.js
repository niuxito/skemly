import { describe, it, expect } from 'vitest'
import { normalizeId, extractDSL, parseDSL } from '../src/lib/parser.js'

// ─── normalizeId ──────────────────────────────────────────────────────────────

describe('normalizeId', () => {
  it('lowercases input', () => {
    expect(normalizeId('Hello')).toBe('hello')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeId('  hello  ')).toBe('hello')
  })

  it('collapses internal spaces to a single space', () => {
    expect(normalizeId('App   Server')).toBe('app server')
  })

  it('[App Server] and [app server] produce the same id', () => {
    expect(normalizeId('App Server')).toBe(normalizeId('app server'))
  })

  it('applies NFC normalization', () => {
    // é as decomposed (e + combining accent) should normalize to composed form
    const decomposed = 'e\u0301'
    expect(normalizeId(decomposed)).toBe('é')
  })
})

// ─── extractDSL ───────────────────────────────────────────────────────────────

describe('extractDSL', () => {
  it('returns raw input when no fence blocks present', () => {
    const raw = '[A] -> [B]'
    expect(extractDSL(raw)).toBe(raw)
  })

  it('extracts content from ```vibe fence', () => {
    const input = 'Some text\n```vibe\n[A] -> [B]\n```\nMore text'
    expect(extractDSL(input)).toBe('[A] -> [B]\n')
  })

  it('extracts content from ```vibedraw fence', () => {
    const input = '```vibedraw\n(DB)\n```'
    expect(extractDSL(input)).toBe('(DB)\n')
  })

  it('uses only the first vibe fence when multiple exist', () => {
    const input = '```vibe\n[A]\n```\n```vibe\n[B]\n```'
    expect(extractDSL(input)).toBe('[A]\n')
  })
})

// ─── Directives ───────────────────────────────────────────────────────────────

describe('parseDSL – directives', () => {
  it('returns default directives when none declared', () => {
    const { directives } = parseDSL('[A]')
    expect(directives).toEqual({ vibe: 'clean', layout: 'TD', spacing: 40, edgeLabels: 'on' })
  })

  it('parses vibe directive', () => {
    const { directives } = parseDSL('vibe: handdrawn\n[A]')
    expect(directives.vibe).toBe('handdrawn')
  })

  it('parses layout directive', () => {
    const { directives } = parseDSL('layout: LR\n[A]')
    expect(directives.layout).toBe('LR')
  })

  it('parses spacing directive with valid number', () => {
    const { directives } = parseDSL('spacing: 80\n[A]')
    expect(directives.spacing).toBe(80)
  })

  it('parses edgeLabels directive', () => {
    const { directives } = parseDSL('edgeLabels: off\n[A]')
    expect(directives.edgeLabels).toBe('off')
  })

  it('invalid spacing value generates a diagnostic and keeps default', () => {
    const { directives, diagnostics } = parseDSL('spacing: bad\n[A]')
    expect(directives.spacing).toBe(40)
    expect(diagnostics.some(d => d.msg.includes('Invalid spacing value'))).toBe(true)
  })
})

// ─── Shapes ───────────────────────────────────────────────────────────────────

describe('parseDSL – node shapes', () => {
  it('parses box [Text]', () => {
    const { nodes } = parseDSL('[Hello]')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].shape).toBe('box')
    expect(nodes[0].label).toBe('Hello')
  })

  it('parses cylinder (Text)', () => {
    const { nodes } = parseDSL('(Database)')
    expect(nodes[0].shape).toBe('cylinder')
  })

  it('parses diamond ?Text?', () => {
    const { nodes } = parseDSL('?Decision?')
    expect(nodes[0].shape).toBe('diamond')
  })

  it('parses cloud <Text>', () => {
    const { nodes } = parseDSL('<Internet>')
    expect(nodes[0].shape).toBe('cloud')
  })

  it('parses card {Header}', () => {
    const { nodes } = parseDSL('{MyCard}')
    expect(nodes[0].shape).toBe('card')
    expect(nodes[0].label).toBe('MyCard')
    expect(nodes[0].body).toBeNull()
  })

  it('parses card {Header|Body}', () => {
    const { nodes } = parseDSL('{Title|Some body text}')
    expect(nodes[0].shape).toBe('card')
    expect(nodes[0].label).toBe('Title')
    expect(nodes[0].body).toBe('Some body text')
  })

  it('parses card {id|Header|Body}', () => {
    const { nodes } = parseDSL('{c1|My Title|My body}')
    expect(nodes[0].id_key).toBe('c1')
    expect(nodes[0].label).toBe('My Title')
    expect(nodes[0].body).toBe('My body')
  })

  it('card with 3+ pipes concatenates extra parts into body', () => {
    const { nodes } = parseDSL('{c1|Head|Part1|Part2}')
    expect(nodes[0].body).toBe('Part1 | Part2')
  })
})

// ─── IDs ──────────────────────────────────────────────────────────────────────

describe('parseDSL – IDs', () => {
  it('explicit id [id|Label]', () => {
    const { nodes } = parseDSL('[app1|App Server]')
    expect(nodes[0].id_key).toBe('app1')
    expect(nodes[0].label).toBe('App Server')
  })

  it('id defaults to label when no pipe', () => {
    const { nodes } = parseDSL('[App Server]')
    expect(nodes[0].id_key).toBe('app server')
  })

  it('[App Server] and [app server] produce the same node (dedup)', () => {
    const { nodes } = parseDSL('[App Server] -> [app server]')
    expect(nodes).toHaveLength(1)
  })

  it('id is normalized lowercase', () => {
    const { nodes } = parseDSL('[MyApp|MyApp]')
    expect(nodes[0].id_key).toBe('myapp')
  })
})

// ─── Edges ────────────────────────────────────────────────────────────────────

describe('parseDSL – edges', () => {
  it('directed edge ->', () => {
    const { edges } = parseDSL('[A] -> [B]')
    expect(edges).toHaveLength(1)
    expect(edges[0].dir).toBe('->')
    expect(edges[0].from).toBe('a')
    expect(edges[0].to).toBe('b')
  })

  it('bidirectional edge <->', () => {
    const { edges } = parseDSL('[A] <-> [B]')
    expect(edges[0].dir).toBe('<->')
  })

  it('edge with label A -> "Label" -> B', () => {
    const { edges } = parseDSL('[A] -> "Auth Check" -> [B]')
    expect(edges[0].label).toBe('Auth Check')
  })

  it('chained edges A -> B -> C produces 2 edges', () => {
    const { edges } = parseDSL('[A] -> [B] -> [C]')
    expect(edges).toHaveLength(2)
    expect(edges[0]).toMatchObject({ from: 'a', to: 'b' })
    expect(edges[1]).toMatchObject({ from: 'b', to: 'c' })
  })

  it('cartesian expansion [A],[B] -> [C],[D] produces 4 edges', () => {
    const { edges } = parseDSL('[A],[B] -> [C],[D]')
    expect(edges).toHaveLength(4)
    const pairs = edges.map(e => `${e.from}->${e.to}`)
    expect(pairs).toContain('a->c')
    expect(pairs).toContain('a->d')
    expect(pairs).toContain('b->c')
    expect(pairs).toContain('b->d')
  })
})

// ─── Tags ─────────────────────────────────────────────────────────────────────

describe('parseDSL – tags', () => {
  it('parses #danger tag', () => {
    const { nodes } = parseDSL('[A]#danger')
    expect(nodes[0].tags).toContain('danger')
  })

  it('parses #safe tag', () => {
    const { nodes } = parseDSL('[A]#safe')
    expect(nodes[0].tags).toContain('safe')
  })

  it('parses #info tag', () => {
    const { nodes } = parseDSL('[A]#info')
    expect(nodes[0].tags).toContain('info')
  })

  it('parses #warning tag', () => {
    const { nodes } = parseDSL('[A]#warning')
    expect(nodes[0].tags).toContain('warning')
  })

  it('unknown tag is ignored', () => {
    const { nodes } = parseDSL('[A]#unknown')
    expect(nodes[0].tags).toHaveLength(0)
  })
})

// ─── Node attributes ──────────────────────────────────────────────────────────

describe('parseDSL – node attributes', () => {
  it('@bg= sets bgColor on node', () => {
    const { nodes } = parseDSL('[A]@bg=#ff0000')
    expect(nodes[0].bgColor).toBe('#ff0000')
  })

  it('@color= sets textColor on node', () => {
    const { nodes } = parseDSL('[A]@color=#ffffff')
    expect(nodes[0].textColor).toBe('#ffffff')
  })

  it('@icon= sets icon (PascalCase)', () => {
    const { nodes } = parseDSL('[A]@icon=database')
    expect(nodes[0].icon).toBe('Database')
  })

  it('@url= sets url on node', () => {
    const { nodes } = parseDSL('[A]@url=https://example.com')
    expect(nodes[0].url).toBe('https://example.com')
  })

  it('multiple attributes combined', () => {
    const { nodes } = parseDSL('[A]@bg=#000@color=#fff@icon=server')
    expect(nodes[0].bgColor).toBe('#000')
    expect(nodes[0].textColor).toBe('#fff')
    expect(nodes[0].icon).toBe('Server')
  })

  it('attributes work on card nodes', () => {
    const { nodes } = parseDSL('{c1|Head|Body}@bg=#aabbcc')
    expect(nodes[0].bgColor).toBe('#aabbcc')
  })
})

// ─── Icon inference ───────────────────────────────────────────────────────────

describe('parseDSL – icon inference', () => {
  const cases = [
    ['[User]', 'User'],
    ['[Database]', 'Database'],
    ['[Cloud]', 'Cloud'],
    ['[Auth Service]', 'Lock'],
    ['[Mail Server]', 'Mail'],
    ['[API Gateway]', 'Plug'],
    ['[App Server]', 'Server'],
    ['[lb|Load Balancer]', 'GitMerge'],
    ['[Queue]', 'List'],
    ['[Cache]', 'Zap'],
    ['[Internet]', 'Globe'],
    ['[Login Page]', 'LogIn'],
  ]

  for (const [dsl, expectedIcon] of cases) {
    it(`infers ${expectedIcon} for ${dsl}`, () => {
      const { nodes } = parseDSL(dsl)
      expect(nodes[0].icon).toBe(expectedIcon)
    })
  }

  it('@icon= overrides inferred icon', () => {
    const { nodes } = parseDSL('[Database]@icon=Star')
    expect(nodes[0].icon).toBe('Star')
  })
})

// ─── Text formatting ──────────────────────────────────────────────────────────

describe('parseDSL – text formatting', () => {
  it('**bold** sets bold=true and strips markers', () => {
    const { nodes } = parseDSL('[**Hello**]')
    expect(nodes[0].bold).toBe(true)
    expect(nodes[0].label).toBe('Hello')
  })

  it('__underline__ sets underline=true and strips markers', () => {
    const { nodes } = parseDSL('[__Hello__]')
    expect(nodes[0].underline).toBe(true)
    expect(nodes[0].label).toBe('Hello')
  })
})

// ─── Groups ───────────────────────────────────────────────────────────────────

describe('parseDSL – groups', () => {
  it('node inside group has groupIds set', () => {
    const dsl = `group "Private Cloud" #safe {\n  [App]\n}`
    const { nodes, groups } = parseDSL(dsl)
    expect(groups).toHaveLength(1)
    expect(nodes[0].groupIds).toContain(groups[0].id)
  })

  it('nested groups: inner node has both group ids', () => {
    const dsl = `group "Outer" {\n  group "Inner" {\n    [Node]\n  }\n}`
    const { nodes, groups } = parseDSL(dsl)
    expect(groups).toHaveLength(2)
    expect(nodes[0].groupIds).toHaveLength(2)
  })

  it('group with tag stores tag on the group', () => {
    const dsl = `group "Cloud" #safe {\n  [A]\n}`
    const { groups } = parseDSL(dsl)
    expect(groups[0].tag).toBe('safe')
  })
})

// ─── Card deduplication ───────────────────────────────────────────────────────

describe('parseDSL – card deduplication', () => {
  it('{c1|Title|Body} declared once and referenced in edges -> single node', () => {
    const dsl = '{c1|Title|Body text} -> [A]'
    const { nodes } = parseDSL(dsl)
    const cardNodes = nodes.filter(n => n.shape === 'card')
    expect(cardNodes).toHaveLength(1)
    expect(cardNodes[0].body).toBe('Body text')
  })

  it('full card repeated in edges produces 1 node and 2 edges', () => {
    const dsl = '[A] -> {c1|T|B}\n{c1|T|B} -> [C]'
    const { nodes, edges } = parseDSL(dsl)
    const cardNodes = nodes.filter(n => n.shape === 'card')
    expect(cardNodes).toHaveLength(1)
    expect(edges).toHaveLength(2)
  })
})

// ─── Comments and empty lines ──────────────────────────────────────────────────

describe('parseDSL – comments and empty lines', () => {
  it('// comment lines are ignored', () => {
    const { nodes } = parseDSL('// This is a comment\n[A]')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id_key).toBe('a')
  })

  it('empty lines are ignored', () => {
    const { nodes } = parseDSL('\n\n[A]\n\n')
    expect(nodes).toHaveLength(1)
  })
})

// ─── Auto-heal ────────────────────────────────────────────────────────────────

describe('parseDSL – auto-heal', () => {
  it('unclosed group produces Unclosed group diagnostic', () => {
    const { diagnostics } = parseDSL('group "Missing Close" {\n  [A]')
    expect(diagnostics.some(d => d.msg.includes('Unclosed group'))).toBe(true)
  })
})
