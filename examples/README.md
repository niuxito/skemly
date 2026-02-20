# Vibedrawing — Ejemplos

Copia el contenido de cada fichero en el editor DSL para visualizarlo.

| # | Fichero | Tipo | Tema |
|---|---------|------|------|
| 01 | `01-cloud-architecture.vibe` | Arquitectura cloud e-commerce | clean |
| 02 | `02-mindmap-product.vibe` | Mind map — estrategia de producto | clean |
| 03 | `03-auth-flow.vibe` | Flujo de autenticación MFA | clean |
| 04 | `04-cicd-pipeline.vibe` | Pipeline CI/CD | cyberpunk |
| 05 | `05-network-topology.vibe` | Topología de red con DMZ | cyberpunk |
| 06 | `06-data-pipeline.vibe` | Pipeline de datos en tiempo real | clean |
| 07 | `07-ecommerce-order-flow.vibe` | Ciclo de vida de un pedido | handdrawn |
| 08 | `08-mindmap-architecture.vibe` | Mind map — system design | clean |
| 09 | `09-microservices-saga.vibe` | Patrón Saga (transacción distribuida) | clean |
| 10 | `10-rag-llm-pipeline.vibe` | Pipeline RAG / LLM | cyberpunk |

## Features usadas

- **Formas**: `[box]`, `(cylinder)`, `?diamond?`, `<cloud>`
- **Tags**: `#info` (azul), `#safe` (verde), `#warning` (amarillo), `#danger` (rojo)
- **Grupos**: `group "Name" #tag { ... }`
- **Aristas con label**: `A -> "label" -> B`
- **Expansión cartesiana**: `[A], [B] -> [C], [D]`
- **Temas**: `clean`, `handdrawn`, `cyberpunk`
- **Layout**: `TD` (vertical), `LR` (horizontal — ideal para mind maps)
