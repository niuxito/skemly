import ex01 from '../../examples/01-cloud-architecture.vibe?raw'
import ex02 from '../../examples/02-mindmap-product.vibe?raw'
import ex03 from '../../examples/03-auth-flow.vibe?raw'
import ex04 from '../../examples/04-cicd-pipeline.vibe?raw'
import ex05 from '../../examples/05-network-topology.vibe?raw'
import ex06 from '../../examples/06-data-pipeline.vibe?raw'
import ex07 from '../../examples/07-ecommerce-order-flow.vibe?raw'
import ex08 from '../../examples/08-mindmap-architecture.vibe?raw'
import ex09 from '../../examples/09-microservices-saga.vibe?raw'
import ex10 from '../../examples/10-rag-llm-pipeline.vibe?raw'
import ex11 from '../../examples/11-economia-edad-media.vibe?raw'
import ex12 from '../../examples/12-fases-lunares.vibe?raw'
import ex13 from '../../examples/13-org-chart.vibe?raw'
import ex14 from '../../examples/14-er-diagram.vibe?raw'
import ex15 from '../../examples/15-sequence-api.vibe?raw'

export const EXAMPLES = [
  {
    id: '01',
    slug: 'cloud-architecture',
    title: 'Cloud Architecture',
    description: 'E-commerce con CDN, microservicios y data layer',
    type: 'Architecture',
    theme: 'clean',
    dsl: ex01,
  },
  {
    id: '02',
    slug: 'mindmap-product',
    title: 'Mind Map — Producto',
    description: 'Estrategia de producto con temas y sub-temas',
    type: 'Mind Map',
    theme: 'clean',
    dsl: ex02,
  },
  {
    id: '03',
    slug: 'auth-flow',
    title: 'Auth Flow (MFA)',
    description: 'Autenticación multifactor con bloqueo de cuenta',
    type: 'Flowchart',
    theme: 'clean',
    dsl: ex03,
  },
  {
    id: '04',
    slug: 'cicd-pipeline',
    title: 'CI/CD Pipeline',
    description: 'De commit a producción con quality gate y rollback',
    type: 'Pipeline',
    theme: 'cyberpunk',
    dsl: ex04,
  },
  {
    id: '05',
    slug: 'network-topology',
    title: 'Network Topology',
    description: 'DMZ, zona de aplicación y zona de datos segmentadas',
    type: 'Network',
    theme: 'cyberpunk',
    dsl: ex05,
  },
  {
    id: '06',
    slug: 'data-pipeline',
    title: 'Data Pipeline',
    description: 'Ingesta, procesamiento y serving en tiempo real',
    type: 'Pipeline',
    theme: 'clean',
    dsl: ex06,
  },
  {
    id: '07',
    slug: 'order-lifecycle',
    title: 'Order Lifecycle',
    description: 'Ciclo de vida de un pedido e-commerce con reenvío',
    type: 'Flowchart',
    theme: 'handdrawn',
    dsl: ex07,
  },
  {
    id: '08',
    slug: 'mindmap-system-design',
    title: 'Mind Map — System Design',
    description: 'Mapa de conocimiento de diseño de sistemas',
    type: 'Mind Map',
    theme: 'clean',
    dsl: ex08,
  },
  {
    id: '09',
    slug: 'saga-pattern',
    title: 'Saga Pattern',
    description: 'Transacción distribuida con acciones compensatorias',
    type: 'Architecture',
    theme: 'clean',
    dsl: ex09,
  },
  {
    id: '10',
    slug: 'rag-llm-pipeline',
    title: 'RAG / LLM Pipeline',
    description: 'Pipeline de recuperación y generación aumentada',
    type: 'AI / ML',
    theme: 'cyberpunk',
    dsl: ex10,
  },
  {
    id: '11',
    slug: 'economia-edad-media',
    title: 'Economía en la Edad Media',
    description: 'Sistema feudal, producción agrícola, comercio e iglesia',
    type: 'Education',
    theme: 'clean',
    dsl: ex11,
  },
  {
    id: '12',
    slug: 'fases-lunares',
    title: 'Fases Lunares',
    description: 'Ciclo lunar completo con colores personalizados por fase',
    type: 'Education',
    theme: 'clean',
    dsl: ex12,
  },
  {
    id: '13',
    slug: 'org-chart',
    title: 'Org Chart',
    description: 'Jerarquía de empresa con layout TREE top-down nivel a nivel',
    type: 'Tree',
    theme: 'clean',
    dsl: ex13,
  },
  {
    id: '14',
    slug: 'er-diagram',
    title: 'ER Diagram — E-commerce',
    description: 'Schema de base de datos con entidades, atributos y cardinalidades',
    type: 'ER',
    theme: 'clean',
    dsl: ex14,
  },
  {
    id: '15',
    slug: 'sequence-api',
    title: 'Sequence — API Login',
    description: 'Flujo REST de autenticación JWT con actores y mensajes ordenados',
    type: 'Sequence',
    theme: 'clean',
    dsl: ex15,
  },
]

export function getExampleBySlug(slug) {
  return EXAMPLES.find(e => e.slug === slug) ?? null
}

export const TYPE_COLORS = {
  'Architecture': 'bg-blue-100 text-blue-700',
  'Mind Map':     'bg-purple-100 text-purple-700',
  'Flowchart':    'bg-green-100 text-green-700',
  'Pipeline':     'bg-orange-100 text-orange-700',
  'Network':      'bg-red-100 text-red-700',
  'AI / ML':      'bg-pink-100 text-pink-700',
  'Education':    'bg-yellow-100 text-yellow-700',
  'Tree':         'bg-teal-100 text-teal-700',
  'ER':           'bg-indigo-100 text-indigo-700',
  'Sequence':     'bg-violet-100 text-violet-700',
}

export const THEME_COLORS = {
  clean:     'bg-slate-100 text-slate-600',
  handdrawn: 'bg-amber-100 text-amber-700',
  cyberpunk: 'bg-cyan-100 text-cyan-700',
}
