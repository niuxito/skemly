/**
 * Prompt injection detection.
 * Returns the matched pattern source string if injection is detected, null otherwise.
 * Covers both English and Spanish attack patterns.
 */

const INJECTION_PATTERNS = [
  // ── Instruction override — English ─────────────────────────────────────────
  /\bignore\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+|these\s+)?instructions?\b/i,
  /\bforget\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+|these\s+)?instructions?\b/i,
  /\bdisregard\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+|these\s+)?instructions?\b/i,
  /\boverride\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+)?instructions?\b/i,
  /\byour\s+(system\s+)?prompt\b/i,

  // ── Role / persona override — English ──────────────────────────────────────
  /\byou\s+are\s+now\s+/i,
  /\bpretend\s+(to\s+be|you\s+(are|were))\b/i,
  /\bnew\s+(role|task|persona|identity|directive)\s*[:\-]/i,
  /\bdo\s+anything\s+now\b/i,
  /\bjailbreak\b/i,
  /\bdan\s+mode\b/i,

  // ── Diagram output bypass — English ────────────────────────────────────────
  /\bdon['']?t\s+(return|output|generate|create|make|produce|give)\s+(a\s+|any\s+)?(diagram|dsl|chart|graph|visual)\b/i,
  /\bskip\s+(the\s+)?(diagram|dsl)\b/i,
  /\bno\s+(diagram|dsl)\s+(needed|required|please|today)\b/i,
  /\binstead\s+of\s+(a\s+|the\s+)?(diagram|dsl)\b/i,
  /\bwithout\s+(a\s+|the\s+)?(diagram|dsl)\b/i,
  /\banswer\s+(my\s+)?question\s+(directly|without)\b/i,

  // ── System prompt extraction — English ─────────────────────────────────────
  /\b(reveal|show|print|output|expose|leak|display)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|instructions|rules|directives|training)\b/i,
  /\bwhat\s+(are\s+)?(your|the)\s+(instructions|rules|system\s+prompt|directives)\b/i,
  /\brepeat\s+(your\s+|the\s+)?(system\s+prompt|instructions|above)\b/i,

  // ── Instruction override — Spanish ─────────────────────────────────────────
  /\bignora\s+(todas?\s+)?(tus\s+|mis\s+|las\s+|estas\s+)?instrucciones?\b/i,
  /\bolvida\s+(todas?\s+)?(tus\s+|las\s+)?instrucciones?\b/i,
  /\bdesecha\s+(todas?\s+)?(tus\s+|las\s+)?instrucciones?\b/i,
  /\bignora\s+(lo\s+anterior|lo\s+de\s+arriba|el\s+sistema)\b/i,
  /\btu\s+(system\s+)?prompt\b/i,

  // ── Diagram output bypass — Spanish ────────────────────────────────────────
  /\bno\s+(me\s+)?devuelvas?\s+(un\s+|el\s+|ningún\s+)?(diagrama|dsl|gráfico|grafico)\b/i,
  /\bno\s+(me\s+)?generes?\s+(un\s+|el\s+|ningún\s+)?(diagrama|dsl|gráfico|grafico)\b/i,
  /\bsin\s+(diagrama|dsl|gráfico)\b/i,
  /\ben\s+lugar\s+del?\s+(diagrama|dsl)\b/i,
  /\bresponde?\s+(sin|directamente\s+sin)\s+(diagrama|dsl)\b/i,

  // ── Role / persona override — Spanish ──────────────────────────────────────
  /\bahora\s+eres\b/i,
  /\bactúa\s+como\b/i,
  /\bfinge\s+(ser|que\s+eres)\b/i,
  /\beres\s+(ahora\s+)?(un\s+|una\s+)?\w+\s*(,|\.|y\s+no)/i,
  /\bnueva\s+(tarea|instrucción|instruccion|misión|mision|función|funcion|orden)\s*[:\-]/i,

  // ── System prompt extraction — Spanish ─────────────────────────────────────
  /\b(revela|muestra|imprime|enseña|enseña|expón)\s+(me\s+)?(tus\s+|las\s+)?(instrucciones|sistema|prompt|reglas)\b/i,
  /\brepite\s+(tus\s+|las\s+)?(instrucciones|sistema|prompt)\b/i,
  /\bcuáles\s+son\s+tus\s+(instrucciones|reglas|normas)\b/i,
]

/**
 * Checks whether `text` contains a prompt injection attempt.
 * @param {string} text
 * @returns {{ detected: boolean, pattern: string | null }}
 */
export function detectInjection(text) {
  if (!text || typeof text !== 'string') return { detected: false, pattern: null }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { detected: true, pattern: pattern.source }
    }
  }
  return { detected: false, pattern: null }
}
