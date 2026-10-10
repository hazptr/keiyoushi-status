const LABEL = { pass: 'Working', fail: 'Failing', untestable: 'Untestable' }
const $ = s => document.querySelector(s)
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  for (const k of kids) e.append(k)
  return e
}
const chip = s => el('span', { class: `chip ${s}` }, LABEL[s] || s)

function detail(x) {
  if (x.status !== 'pass') return [x.step ? `${x.step}: ` : '', x.error || ''].join('')
  const d = x.details || {}
  const parts = []
  if (d.chapters != null) parts.push(`${d.chapters} chapter${d.chapters === 1 ? '' : 's'}`)
  if (d.pages != null) parts.push(`${d.pages} page${d.pages === 1 ? '' : 's'}`)
  if (d.imageFormats?.length) parts.push(d.imageFormats.join(', '))
  return parts.join(' · ')
}

function render(data) {
  $('#meta').textContent = `Last sweep ${data.sweepDate} · keiyoushi main ${data.keiCommit.slice(0, 10)}` +
    (data.previousSweepDate ? ` · compared with ${data.previousSweepDate}` : '')

  const cards = $('#summary')
  for (const s of ['pass', 'fail', 'untestable']) {
    cards.append(el('div', { class: `card ${s}` }, el('div', { class: 'n' }, String(data.counts[s] || 0)), LABEL[s]))
  }

  const ch = $('#changes')
  for (const [key, title] of [['newlyFailing', 'Newly failing'], ['nowPassing', 'Working again']]) {
    const list = data.changes?.[key] || []
    if (!list.length) continue
    ch.append(el('h2', {}, `${title} (${list.length})`))
    ch.append(el('ul', {}, ...list.map(id => el('li', {}, el('a', { href: `#${id}` }, id)))))
  }

  const langs = [...new Set(data.extensions.map(x => x.lang))].sort()
  for (const l of langs) $('#lang').append(el('option', { value: l }, l))

  const tbody = $('#table tbody')
  const rows = data.extensions.map(x => {
    const tr = el('tr', { id: x.id, 'data-status': x.status, 'data-lang': x.lang, 'data-text': `${x.name} ${x.id} ${x.lang}`.toLowerCase() },
      el('td', {}, el('span', { class: 'name' }, x.name), el('br'), el('code', {}, x.id)),
      el('td', {}, x.lang),
      el('td', {}, `1.6.${x.versionCode}`),
      el('td', {}, chip(x.status)),
      el('td', {}, x.since || ''),
      el('td', { class: 'detail' }, detail(x)))
    tbody.append(tr)
    return tr
  })

  const filter = () => {
    const q = $('#q').value.trim().toLowerCase()
    const s = $('#status').value
    const l = $('#lang').value
    for (const tr of rows) {
      tr.hidden = (q && !tr.dataset.text.includes(q)) || (s && tr.dataset.status !== s) || (l && tr.dataset.lang !== l)
    }
  }
  for (const id of ['#q', '#status', '#lang']) $(id).addEventListener('input', filter)
}

fetch('status.json', { cache: 'no-cache' })
  .then(r => r.json())
  .then(render)
  .catch(e => { $('#meta').textContent = `Couldn't load status.json: ${e}` })
