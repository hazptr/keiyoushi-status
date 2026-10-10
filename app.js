const STATUSES = [['', 'All'], ['pass', 'Working'], ['partial', 'Partly working'], ['fail', 'Not working'], ['untestable', 'Untestable']]
const LABEL = Object.fromEntries(STATUSES.slice(1))
const $ = s => document.querySelector(s)
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  e.append(...kids)
  return e
}
// Chrome rejects dateStyle/timeStyle together with timeZoneName, so spell the fields out.
const when = iso => new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(iso))
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// What each operation is called, and what a failure of it means, for people who don't care about the internals.
const OPS = {
  browse: ['Browse', 'Cant load its list of titles'],
  latest: ['Latest updates', 'Latest updates dont load'],
  search: ['Search', 'Search doesnt work'],
  details: ['Open a title', 'Titles dont open'],
  chapters: ['Chapter list', 'Chapter lists dont load'],
  read: ['Open a chapter', 'Chapters dont open'],
  pages: ['Load pages', 'Pages dont load'],
}
const OP_STATUS = { pass: 'Works', fail: 'Fails', skip: 'Not checked', untestable: 'Couldnt check' }

function plain(x) {
  if (x.status === 'pass') return 'Loads and reads fine'
  if (x.status === 'partial' || x.status === 'fail') {
    const failed = (x.ops || []).filter(o => o.status === 'fail').map(o => OPS[o.op]?.[1] || o.op)
    if (failed.length) return failed.join(', ')
    return x.step ? (OPS[x.step]?.[1] || 'Something in it is broken') : 'Something in it is broken'
  }
  return x.error || 'Couldnt check this one automatically'
}

function technical(x) {
  const rows = [['Extension', `${x.id} v1.6.${x.versionCode}`]]
  if (x.checkedWith) rows.push(['Checked with', x.checkedWith])
  if (x.checked) rows.push(['Checked', when(x.checked)])
  if (x.since) rows.push([`${LABEL[x.status]} since`, x.since])
  const dl = el('dl', {}, ...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]))
  if (!x.ops?.length) return dl
  const ops = el('ul', { class: 'ops' }, ...x.ops.map(o => el('li', {},
    el('span', { class: `dot ${o.status === 'skip' ? 'skip' : o.status === 'untestable' ? 'untestable' : o.status}` }),
    el('span', { class: 'op' }, OPS[o.op]?.[0] || o.op),
    el('span', { class: `opstatus ${o.status}` }, OP_STATUS[o.status] || o.status),
    ...(o.error || o.reason ? [el('span', { class: 'operr' }, o.error || o.reason)] : []))))
  return el('div', {}, ops, dl)
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
  const content = document.getElementById('content')
  if (li.dataset.nsfw === '1' && content.value === '') { content.value = 'all'; content.dispatchEvent(new Event('change')) }
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
    ? `Run in progress, ${run.done} of ${run.total} checked so far, updated ${when(data.generated)} (main @ ${data.keiCommit.slice(0, 10)})`
    : `Last run ${when(data.generated)} on main @ ${data.keiCommit.slice(0, 10)}`

  const nsfwIds = new Set(data.extensions.filter(x => x.contentWarning === 'NSFW').map(x => x.id))
  function renderChanges(showNsfw) {
    const keep = ids => ids.filter(id => showNsfw || !nsfwIds.has(id))
    const { newlyFailing = [], nowPassing = [] } = data.changes || {}
    const broke = keep(newlyFailing), fixed = keep(nowPassing)
    const link = id => el('a', { href: `#${id}` }, id)
    const part = (label, ids) => ids.length ? [label, ...ids.flatMap((id, i) => i ? [', ', link(id)] : [link(id)])] : []
    $('#changes').replaceChildren(...part('Broke since last week: ', broke), ...(broke.length && fixed.length ? ['. '] : []),
      ...part('Working again: ', fixed))
    $('#changes').hidden = !(broke.length || fixed.length)
  }

  for (const l of [...new Set(data.extensions.map(x => x.lang))].sort()) $('#lang').append(el('option', { value: l }, l))

  const pills = STATUSES.map(([value, label]) => {
    const b = el('button', { type: 'button', 'data-status': value, 'aria-pressed': 'false' },
      value ? el('span', { class: `dot ${value}` }) : '', label, el('span', { class: 'n' }, ''))
    b.addEventListener('click', () => { state.status = value; apply() })
    $('#pills').append(b)
    return b
  })

  const rows = data.extensions.map(x => {
    const li = el('li', { id: x.id, class: x.status, 'data-nsfw': x.contentWarning === 'NSFW' ? '1' : '0' },
      el('div', { class: 'row' },
        el('span', { class: 'name' }, x.name, copyButton(x)),
        el('span', { class: `status ${x.status}` }, el('span', { class: `dot ${x.status}` }), LABEL[x.status])),
      el('details', { class: 'more small' },
        el('summary', {}, el('span', { class: `plain ${x.status}` }, plain(x)), el('span', { class: 'toggle' }, 'Details')),
        technical(x)),
      ...((x.status === 'fail' || x.status === 'partial')
        ? (x.ops || []).filter(o => o.status === 'fail').map(o => el('div', { class: 'error small' }, `${OPS[o.op]?.[0] || o.op}: ${o.error}`))
        : []))
    $('#list').append(li)
    return { li, x, nsfw: x.contentWarning === 'NSFW', text: norm(`${x.name} ${x.id} ${x.lang} ${plain(x)} ${x.error || ''} ${(x.ops || []).map(o => o.error || '').join(' ')}`) }
  })

  const params = new URLSearchParams(location.search)
  const state = { q: params.get('q') || '', status: params.get('status') || '', lang: params.get('lang') || '',
    content: ['all', 'nsfw'].includes(params.get('content')) ? params.get('content') : '' }
  $('#q').value = state.q
  $('#lang').value = state.lang
  $('#content').value = state.content

  const contentOk = r => state.content === 'all' || (state.content === 'nsfw' ? r.nsfw : !r.nsfw)
  const langOk = r => !state.lang || r.x.lang === state.lang
  const statusOk = r => !state.status || r.x.status === state.status

  function apply() {
    const words = norm(state.q).split(' ').filter(Boolean)
    const searchOk = r => words.every(w => r.text.includes(w))
    renderChanges(state.content !== '')
    let shown = 0
    for (const r of rows) {
      const ok = contentOk(r) && langOk(r) && statusOk(r) && searchOk(r)
      r.li.hidden = !ok
      shown += ok
    }
    // Counts follow everything except the status pills themselves.
    const pool = rows.filter(r => contentOk(r) && langOk(r) && searchOk(r))
    for (const b of pills) {
      b.setAttribute('aria-pressed', String(b.dataset.status === state.status))
      b.querySelector('.n').textContent = String(b.dataset.status ? pool.filter(r => r.x.status === b.dataset.status).length : pool.length)
    }
    const total = rows.filter(r => contentOk(r) && langOk(r)).length
    $('#count').textContent = shown === total ? plural(total, 'extension') : `${shown} of ${total}`
    // A search that matches things the other filters hide says so, with a way to show them.
    const hidden = words.length ? rows.filter(r => searchOk(r) && !(contentOk(r) && langOk(r) && statusOk(r))).length : 0
    const hint = $('#hidden-hint')
    hint.hidden = hidden === 0
    if (hidden) {
      const show = el('a', { href: '#' }, 'Show them')
      show.addEventListener('click', e => {
        e.preventDefault()
        Object.assign(state, { status: '', lang: '', content: 'all' })
        $('#lang').value = ''; $('#content').value = 'all'
        apply()
      })
      hint.replaceChildren(`${hidden} more match "${state.q.trim()}" but your filters hide ${hidden === 1 ? 'it' : 'them'}. `, show)
    }
    $('#empty').hidden = shown > 0 || hidden > 0
    const p = new URLSearchParams(Object.entries(state).filter(([, v]) => v))
    history.replaceState(null, '', (p.size ? `?${p}` : location.pathname) + location.hash)
  }

  $('#q').addEventListener('input', e => { state.q = e.target.value; apply() })
  $('#lang').addEventListener('change', e => { state.lang = e.target.value; apply() })
  $('#content').addEventListener('change', e => { state.content = e.target.value; apply() })
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
  .catch(() => null)
  .then(data => {
    if (!data) { $('#meta').textContent = 'Couldnt load the results, try a refresh.'; return }
    render(data)
  })
