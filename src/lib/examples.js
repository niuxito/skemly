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

export const EXAMPLES = [
  {
    id: '01',
    title: 'Cloud Architecture',
    description: 'E-commerce con CDN, microservicios y data layer',
    type: 'Architecture',
    theme: 'clean',
    dsl: ex01,
  },
  {
    id: '02',
    title: 'Mind Map — Producto',
    description: 'Estrategia de producto con temas y sub-temas',
    type: 'Mind Map',
    theme: 'clean',
    dsl: ex02,
  },
  {
    id: '03',
    title: 'Auth Flow (MFA)',
    description: 'Autenticación multifactor con bloqueo de cuenta',
    type: 'Flowchart',
    theme: 'clean',
    dsl: ex03,
  },
  {
    id: '04',
    title: 'CI/CD Pipeline',
    description: 'De commit a producción con quality gate y rollback',
    type: 'Pipeline',
    theme: 'cyberpunk',
    dsl: ex04,
  },
  {
    id: '05',
    title: 'Network Topology',
    description: 'DMZ, zona de aplicación y zona de datos segmentadas',
    type: 'Network',
    theme: 'cyberpunk',
    dsl: ex05,
  },
  {
    id: '06',
    title: 'Data Pipeline',
    description: 'Ingesta, procesamiento y serving en tiempo real',
    type: 'Pipeline',
    theme: 'clean',
    dsl: ex06,
  },
  {
    id: '07',
    title: 'Order Lifecycle',
    description: 'Ciclo de vida de un pedido e-commerce con reenvío',
    type: 'Flowchart',
    theme: 'handdrawn',
    dsl: ex07,
  },
  {
    id: '08',
    title: 'Mind Map — System Design',
    description: 'Mapa de conocimiento de diseño de sistemas',
    type: 'Mind Map',
    theme: 'clean',
    dsl: ex08,
  },
  {
    id: '09',
    title: 'Saga Pattern',
    description: 'Transacción distribuida con acciones compensatorias',
    type: 'Architecture',
    theme: 'clean',
    dsl: ex09,
  },
  {
    id: '10',
    title: 'RAG / LLM Pipeline',
    description: 'Pipeline de recuperación y generación aumentada',
    type: 'AI / ML',
    theme: 'cyberpunk',
    dsl: ex10,
  },
  {
    id: '11',
    title: 'Economía en la Edad Media',
    description: 'Sistema feudal, producción agrícola, comercio e iglesia',
    type: 'Education',
    theme: 'clean',
    dsl: ex11,
  },
  {
    id: '12',
    title: 'Fases Lunares',
    description: 'Ciclo lunar completo con colores personalizados por fase',
    type: 'Education',
    theme: 'clean',
    dsl: ex12,
  },
]

export const TYPE_COLORS = {
  'Architecture': 'bg-blue-100 text-blue-700',
  'Mind Map':     'bg-purple-100 text-purple-700',
  'Flowchart':    'bg-green-100 text-green-700',
  'Pipeline':     'bg-orange-100 text-orange-700',
  'Network':      'bg-red-100 text-red-700',
  'AI / ML':      'bg-pink-100 text-pink-700',
  'Education':    'bg-yellow-100 text-yellow-700',
}

export const THEME_COLORS = {
  clean:     'bg-slate-100 text-slate-600',
  handdrawn: 'bg-amber-100 text-amber-700',
  cyberpunk: 'bg-cyan-100 text-cyan-700',
}
