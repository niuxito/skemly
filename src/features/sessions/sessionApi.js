// ─── DB helpers (pro/starter users) ───────────────────────────────────────────
// Auth is handled via HttpOnly cookie — no manual token needed.

export async function postSessionToDB(session) {
  await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: session.id,
      title: session.title,
      dsl: session.dsl,
      messages: session.messages,
      chatHistory: session.chatHistory,
      titleManual: session.titleManual,
    }),
  })
}

export async function putSessionToDB(session) {
  await fetch(`/api/sessions?id=${encodeURIComponent(session.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: session.title,
      dsl: session.dsl,
      messages: session.messages,
      chatHistory: session.chatHistory,
      titleManual: session.titleManual,
    }),
  })
}

export async function deleteSessionFromDB(id) {
  await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}
