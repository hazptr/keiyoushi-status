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

// One plain sentence per status, for people who don't care about the internals.
const PLAIN_FAIL = {
  popular: 'Cant load its list of titles',
  manga: 'Titles dont open',
  pages: 'Chapters dont open',
  images: 'Pages dont load',
}
function plain(x) {
  if (x.status === 'pass') return 'Loads and reads fine'
  if (x.status === 'fail') return PLAIN_FAIL[x.step] || 'Something in it is broken'
  return x.error || 'Couldnt check this one automatically'
}

function technical(x) {
  const rows = [['Extension', `${x.id} v1.6.${x.versionCode}`]]
  if (x.checkedWith) rows.push(['Checked with', x.checkedWith])
  if (x.status === 'fail') rows.push(['Failing step', x.step || '?'])
  if (x.status === 'untestable') rows.push(['Why', x.error || ''])
  if (x.since) rows.push([`${LABEL[x.status]} since`, x.since])
  return el('dl', {}, ...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]))
}

const LINK_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/></svg>'

function copyButton(x) {
  const b = el('button', { type: 'button', class: 'copy', title: 'Copy link', 'aria-label': `Copy link to ${x.name}` })
  b.innerHTML = LINK_ICON
  b.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#${x.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const t = el('textarea', {}, url)
      document.body.append(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    b.classList.add('done')
    b.textContent = 'Copied'
    setTimeout(() => { b.classList.remove('done'); b.innerHTML = LINK_ICON }, 1500)
  })
  return b
}

function showHash() {
  document.querySelectorAll('li.linked').forEach(l => l.classList.remove('linked'))
  const li = document.getElementById(decodeURIComponent(location.hash.slice(1)))
  if (!li) return
  li.hidden = false
  li.querySelector('details').open = true
  li.classList.remove('flash')
  void li.offsetWidth // restart the animation
  li.classList.add('linked', 'flash')
  li.scrollIntoView({ block: 'center' })
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
    const li = el('li', { id: x.id, class: x.status },
      el('div', { class: 'row' },
        el('span', { class: 'name' }, x.name, copyButton(x)),
        el('span', { class: `status ${x.status}` }, el('span', { class: `dot ${x.status}` }), LABEL[x.status])),
      el('details', { class: 'more small' },
        el('summary', {}, el('span', { class: `plain ${x.status}` }, plain(x)), el('span', { class: 'toggle' }, 'Details')),
        technical(x)),
      ...(x.status === 'fail' && x.error ? [el('div', { class: 'error small' }, x.step ? `${x.step}: ${x.error}` : x.error)] : []))
    $('#list').append(li)
    return { li, x, text: norm(`${x.name} ${x.id} ${x.lang} ${plain(x)} ${x.error || ''}`) }
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
  if (location.hash) showHash()
  window.addEventListener('hashchange', showHash)
}

fetch('status.json', { cache: 'no-cache' })
  .then(r => r.json())
  .then(render)
  .catch(() => { $('#meta').textContent = 'Couldnt load the results, try a refresh.' })
