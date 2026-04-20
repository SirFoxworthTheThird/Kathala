import { db } from '@/db/database'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br>')
}

function section(id: string, title: string, body: string): string {
  return `<section id="${id}"><h2>${esc(title)}</h2>${body}</section>`
}

const CSS = `
  :root { --bg:#0f0f0f; --surface:#1a1a1a; --border:#2a2a2a; --fg:#e8e8e8; --muted:#888; --accent:#7c6af7; }
  @media(prefers-color-scheme:light){:root{--bg:#f8f8f8;--surface:#fff;--border:#e0e0e0;--fg:#111;--muted:#666;--accent:#5b4fe8;}}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;font-size:15px}
  a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
  nav{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--border);padding:.5rem 1.5rem;display:flex;gap:1.5rem;font-size:.8rem;z-index:10}
  .wrap{max-width:860px;margin:0 auto;padding:2rem 1.5rem}
  h1{font-size:1.8rem;font-weight:700;margin-bottom:.25rem}
  h2{font-size:1.1rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:2.5rem 0 1rem;padding-bottom:.4rem;border-bottom:1px solid var(--border)}
  h3{font-size:1rem;font-weight:600;margin-bottom:.25rem}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:1rem 1.25rem;margin-bottom:.75rem}
  .card p{color:var(--muted);font-size:.875rem;margin-top:.35rem}
  .meta{font-size:.75rem;color:var(--muted);margin-top:.4rem}
  .tag{display:inline-block;background:var(--border);border-radius:4px;padding:.1rem .45rem;font-size:.7rem;margin:.15rem .1rem}
  .badge{display:inline-block;padding:.1rem .5rem;border-radius:999px;font-size:.7rem;font-weight:600}
  .badge-alive{background:#1a3a1a;color:#4ade80} .badge-dead{background:#3a1a1a;color:#f87171}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.75rem}
  .chapter{border-left:3px solid var(--accent);padding-left:1rem;margin-bottom:1.5rem}
  .event{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:.75rem 1rem;margin:.5rem 0;font-size:.875rem}
  .event h4{font-size:.875rem;font-weight:600;margin-bottom:.2rem}
  .footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.75rem;color:var(--muted);text-align:center}
  .lore-cat{margin-bottom:2rem} .lore-cat-title{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:.5rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)}
  .lore-body{font-size:.875rem;white-space:pre-wrap;line-height:1.7;margin-top:.5rem}
  .lore-body h1,.lore-body h2,.lore-body h3{font-weight:600;margin:.75rem 0 .25rem}
  .lore-body blockquote{border-left:3px solid var(--border);padding-left:.75rem;color:var(--muted);font-style:italic}
`

export async function exportWorldAsHtml(worldId: string): Promise<void> {
  const [
    world, characters, items, locationMarkers,
    timelines, chapters, events, relationships,
    loreCategories, lorePages,
  ] = await Promise.all([
    db.worlds.get(worldId),
    db.characters.where('worldId').equals(worldId).toArray(),
    db.items.where('worldId').equals(worldId).toArray(),
    db.locationMarkers.where('worldId').equals(worldId).toArray(),
    db.timelines.where('worldId').equals(worldId).toArray(),
    db.chapters.where('worldId').equals(worldId).toArray(),
    db.events.where('worldId').equals(worldId).toArray(),
    db.relationships.where('worldId').equals(worldId).toArray(),
    db.loreCategories.where('worldId').equals(worldId).sortBy('sortOrder'),
    db.lorePages.where('worldId').equals(worldId).sortBy('updatedAt'),
  ])

  if (!world) throw new Error('World not found')

  const charById = new Map(characters.map((c) => [c.id, c]))
  const itemById = new Map(items.map((i) => [i.id, i]))

  // ── Overview ────────────────────────────────────────────────────────────────
  const overviewHtml = section('overview', 'Overview', `
    <div class="card">
      ${world.description ? `<p>${nl2br(world.description)}</p>` : '<p><em>No description.</em></p>'}
      <div class="meta">Exported ${new Date().toLocaleString()}</div>
    </div>`)

  // ── Characters ──────────────────────────────────────────────────────────────
  const charCards = characters.map((c) => `
    <div class="card">
      <h3>${esc(c.name)}
        <span class="badge ${c.isAlive ? 'badge-alive' : 'badge-dead'}">${c.isAlive ? 'alive' : 'deceased'}</span>
      </h3>
      ${c.aliases.length ? `<div class="meta">Also known as: ${c.aliases.map(esc).join(', ')}</div>` : ''}
      ${c.description ? `<p>${nl2br(c.description)}</p>` : ''}
      ${c.tags.length ? `<div>${c.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`).join('')
  const charsHtml = section('characters', `Characters (${characters.length})`, `<div class="grid">${charCards}</div>`)

  // ── Timeline ────────────────────────────────────────────────────────────────
  const timelinesSorted = timelines.sort((a, b) => a.name.localeCompare(b.name))
  const tlHtml = timelinesSorted.map((tl) => {
    const tlChapters = chapters
      .filter((c) => c.timelineId === tl.id)
      .sort((a, b) => a.number - b.number)

    const chapHtml = tlChapters.map((ch) => {
      const chEvents = events
        .filter((e) => e.chapterId === ch.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const evHtml = chEvents.map((ev) => {
        const chars = ev.involvedCharacterIds
          .map((id) => charById.get(id)?.name)
          .filter((n): n is string => !!n)
        const itms = ev.involvedItemIds
          .map((id) => itemById.get(id)?.name)
          .filter((n): n is string => !!n)
        return `<div class="event">
          ${ev.title ? `<h4>${esc(ev.title)}</h4>` : ''}
          ${ev.description ? `<p>${nl2br(ev.description)}</p>` : ''}
          ${chars.length ? `<div class="meta">Characters: ${chars.map(esc).join(', ')}</div>` : ''}
          ${itms.length  ? `<div class="meta">Items: ${itms.map(esc).join(', ')}</div>` : ''}
        </div>`
      }).join('')

      return `<div class="chapter">
        <h3>Ch. ${ch.number} — ${esc(ch.title)}</h3>
        ${ch.synopsis ? `<p style="font-size:.875rem;color:var(--muted);margin:.25rem 0">${nl2br(ch.synopsis)}</p>` : ''}
        ${evHtml}
      </div>`
    }).join('')

    return `<div style="margin-bottom:2rem">
      <h3 style="color:var(--accent);margin-bottom:.75rem">${esc(tl.name)}</h3>
      ${chapHtml || '<p style="color:var(--muted);font-size:.875rem">No chapters yet.</p>'}
    </div>`
  }).join('')
  const timelineHtml = section('timeline', 'Timeline', tlHtml || '<p>No timelines.</p>')

  // ── Locations ───────────────────────────────────────────────────────────────
  const locCards = locationMarkers.map((l) => `
    <div class="card">
      <h3>${esc(l.name)}</h3>
      ${l.description ? `<p>${nl2br(l.description)}</p>` : ''}
      ${l.tags.length ? `<div>${l.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`).join('')
  const locsHtml = section('locations', `Locations (${locationMarkers.length})`,
    locationMarkers.length ? `<div class="grid">${locCards}</div>` : '<p>No locations.</p>')

  // ── Items ───────────────────────────────────────────────────────────────────
  const itemCards = items.map((i) => `
    <div class="card">
      <h3>${esc(i.name)}</h3>
      ${i.description ? `<p>${nl2br(i.description)}</p>` : ''}
      ${i.tags.length ? `<div>${i.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`).join('')
  const itemsHtml = section('items', `Items (${items.length})`,
    items.length ? `<div class="grid">${itemCards}</div>` : '<p>No items.</p>')

  // ── Lore ────────────────────────────────────────────────────────────────────
  const catById = new Map(loreCategories.map((c) => [c.id, c]))
  // Group pages by category, uncategorised last
  const pagesByCat = new Map<string | null, typeof lorePages>()
  for (const p of [...lorePages].reverse()) { // reverse so newest first
    const key = p.categoryId ?? null
    const arr = pagesByCat.get(key) ?? []
    arr.push(p)
    pagesByCat.set(key, arr)
  }
  const loreOrder: (string | null)[] = [
    ...loreCategories.map((c) => c.id),
    null,
  ]
  const loreBlocks = loreOrder
    .filter((key) => pagesByCat.has(key))
    .map((catId) => {
      const cat = catId ? catById.get(catId) : null
      const catLabel = cat ? esc(cat.name) : 'Uncategorised'
      const pages = pagesByCat.get(catId) ?? []
      const pageCards = pages.map((p) => {
        const bodyHtml = esc(p.body)
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        return `<div class="card">
          <h3>${esc(p.title)}</h3>
          ${p.tags.length ? `<div>${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          ${p.body ? `<div class="lore-body">${bodyHtml}</div>` : ''}
        </div>`
      }).join('')
      return `<div class="lore-cat">
        <div class="lore-cat-title">${catLabel}</div>
        ${pageCards}
      </div>`
    }).join('')
  const loreHtml = section('lore', `Lore (${lorePages.length})`,
    lorePages.length ? loreBlocks : '<p>No lore pages.</p>')

  // ── Relationships ───────────────────────────────────────────────────────────
  const relRows = relationships.map((r) => {
    const a = charById.get(r.characterAId)?.name ?? '?'
    const b = charById.get(r.characterBId)?.name ?? '?'
    return `<div class="card">
      <h3>${esc(a)} ${r.isBidirectional ? '↔' : '→'} ${esc(b)}</h3>
      ${r.label ? `<div class="meta">${esc(r.label)} · ${esc(r.strength)} · ${esc(r.sentiment)}</div>` : ''}
      ${r.description ? `<p>${nl2br(r.description)}</p>` : ''}
    </div>`
  }).join('')
  const relsHtml = section('relationships', `Relationships (${relationships.length})`,
    relationships.length ? relRows : '<p>No relationships.</p>')

  // ── Nav ─────────────────────────────────────────────────────────────────────
  const nav = `<nav>
    <strong>${esc(world.name)}</strong>
    <a href="#overview">Overview</a>
    <a href="#characters">Characters</a>
    <a href="#timeline">Timeline</a>
    <a href="#locations">Locations</a>
    <a href="#items">Items</a>
    <a href="#lore">Lore</a>
    <a href="#relationships">Relationships</a>
  </nav>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(world.name)} — PlotWeave</title>
<style>${CSS}</style>
</head>
<body>
${nav}
<div class="wrap">
  <h1>${esc(world.name)}</h1>
  ${overviewHtml}
  ${charsHtml}
  ${timelineHtml}
  ${locsHtml}
  ${itemsHtml}
  ${loreHtml}
  ${relsHtml}
  <div class="footer">Generated by <strong>PlotWeave</strong> · ${new Date().toLocaleDateString()}</div>
</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${world.name.replace(/[^a-z0-9]/gi, '_')}.html`
  a.click()
  URL.revokeObjectURL(url)
}
