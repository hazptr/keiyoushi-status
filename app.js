const STATUSES = [['', 'All'], ['pass', 'Working'], ['fail', 'Failing'], ['untestable', 'Untestable']]
const LABEL = Object.fromEntries(STATUSES.slice(1))
const $ = s => document.querySelector(s)
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  e.append(...kids)
  return e
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

function detail(x) {
  if (x.status !== 'pass') return [x.step, x.error].filter(Boolean).join(': ')
  const d = x.details || {}
  return [d.chapters != null && plural(d.chapters, 'chapter'), d.pages != null && plural(d.pages, 'page'), d.imageFormats?.join(', ')]
    .filter(Boolean).join(' · ')
}

function render(data) {
  const run = data.inProgress
  $('#meta').textContent = run
    ? `Run in progress, ${run.done} of ${run.total} checked so far (main @ ${data.keiCommit.slice(0, 10)})`
    : `Last run ${data.sweepDate} on main @ ${data.keiCommit.slice(0, 10)}`

  const { newlyFailing = [], nowPassing = [] } = data.changes || {}
  if (newlyFailing.length || nowPassing.length) {
    const link = id => el('a', { href: `#${id}` }, id)
    const part = (label, ids) => ids.length ? [label, ...ids.flatMap((id, i) => i ? [', ', link(id)] : [link(id)])] : []
    $('#changes').append(...part('Broke since last week: ', newlyFailing), ...(newlyFailing.length && nowPassing.length ? ['. '] : []),
      ...part('Working again: ', nowPassing))
    $('#changes').hidden = false
  }

  for (const l of [...new Set(data.extensions.map(x => x.lang))].sort()) $('#lang').append(el('option', { value: l }, l))

  const total = data.extensions.length
  const pills = STATUSES.map(([value, label]) => {
    const n = value ? data.counts[value] || 0 : total
    const b = el('button', { type: 'button', 'data-status': value, 'aria-pressed': 'false' },
      value ? el('span', { class: `dot ${value}` }) : '', label, el('span', { class: 'n' }, String(n)))
    b.addEventListener('click', () => { state.status = value; apply() })
    $('#pills').append(b)
    return b
  })

  const rows = data.extensions.map(x => {
    const li = el('li', { id: x.id },
      el('div', { class: 'row' },
        el('span', { class: 'name' }, x.name),
        el('span', { class: `status ${x.status}` }, el('span', { class: `dot ${x.status}` }), LABEL[x.status])),
      el('div', { class: 'sub muted small' },
        el('code', {}, x.id), el('span', {}, `v1.6.${x.versionCode}`), x.since ? el('span', {}, `since ${x.since}`) : ''),
      ...(detail(x) ? [el('div', { class: `detail small ${x.status}` }, detail(x))] : []))
    $('#list').append(li)
    return { li, x, text: norm(`${x.name} ${x.id} ${x.lang}`) }
  })

  const params = new URLSearchParams(location.search)
  const state = { q: params.get('q') || '', status: params.get('status') || '', lang: params.get('lang') || '' }
  $('#q').value = state.q
  $('#lang').value = state.lang

  function apply() {
    const words = norm(state.q).split(' ').filter(Boolean)
    let shown = 0
    for (const r of rows) {
      const ok = (!state.status || r.x.status === state.status) && (!state.lang || r.x.lang === state.lang) &&
        words.every(w => r.text.includes(w))
      r.li.hidden = !ok
      shown += ok
    }
    for (const b of pills) b.setAttribute('aria-pressed', String(b.dataset.status === state.status))
    $('#count').textContent = shown === total ? plural(total, 'extension') : `${shown} of ${total}`
    $('#empty').hidden = shown > 0
    const p = new URLSearchParams(Object.entries(state).filter(([, v]) => v))
    history.replaceState(null, '', (p.size ? `?${p}` : location.pathname) + location.hash)
  }

  $('#q').addEventListener('input', e => { state.q = e.target.value; apply() })
  $('#lang').addEventListener('change', e => { state.lang = e.target.value; apply() })
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus() }
    if (e.key === 'Escape' && document.activeElement === $('#q')) { state.q = ''; $('#q').value = ''; apply() }
  })
  apply()
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: 'center' })
}

fetch('status.json', { cache: 'no-cache' })
  .then(r => r.json())
  .then(render)
  .catch(() => { $('#meta').textContent = 'Couldnt load the results, try a refresh.' })
