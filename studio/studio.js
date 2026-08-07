const csrf = document.querySelector('meta[name="blog-studio-csrf"]').content
let accessToken = new URLSearchParams(location.hash.slice(1)).get('token') ?? ''
if (accessToken) history.replaceState(null, '', `${location.pathname}${location.search}`)
const form = document.querySelector('[data-editor]')
const status = document.querySelector('[data-status]')
const preview = document.querySelector('.preview iframe')
const title = form.elements.title
const slug = form.elements.slug
const body = form.elements.body
const cover = form.elements.cover
const coverAlt = form.elements.coverAlt
const bodyCount = document.querySelector('[data-body-count]')
let slugEdited = false
let mediaSlug = ''
let statusTimer
let publishTrackingId = 0
let dirty = false
let revision = null
const mediaExtensions = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

function setStatus(message, error = false, link) {
  status.replaceChildren(document.createTextNode(message))
  status.classList.toggle('is-error', error)
  if (link) {
    const anchor = document.createElement('a')
    anchor.href = link.url
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
    anchor.textContent = link.label
    status.append(' ', anchor)
  }
}

function confirmDiscard() {
  return !dirty || window.confirm('Discard unsaved changes?')
}

function updateBodyCount() {
  const words = body.value.trim() ? body.value.trim().split(/\s+/u).length : 0
  bodyCount.textContent = `${words.toLocaleString('en')} words · ${body.value.length.toLocaleString('en')} / 100,000 chars`
}

function updateCoverValidity() {
  const hasCover = Boolean(cover.value.trim())
  const hasAlt = Boolean(coverAlt.value.trim())
  coverAlt.required = hasCover
  cover.setCustomValidity(hasAlt && !hasCover ? 'Cover path is required when cover alt is set.' : '')
}

window.addEventListener('hashchange', () => {
  const token = new URLSearchParams(location.hash.slice(1)).get('token')
  if (!token) return
  accessToken = token
  history.replaceState(null, '', `${location.pathname}${location.search}`)
  loadLists().then(() => setStatus('Studio unlocked.')).catch((error) => setStatus(error.message, true))
})

function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 80)
}

function syncMediaSlug(nextSlug) {
  if (!nextSlug) return
  if (mediaSlug && nextSlug !== mediaSlug) {
    const currentPrefix = `/blog/media/${mediaSlug}/`
    const nextPrefix = `/blog/media/${nextSlug}/`
    cover.value = cover.value.replaceAll(currentPrefix, nextPrefix)
    body.value = body.value.replaceAll(currentPrefix, nextPrefix)
  }
  mediaSlug = nextSlug
}

function metadata() {
  const value = {
    title: title.value,
    summary: form.elements.summary.value,
    published: form.elements.published.value,
    updated: form.elements.updated.value,
    tags: form.elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
    snapshotDate: form.elements.snapshotDate.value,
    tlp: form.elements.tlp.value,
    sources: form.elements.sources.value.split(/\r?\n/u).map((source) => source.trim()).filter(Boolean),
    cover: form.elements.cover.value,
    coverAlt: form.elements.coverAlt.value,
  }
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== ''))
}

function post() {
  return { slug: slug.value, metadata: metadata(), body: form.elements.body.value }
}

function selectedMedia() {
  const names = new Set()
  return [...form.elements.media.files].map((file) => {
    const extension = mediaExtensions.get(file.type)
    if (!extension) throw new Error(`${file.name} is not a supported image.`)
    const stem = slugify(file.name.replace(/\.[^.]+$/u, '')) || 'image'
    const name = `${stem.slice(0, 80 - extension.length - 1)}.${extension}`
    if (names.has(name)) throw new Error(`More than one image resolves to ${name}.`)
    names.add(name)
    return { file, name }
  })
}

async function media() {
  return Promise.all(selectedMedia().map(async ({ file, name }) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener('load', () => resolve(reader.result), { once: true })
      reader.addEventListener('error', () => reject(reader.error), { once: true })
      reader.readAsDataURL(file)
    })
    return { name, data: String(dataUrl).split(',', 2)[1], dataUrl }
  }))
}

function insertMarkdown(value) {
  const input = body
  const start = input.selectionStart
  const end = input.selectionEnd
  const prefix = start > 0 && input.value[start - 1] !== '\n' ? '\n\n' : ''
  const suffix = end < input.value.length && input.value[end] !== '\n' ? '\n\n' : '\n'
  input.setRangeText(`${prefix}${value}${suffix}`, start, end, 'end')
  input.focus()
  updateBodyCount()
  stopPublishTracking()
  dirty = true
}

function insertMedia() {
  const files = selectedMedia()
  if (!slug.value) throw new Error('Title or slug is required before inserting images.')
  if (!files.length) throw new Error('Select at least one image first.')
  insertMarkdown(files.map(({ name }) => {
    const alt = name.replace(/\.[^.]+$/u, '').replace(/[-_]+/gu, ' ')
    return `![${alt}](/blog/media/${slug.value}/${name})`
  }).join('\n\n'))
  setStatus(`${files.length} image${files.length === 1 ? '' : 's'} inserted; unsaved.`)
}

function insertEmbed(kind) {
  const source = window.prompt(kind === 'video' ? 'YouTube or Vimeo URL' : 'External post URL')
  if (source === null) return
  let url
  try {
    url = new URL(source)
  } catch {
    throw new Error('Embed URL must be valid HTTPS.')
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Embed URL must be valid HTTPS.')
  }
  const entered = window.prompt(kind === 'video' ? 'Video title' : 'Post title')
  if (entered === null) return
  const label = entered.replace(/[\[\]\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim()
  if (!label || label.length > 180) throw new Error('Embed title must be between 1 and 180 characters.')
  insertMarkdown(`![${kind}: ${label}](<${url.href}>)`)
  setStatus(kind === 'video' ? 'Video embedded; unsaved.' : 'Post card inserted; unsaved.')
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'x-blog-studio-token': accessToken,
      ...(options.body ? { 'content-type': 'application/json', 'x-blog-studio-csrf': csrf } : {}),
    },
  })
  const value = await response.json()
  if (!response.ok) {
    const error = new Error(value.error ?? `Request failed (${response.status}).`)
    error.code = value.code
    error.outcomeUnknown = value.outcomeUnknown === true
    error.recovery = value.recovery
    error.status = response.status
    throw error
  }
  return value
}

function busy(value) {
  if (value) form.setAttribute('aria-busy', 'true')
  else form.removeAttribute('aria-busy')
  for (const control of document.querySelectorAll('button, input, select, textarea')) control.disabled = value
}

function stopPublishTracking() {
  clearTimeout(statusTimer)
  publishTrackingId += 1
}

function reset() {
  stopPublishTracking()
  form.reset()
  form.elements.published.value = new Date().toISOString().slice(0, 10)
  slug.readOnly = false
  preview.srcdoc = ''
  slugEdited = false
  mediaSlug = ''
  dirty = false
  revision = null
  updateBodyCount()
  updateCoverValidity()
  setStatus('New draft.')
}

async function loadLists() {
  const lists = await api('/api/posts')
  for (const source of ['drafts', 'published']) {
    const list = document.querySelector(`[data-list="${source}"]`)
    list.replaceChildren(...lists[source].map((entry) => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = entry
      button.addEventListener('click', () => {
        if (confirmDiscard()) loadPost(entry, source === 'drafts' ? 'draft' : 'published')
      })
      item.append(button)
      return item
    }))
  }
}

async function loadPost(postSlug, source) {
  stopPublishTracking()
  busy(true)
  try {
    const loaded = await api(`/api/post?slug=${encodeURIComponent(postSlug)}&source=${source}`)
    const value = loaded.post
    revision = loaded.revision
    for (const field of ['title', 'summary', 'published', 'updated', 'snapshotDate', 'tlp', 'cover', 'coverAlt']) {
      form.elements[field].value = value[field] ?? ''
    }
    form.elements.slug.value = value.slug
    mediaSlug = value.slug
    form.elements.tags.value = value.tags.join(', ')
    form.elements.sources.value = value.sources.join('\n')
    body.value = value.body
    form.elements.media.value = ''
    slug.readOnly = true
    slugEdited = true
    updateBodyCount()
    updateCoverValidity()
    await showPreview()
    dirty = false
    setStatus(`Loaded ${source} post.`)
  } catch (error) {
    setStatus(error.message, true)
  } finally {
    busy(false)
  }
}

async function showPreview() {
  const files = await media()
  const value = await api('/api/preview', { method: 'POST', body: JSON.stringify({ post: post() }) })
  preview.srcdoc = files.reduce((html, file) => html.replaceAll(
    `"/blog/media/${slug.value}/${file.name}"`,
    `"${file.dataUrl}"`,
  ), value.html)
}

async function trackPublish(
  postSlug,
  expectedRevision = revision,
  remaining = 60,
  trackingId = ++publishTrackingId,
) {
  clearTimeout(statusTimer)
  try {
    const value = await api(
      `/api/status?slug=${encodeURIComponent(postSlug)}&revision=${encodeURIComponent(expectedRevision)}`,
    )
    if (trackingId !== publishTrackingId) return
    const pullRequest = value.pullRequest
    if (!pullRequest) {
      setStatus('Publish PR is not visible yet.')
    } else if (pullRequest.state === 'MERGED') {
      setStatus('Published.', false, { url: value.liveUrl, label: 'Open article' })
      return
    } else if (pullRequest.state === 'CLOSED') {
      setStatus('Publish PR was closed.', true, { url: pullRequest.url, label: `PR #${pullRequest.number}` })
      return
    } else {
      const checks = pullRequest.statusCheckRollup ?? []
      const failed = checks.some((check) => ['ACTION_REQUIRED', 'CANCELLED', 'FAILURE', 'TIMED_OUT'].includes(check.conclusion))
      const pending = checks.some((check) => check.status !== 'COMPLETED')
      const message = failed
        ? 'Publish checks failed.'
        : pending
          ? 'Publish checks are running.'
          : 'Publish PR is awaiting merge.'
      setStatus(message, failed, { url: pullRequest.url, label: `PR #${pullRequest.number}` })
    }
  } catch (error) {
    if (trackingId !== publishTrackingId) return
    setStatus(error.message, true)
  }
  if (remaining > 1) {
    statusTimer = setTimeout(() => (
      trackPublish(postSlug, expectedRevision, remaining - 1, trackingId)
    ), 5_000)
  }
}

async function saveDraft() {
  const attemptedPost = post()
  const attemptedMedia = (await media()).map(({ name, data }) => ({ name, data }))
  const attemptedRevision = revision
  let value
  try {
    value = await api('/api/draft', {
      method: 'POST',
      body: JSON.stringify({
        post: attemptedPost,
        media: attemptedMedia,
        expectedRevision: attemptedRevision,
      }),
    })
  } catch (error) {
    value = error.recovery?.draft
    if (!error.status || error.outcomeUnknown) {
      try {
        const recovered = await api('/api/reconcile', {
          method: 'POST',
          body: JSON.stringify({
            post: attemptedPost,
            media: attemptedMedia,
            expectedRevision: attemptedRevision,
          }),
        })
        if (recovered && !recovered.published) value = { sha: recovered.revision }
      } catch {}
    }
    if (!value?.sha) throw error
  }
  revision = value.sha
  setStatus(`Draft saved at ${value.sha.slice(0, 8)}.`)
  slug.readOnly = true
  slugEdited = true
  dirty = false
  await loadLists()
}

async function reconcilePublishFailure(
  attemptedPost,
  attemptedMedia,
  attemptedRevision,
  error,
) {
  const uncertainOutcome = !error.status || error.outcomeUnknown
  let recovered
  if (uncertainOutcome) {
    try {
      recovered = await api('/api/reconcile', {
        method: 'POST',
        body: JSON.stringify({
          post: attemptedPost,
          media: attemptedMedia,
          expectedRevision: attemptedRevision,
        }),
      })
    } catch {
      recovered = undefined
    }
  }
  if (!recovered && error.recovery?.draft) {
    recovered = {
      branch: error.recovery.draft.branch,
      publicationPending: error.recovery.publicationPending === true,
      published: false,
      pullRequest: null,
      revision: error.recovery.draft.sha,
    }
  }
  if (!recovered?.revision) return undefined

  revision = recovered.revision
  dirty = false
  slug.readOnly = true
  slugEdited = true
  if (recovered.published || recovered.pullRequest) {
    return { ...recovered, uncertainOutcome }
  }
  try {
    const status = await api(
      `/api/status?slug=${encodeURIComponent(attemptedPost.slug)}&revision=${encodeURIComponent(revision)}`,
    )
    return {
      ...status,
      publicationPending: recovered.publicationPending,
      revision,
      uncertainOutcome,
    }
  } catch {
    return { ...recovered, uncertainOutcome }
  }
}

async function publish() {
  if (!form.elements.published.value) throw new Error('Published date is required.')
  if (!window.confirm(`Publish ${title.value}?`)) return
  const attemptedPost = post()
  const attemptedMedia = (await media()).map(({ name, data }) => ({ name, data }))
  const attemptedRevision = revision
  let value
  try {
    value = await api('/api/publish', {
      method: 'POST',
      body: JSON.stringify({
        post: attemptedPost,
        media: attemptedMedia,
        expectedRevision: attemptedRevision,
      }),
    })
  } catch (error) {
    const recovered = await reconcilePublishFailure(
      attemptedPost,
      attemptedMedia,
      attemptedRevision,
      error,
    )
    if (recovered?.published) {
      setStatus('Published.', false, { url: recovered.liveUrl, label: 'Open article' })
      return
    }
    if (recovered?.pullRequest) {
      setStatus('Publish result recovered.', false, {
        url: recovered.pullRequest.url,
        label: `PR #${recovered.pullRequest.number}`,
      })
      await trackPublish(attemptedPost.slug, revision)
      return
    }
    if (recovered?.uncertainOutcome || recovered?.publicationPending) {
      setStatus('Draft recovered; checking publication status.')
      await trackPublish(attemptedPost.slug, revision)
      return
    }
    if (recovered) {
      error.message = `Draft saved, but publication did not complete. ${error.message}`
    }
    throw error
  }
  const result = value.published
  revision = result.alreadyPublished ? value.draft.sha : result.sha
  dirty = false
  if (result.alreadyPublished) {
    setStatus('Published.', false, { url: result.liveUrl, label: 'Open article' })
    return
  }
  const message = result.autoMergeQueued
    ? 'Publish PR created; merge is queued.'
    : 'Publish PR created; merge it after checks pass.'
  setStatus(message, false, { url: result.pullRequest.url, label: `PR #${result.pullRequest.number}` })
  await trackPublish(post().slug, revision)
}

async function act(action) {
  if (['preview', 'save', 'publish'].includes(action) && !form.reportValidity()) {
    setStatus('Complete the highlighted required fields.', true)
    return
  }
  busy(true)
  try {
    if (action === 'insert-media') insertMedia()
    if (action === 'embed-video') insertEmbed('video')
    if (action === 'embed-post') insertEmbed('post')
    if (action === 'preview') await showPreview()
    if (action === 'save') await saveDraft()
    if (action === 'publish') await publish()
  } catch (error) {
    setStatus(error.message, true)
  } finally {
    busy(false)
  }
}

title.addEventListener('input', () => {
  if (!slugEdited) {
    slug.value = slugify(title.value)
    syncMediaSlug(slug.value)
  }
})
slug.addEventListener('input', () => {
  syncMediaSlug(slug.value)
  slugEdited = true
})
form.addEventListener('input', () => {
  updateBodyCount()
  updateCoverValidity()
  stopPublishTracking()
  dirty = true
  setStatus('Unsaved changes.')
})
form.elements.media.addEventListener('change', () => {
  try {
    const files = selectedMedia()
    if (files.length === 1 && slug.value && !form.elements.cover.value) {
      form.elements.cover.value = `/blog/media/${slug.value}/${files[0].name}`
    }
    updateCoverValidity()
    setStatus(files.length
      ? `${files.length} image${files.length === 1 ? '' : 's'} ready; save to persist.`
      : 'No images selected.')
  } catch (error) {
    setStatus(error.message, true)
  }
})
document.querySelector('[data-action="new"]').addEventListener('click', () => {
  if (confirmDiscard()) reset()
})
document.querySelector('[data-action="refresh"]').addEventListener('click', () => loadLists().catch((error) => setStatus(error.message, true)))
for (const action of ['insert-media', 'embed-video', 'embed-post', 'preview', 'save', 'publish']) {
  document.querySelector(`[data-action="${action}"]`).addEventListener('click', () => act(action))
}

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return
  event.preventDefault()
  event.returnValue = ''
})
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
  event.preventDefault()
  const save = document.querySelector('[data-action="save"]')
  if (!save.disabled) act('save')
})

reset()
loadLists().catch((error) => setStatus(error.message, true))