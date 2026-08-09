import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import profile from '../src/profile.js'

const achievementCount = profile.achievements.length
const instrumentedAchievementCount = profile.achievements.filter(({ instrument }) => instrument).length
const staticAchievementCount = achievementCount - instrumentedAchievementCount

async function currentQuote(page) {
  return (await page.locator('.identity-card__quote').textContent()).trim()
}

async function expectDossierDrawer(page) {
  // a settle-wait, not a performance budget: at 12x CPU throttle the drawer
  // still lands correctly but takes ~8s, which flaked the default 5s poll
  await expect.poll(() => page.locator('.credential-card__drawer').evaluate((drawer) => {
    const style = getComputedStyle(drawer)
    return style.opacity === '1'
      && style.visibility === 'visible'
      && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform)
  }), { timeout: 20000 }).toBe(true)
}

async function revealAchievementStage(page) {
  await page.locator('.achievement-deck').scrollIntoViewIfNeeded()
  return page.locator('.achievement-stage')
}

test('outcome claims expose their résumé evidence', async ({ page }) => {
  await page.goto('/')

  const links = page.locator('a.achievement-card')
  await expect(links).toHaveCount(profile.achievements.length)
  expect(await links.evaluateAll((elements) => elements.map((link) => ({
    href: link.getAttribute('href'),
    label: link.getAttribute('aria-label'),
    target: link.getAttribute('target'),
  })))).toEqual(profile.achievements.map((achievement) => ({
    href: achievement.evidenceHref,
    label: `${achievement.evidenceLabel}: ${achievement.title}`,
    target: '_blank',
  })))
  await expect(page.locator('.achievement-card__copy b').last()).toHaveText('5 days')
  await expect(page.locator('.achievement-card__topline small').first()).toHaveText('Résumé / 01')
  await expect(page.locator('.achievement-card__evidence')).toHaveCount(0)
  expect(await links.evaluateAll((elements) => elements.every((link) => (
    getComputedStyle(link).textDecorationLine === 'none'
  )))).toBe(true)
  await expect(page.locator('.achievement-deck__header > div > p')).toHaveText('Outcome records / 04')
})

async function expectEssentialProfileFallback(page) {
  const fallback = page.locator('#app .no-script')
  await expect(page.locator('#app')).toHaveAttribute('data-app-state', 'failed', { timeout: 5_000 })
  await expect(fallback.getByRole('heading', { name: 'Mohit Sharma' })).toBeVisible()
  await expect(fallback).toContainText('Security Researcher at Microsoft')
  await expect(fallback).toContainText('interactive portfolio is unavailable')
  await expect(fallback.getByRole('link', { name: 'Résumé' })).toHaveAttribute('href', '/Mohit-Sharma-Resume.pdf')
  await expect(fallback.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog/')
  await expect(fallback.getByRole('link', { name: 'Email' })).toHaveAttribute(
    'href',
    'https://mail.google.com/mail/?view=cm&fs=1&to=rinz0x0cruz%40gmail.com',
  )
}

test('the static page identifies itself to search and social crawlers', async ({ page }) => {
  await page.goto('/')

  const description = 'Mohit Sharma is a Microsoft security researcher focused on vulnerability intelligence, threat hunting, detection coverage, and security controls.'
  await expect(page).toHaveTitle('Mohit Sharma — Security Researcher')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://rinz0x0cruz.github.io/',
  )
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.png')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('type', 'image/png')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('sizes', '192x192')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Mohit Sharma — Security Researcher',
  )
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    description,
  )
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://rinz0x0cruz.github.io/',
  )
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://rinz0x0cruz.github.io/social-card.jpg',
  )
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg')
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630')
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  )

  const profilePage = JSON.parse(
    await page.locator('script[type="application/ld+json"]').textContent(),
  )
  expect(profilePage).toMatchObject({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: 'https://rinz0x0cruz.github.io/',
    mainEntity: {
      '@type': 'Person',
      '@id': 'https://rinz0x0cruz.github.io/#mohit-sharma',
      name: 'Mohit Sharma',
      alternateName: 'rinz0x0cruz',
      url: 'https://rinz0x0cruz.github.io/',
      image: 'https://rinz0x0cruz.github.io/portrait-sketch.webp',
      jobTitle: 'Security Researcher',
      sameAs: [
        'https://github.com/rinz0x0cruz',
        'https://www.linkedin.com/in/rinz0x0cruz/',
      ],
    },
  })
})

test('recruiter navigation traverses the portfolio and frames opened profile links', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const index = page.locator('.recruiter-nav')
  const sections = page.getByRole('navigation', { name: 'Portfolio sections' })
  const sectionLinks = sections.getByRole('link')
  await expect(index).toBeVisible()
  await expect(sectionLinks).toHaveCount(5)
  expect(await sectionLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual([
    '#outcomes',
    '#experience',
    '#projects',
    '#languages',
    '#credentials',
  ])

  await sections.getByRole('link', { name: 'Experience' }).click()
  await expect(page).toHaveURL(/#experience$/u)
  expect(await page.evaluate(() => {
    const navigation = document.querySelector('.recruiter-nav').getBoundingClientRect()
    const section = document.querySelector('#experience').getBoundingClientRect()
    return {
      belowNavigation: section.top >= navigation.bottom - 1,
      nearNavigation: section.top - navigation.bottom <= 16,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    }
  })).toEqual({ belowNavigation: true, nearNavigation: true, overflowX: 0 })

  await page.getByRole('link', { name: 'Mohit Sharma, portfolio overview' }).click()
  const toggle = page.locator('.credential-card__turn')
  const before = await page.evaluate(() => scrollY)
  await toggle.click()
  await expectDossierDrawer(page)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)

  expect(await page.evaluate(() => {
    const navigation = document.querySelector('.recruiter-nav').getBoundingClientRect()
    const drawer = document.querySelector('.credential-card__drawer').getBoundingClientRect()
    return {
      belowNavigation: drawer.top >= navigation.bottom,
      fullyVisible: drawer.bottom <= innerHeight,
    }
  })).toEqual({ belowNavigation: true, fullyVisible: true })

  await page.keyboard.press('Escape')
  const navigationToggle = page.locator('.recruiter-nav__links')
  await navigationToggle.click()
  await expectDossierDrawer(page)
  await page.keyboard.press('Escape')
  await expect(navigationToggle).toBeFocused()
})

test('opening and refreshing never exposes a partially loaded identity', async ({ page }) => {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  let resourceGate = Promise.resolve()
  let releaseResources = () => {}

  await page.route(/Danviska-Regular\.woff2|avatar-interactive-person\.webp|avatar-yokai-mask-.*\.svg/u, async (route) => {
    const gate = resourceGate
    await gate
    await route.continue()
  })

  const verifyNavigation = async (navigate) => {
    resourceGate = new Promise((resolve) => { releaseResources = resolve })
    await navigate()

    await expect(page.locator('#app')).toHaveAttribute('data-app-state', 'ready')
    const portfolio = page.locator('.portfolio')
    const identity = page.locator('.scene__content')
    await expect(portfolio).toHaveAttribute('aria-busy', 'true')
    await expect(portfolio).not.toHaveClass(/portfolio--critical-ready/)
    await expect(identity).toHaveCSS('visibility', 'hidden')
    await expect(identity).toHaveCSS('opacity', '0')

    releaseResources()
    await expect(portfolio).toHaveClass(/portfolio--critical-ready/)
    await expect(portfolio).toHaveAttribute('aria-busy', 'false')
    await expect(identity).toHaveCSS('visibility', 'visible')
    await expect(identity).toHaveCSS('opacity', '1')
    expect(await page.evaluate(() => ({
      fontReady: document.fonts.check('400 1rem "Danviska"'),
      imagesReady: [
        document.querySelector('.identity-avatar__person'),
        document.querySelector('.identity-avatar__mask-art'),
      ].every((image) => image.complete && image.naturalWidth > 0),
    }))).toEqual({ fontReady: true, imagesReady: true })
  }

  await verifyNavigation(() => page.goto('/', { waitUntil: 'domcontentloaded' }))
  await verifyNavigation(() => page.reload({ waitUntil: 'domcontentloaded' }))
})

test('a stalled critical asset cannot hide the identity indefinitely', async ({ page }) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = function decodeWithStalledMask() {
      if (this.src.includes('avatar-yokai-mask')) return new Promise(() => {})
      return decode.call(this)
    }
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const portfolio = page.locator('.portfolio')
  await expect(portfolio).toHaveAttribute('aria-busy', 'true')
  await expect(portfolio).toHaveAttribute('data-critical-state', 'loading')
  await expect(portfolio).toHaveClass(/portfolio--critical-ready/, { timeout: 5_000 })
  await expect(portfolio).toHaveAttribute('aria-busy', 'false')
  await expect(portfolio).toHaveAttribute('data-critical-state', 'timed-out')
  await expect(page.locator('.scene__content')).toHaveCSS('visibility', 'visible')
})

test('essential profile links survive an enabled-JavaScript boot failure', async ({ page }) => {
  await page.route(/\/assets\/index-.*\.js(?:\?|$)/u, (route) => route.abort('failed'))
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const fallback = page.locator('#app .no-script')
  await expect(fallback).toBeHidden()
  await expectEssentialProfileFallback(page)
})

test('essential profile links survive a Vue mount failure', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: class FailingSegmenter {
        constructor() {
          throw new Error('Forced mount failure')
        }
      },
    })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expectEssentialProfileFallback(page)
})

test('the essential profile remains usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    javaScriptEnabled: false,
  })
  const page = await context.newPage()
  await page.goto('/')

  const fallback = page.locator('.no-script')
  await expect(fallback.getByRole('heading', { name: 'Mohit Sharma' })).toBeVisible()
  await expect(fallback).toContainText('Security Researcher at Microsoft')
  await expect(fallback).toContainText('interactive portfolio is unavailable')
  await expect(fallback.getByRole('link', { name: 'Résumé' })).toHaveAttribute(
    'href',
    '/Mohit-Sharma-Resume.pdf',
  )
  await expect(fallback.getByRole('link', { name: 'Résumé' })).toHaveAttribute('target', '_blank')
  await expect(fallback.getByRole('link', { name: 'Blog' })).toHaveAttribute('href', '/blog/')
  await expect(fallback.getByRole('link', { name: 'Email' })).toHaveAttribute(
    'href',
    'https://mail.google.com/mail/?view=cm&fs=1&to=rinz0x0cruz%40gmail.com',
  )
  await expect(fallback.getByRole('link', { name: 'Email' })).toHaveAttribute('target', '_blank')
  await expect(fallback.getByRole('link')).toHaveCount(3)
  await context.close()
})

test('mask animation preserves keyboard focus', async ({ page }) => {
  const maskRequests = []
  page.on('request', (request) => {
    if (request.url().includes('avatar-yokai-mask')) maskRequests.push(request.url())
  })
  await page.goto('/')

  const mask = page.getByRole('button', { name: 'Remove illustrated yokai mask' })
  await mask.focus()
  await page.keyboard.press('Enter')
  await expect(mask).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Enter')

  const restoreMask = page.getByRole('button', { name: 'Restore illustrated yokai mask' })
  await expect(restoreMask).toBeFocused()
  await expect(restoreMask).toHaveAttribute('aria-disabled', 'false')
  expect(maskRequests).toHaveLength(1)
})

test('quotes rotate in a dedicated card footer', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.identity-card__role')).toContainText('Security Researcher')
  await expect(page.locator('.side-channel')).toHaveCount(0)
  await expect(page.locator('.identity-card__quote-measure q')).toHaveCount(profile.quotes.length)

  const loadedFaces = await page.evaluate(async () => (
    await document.fonts.load('16px "Mackie Pixel"')
  ).length)
  expect(loadedFaces).toBeGreaterThan(0)

  // a pixel face missing a glyph falls back to another family mid-sentence, which
  // is silent but very visible - assert it covers every character the quotes use
  const uncovered = await page.evaluate(() => {
    const text = [...document.querySelectorAll('.identity-card__quote-measure q')]
      .map((node) => node.textContent).join('')
    return [...new Set(text)]
      .filter((character) => !document.fonts.check('12px "Mackie Pixel"', character))
  })
  expect(uncovered).toEqual([])

  // the highlight is a second face stacked over the body face; if the two ever
  // stop lining up exactly, the shine lands on the wrong pixels
  const shine = await page.evaluate(() => {
    const quote = document.querySelector('.identity-card__quote')
    const layer = document.querySelector('.identity-card__quote-shine')
    if (!layer) return null
    const a = quote.getBoundingClientRect()
    const b = layer.getBoundingClientRect()
    return {
      family: getComputedStyle(layer).fontFamily,
      hidden: layer.getAttribute('aria-hidden'),
      sameText: layer.textContent === quote.textContent,
      offsetX: Math.round(Math.abs(a.x - b.x)),
      offsetY: Math.round(Math.abs(a.y - b.y)),
      sameWidth: Math.round(a.width) === Math.round(b.width),
    }
  })
  expect(shine).not.toBeNull()
  expect(shine.family).toContain('Mackie Pixel Shine')
  expect(shine.hidden).toBe('true')
  expect(shine.sameText).toBe(true)
  expect(shine.offsetX).toBe(0)
  expect(shine.offsetY).toBe(0)
  expect(shine.sameWidth).toBe(true)

  const presentation = await page.locator('.identity-card__quote').evaluate((element) => {
    const style = getComputedStyle(element)
    const before = getComputedStyle(element, '::before')
    const after = getComputedStyle(element, '::after')
    return {
      afterColor: after.color,
      afterContent: after.content,
      beforeColor: before.color,
      beforeContent: before.content,
      color: style.color,
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      tagName: element.tagName,
      textShadow: style.textShadow,
    }
  })
  expect(presentation.tagName).toBe('Q')
  expect(presentation.fontFamily).toContain('Mackie Pixel')
  expect(presentation.fontStyle).toBe('normal')
  expect(presentation.fontSize).toBe('12px')
  expect(presentation.fontWeight).toBe('400')
  expect(presentation.color).toBe('rgb(185, 178, 167)')
  // the quotation marks are gone, including the ones the UA stylesheet adds to q
  expect(presentation.beforeContent).toBe('none')
  expect(presentation.afterContent).toBe('none')
  expect(presentation.textShadow).not.toBe('none')

  const initialQuote = await currentQuote(page)
  const initialCard = await page.locator('.identity-card').boundingBox()
  await page.waitForTimeout(5_500)

  expect(await currentQuote(page)).not.toBe(initialQuote)
  const rotatedCard = await page.locator('.identity-card').boundingBox()
  expect(rotatedCard.width).toBeCloseTo(initialCard.width, 1)
  expect(rotatedCard.height).toBeCloseTo(initialCard.height, 1)
})

test('the rotating statement reaches assistive tech as a phrase', async ({ page }) => {
  await page.goto('/')

  // each letter is its own inline-block span so the line can animate, which
  // makes the accessible name "E v i d e n c e i n t o ..." - spelled out.
  // Poll because the quote rotates: both reads must land on the same one.
  await expect.poll(async () => {
    const seen = await currentQuote(page)
    const heard = (await page.locator('.identity-card__statement').ariaSnapshot())
      .replace(/^\s*-\s*paragraph:\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
    return heard === seen.replace(/\s+/g, ' ').trim()
  }).toBe(true)
})

test('the turn hint stays legible on the note it sits on', async ({ page }) => {
  await page.goto('/')

  const hint = page.locator('.sticky-note__hint').first()
  await hint.scrollIntoViewIfNeeded()
  await expect(hint).toBeVisible()

  // axe cannot score this text: the note paints a translucent gradient over its
  // fill, so the backdrop is sampled from the rendered pixels instead. The ink
  // comes from the computed style because antialiasing never reaches it.
  const paper = (await hint.screenshot({ scale: 'device' })).toString('base64')
  const contrast = await hint.evaluate(async (element, encoded) => {
    const bitmap = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${encoded}`)).blob(),
    )
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0)
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)

    const tally = new Map()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) continue
      const key = `${data[i]},${data[i + 1]},${data[i + 2]}`
      tally.set(key, (tally.get(key) ?? 0) + 1)
    }
    const backdrop = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]

    const channel = (value) => {
      const v = value / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).map(Number)
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const ink = luminance(getComputedStyle(element).color)
    const sheet = luminance(backdrop)
    const [lighter, darker] = ink > sheet ? [ink, sheet] : [sheet, ink]
    return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2))
  }, paper)

  expect(contrast).toBeGreaterThanOrEqual(4.5)
})

test('the album opens with a complete project record', async ({ page }) => {
  await page.goto('/')
  await page.locator('.album').scrollIntoViewIfNeeded()

  const firstProject = profile.projects[0]
  await expect(page.locator('.album__name')).toHaveText(firstProject.name)
  await expect(page.locator('.stamp', { hasText: firstProject.name })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.album__flow li')).toHaveCount(firstProject.flow.length)
  await expect(page.locator('.album__prompt')).toHaveCount(0)
})

test('links that stand on their own are big enough to hit', async ({ page }) => {
  await page.goto('/')

  // WCAG 2.5.8 lets a small target through two ways: it sits inside a sentence,
  // or nothing else is within a 24px circle of its centre. Only a target that
  // is both standalone and crowded actually fails.
  const cramped = await page.evaluate(() => {
    const targets = [...document.querySelectorAll('a[href],button,[role="button"],input,select,summary')]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
    const centre = ({ box }) => [box.left + box.width / 2, box.top + box.height / 2]

    return targets
      .filter(({ element }) => {
        const label = element.textContent.replace(/\s+/g, ' ').trim()
        const surrounding = element.parentElement.textContent.replace(/\s+/g, ' ').trim()
        return surrounding.length <= label.length + 12
      })
      .filter(({ box }) => box.width < 24 || box.height < 24)
      .filter((target) => {
        const [x, y] = centre(target)
        return targets.some((other) => {
          if (other.element === target.element) return false
          const [ox, oy] = centre(other)
          return Math.hypot(x - ox, y - oy) < 24
        })
      })
      .map(({ element, box }) => (
        `${element.textContent.trim().slice(0, 24)} ${Math.round(box.width)}x${Math.round(box.height)}`
      ))
  })

  expect(cramped).toEqual([])
})

test('dossier drawer opens while the identity card remains visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const credential = page.locator('.credential-card')
  const card = page.locator('.identity-card')
  const drawer = page.locator('.credential-card__drawer')
  const toggle = page.locator('.credential-card__turn')
  const records = page.getByRole('navigation', { name: 'Profile links', includeHidden: true })
  const links = records.getByRole('link', { includeHidden: true })

  await expect(page.locator('.dossier-slot')).toHaveCount(0)
  await expect(page.locator('.dovetail-spine')).toHaveCount(0)
  await expect(page.locator('.hire-hint__label')).toHaveText('work + contact')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toHaveAttribute('aria-label', 'Open profile links from profile card')
  await expect(toggle).toContainText('Open profile links')
  await expect(page.locator('.recruiter-nav__links')).toHaveAttribute(
    'aria-label',
    'Open profile links from navigation',
  )
  await expect(page.locator('.recruiter-nav__links')).toHaveText('Profile links')
  expect(await toggle.evaluate((button) => {
    const range = document.createRange()
    range.selectNodeContents(button.querySelector('span'))
    const buttonBounds = button.getBoundingClientRect()
    const textBounds = range.getBoundingClientRect()
    return Math.abs(
      (textBounds.left + textBounds.width / 2) - (buttonBounds.left + buttonBounds.width / 2),
    )
  })).toBeLessThanOrEqual(1)
  await expect(card).toBeVisible()
  await expect(card).not.toHaveAttribute('aria-hidden', 'true')
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  await expect(links).toHaveCount(profile.links.length)
  expect(await links.evaluateAll((elements) => elements.map((link) => ({
    detail: link.querySelector('em').textContent.trim(),
    href: link.getAttribute('href'),
    label: link.querySelector('strong').textContent.trim(),
    tabIndex: link.tabIndex,
  })))).toEqual(profile.links.map(({ detail, href, label }) => ({ detail, href, label, tabIndex: -1 })))

  const before = await page.evaluate(() => {
    const bounds = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return {
        bottom: rect.bottom,
        height: rect.height,
        right: rect.right,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      }
    }

    return {
      card: bounds('.identity-card'),
      credential: bounds('.credential-card'),
    }
  })
  expect(before.card).toEqual(before.credential)

  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAttribute('aria-label', 'Close profile links from profile card')
  await expect(toggle).toContainText('Close links')
  await expect(card).toBeVisible()
  await expect(card).not.toHaveAttribute('aria-hidden', 'true')
  await expect(drawer).toHaveAttribute('aria-hidden', 'false')
  expect(await links.evaluateAll((elements) => elements.every((link) => link.tabIndex === 0))).toBe(true)
  await expectDossierDrawer(page)

  const after = await page.evaluate(() => {
    const bounds = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect()
      return {
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      }
    }

    return {
      card: bounds('.identity-card'),
      credential: bounds('.credential-card'),
      deck: bounds('.achievement-deck'),
      drawer: bounds('.credential-card__drawer'),
    }
  })
  expect(after.credential.width).toBeCloseTo(before.credential.width, 1)
  expect(after.credential.height).toBeCloseTo(before.credential.height, 1)
  expect(after.card.width).toBeCloseTo(before.card.width, 1)
  expect(after.card.height).toBeCloseTo(before.card.height, 1)
  expect(after.drawer.y).toBeGreaterThanOrEqual(after.card.y + after.card.height)
  expect(after.drawer.y + after.drawer.height).toBeLessThanOrEqual(after.deck.y)

  await page.keyboard.press('Tab')
  await expect(links.first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(card).toBeVisible()
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  expect(await links.evaluateAll((elements) => elements.every((link) => link.tabIndex === -1))).toBe(true)

  for (let index = 0; index < 9; index += 1) await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expectDossierDrawer(page)
  await expect(card).toBeVisible()
})

for (const viewport of [
  {
    width: 390,
    height: 844,
    columns: Math.min(3, profile.links.length),
    rows: Math.ceil(profile.links.length / 3),
  },
  { width: 320, height: 568, columns: profile.links.length, rows: 1 },
  { width: 844, height: 390, columns: profile.links.length, rows: 1 },
]) {
  test(`${viewport.width}x${viewport.height} keeps the visible card and drawer records contained`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const toggle = page.locator('.credential-card__turn')
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expectDossierDrawer(page)
    await expect(page.locator('.identity-card')).toBeVisible()

    const layout = await page.evaluate(() => {
      const bounds = (target) => {
        const element = typeof target === 'string' ? document.querySelector(target) : target
        const rect = element.getBoundingClientRect()
        return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top }
      }
      const listStyle = getComputedStyle(document.querySelector('.credential-card__records ol'))
      const card = bounds('.identity-card')
      const deck = bounds('.achievement-deck')
      const drawer = bounds('.credential-card__drawer')
      const turn = bounds('.credential-card__turn')
      const links = [...document.querySelectorAll('.credential-card__records a')]

      return {
        card,
        columns: listStyle.gridTemplateColumns.split(' ').length,
        contained: links.every((link) => {
          const linkBounds = bounds(link)
          return linkBounds.left >= drawer.left
            && linkBounds.right <= drawer.right
            && linkBounds.top >= drawer.top
            && linkBounds.bottom <= drawer.bottom
            && link.scrollWidth <= link.clientWidth
            && link.scrollHeight <= link.clientHeight
        }),
        drawer,
        drawerBelowCard: drawer.top >= card.bottom,
        drawerBeforeDeck: drawer.bottom <= deck.top,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        rows: listStyle.gridTemplateRows.split(' ').length,
        turnAboveCard: turn.bottom <= card.top,
        turnHeight: turn.bottom - turn.top,
      }
    })

    expect(layout.columns).toBe(viewport.columns)
    expect(layout.rows).toBe(viewport.rows)
    expect(layout.overflowX).toBe(0)
    expect(layout.contained).toBe(true)
    expect(layout.drawerBelowCard).toBe(true)
    expect(layout.drawerBeforeDeck).toBe(true)
    expect(layout.turnAboveCard).toBe(true)
    expect(layout.turnHeight).toBeGreaterThanOrEqual(44)
  })
}

for (const viewport of [
  { width: 1600, height: 1300, centerTolerance: 8, videoScale: 1 },
  { width: 1440, height: 900, centerTolerance: 8, videoScale: 1 },
  { width: 1024, height: 768, centerTolerance: 8, videoScale: 1 },
  { width: 390, height: 844, centerTolerance: 24, videoScale: 1 },
  { width: 320, height: 568, videoScale: 1 },
  { width: 844, height: 390, videoScale: 1 },
]) {
  test(`${viewport.width}x${viewport.height} separates video, namecard, drawer, and achievements`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const toggle = page.locator('.credential-card__turn')
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expectDossierDrawer(page)

    const layout = await page.evaluate(() => {
      const bounds = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return { bottom: rect.bottom, height: rect.height, top: rect.top }
      }
      const scene = bounds('.scene')
      const video = bounds('.scene__window')
      const videoElement = document.querySelector('.scene__landscape-video')
      const turn = bounds('.credential-card__turn')
      const card = bounds('.identity-card')
      const drawer = bounds('.credential-card__drawer')
      const deck = bounds('.achievement-deck')
      const intervalCenter = (video.bottom + deck.top) / 2
      const assemblyCenter = (turn.top + drawer.bottom) / 2

      return {
        assemblyCenterDelta: Math.abs(assemblyCenter - intervalCenter),
        cardGap: card.top - turn.bottom,
        drawerGap: drawer.top - card.bottom,
        drawerToAchievements: deck.top - drawer.bottom,
        sceneContainsAssembly: turn.top >= scene.top && drawer.bottom <= scene.bottom,
        videoFit: getComputedStyle(videoElement).objectFit,
        videoGap: turn.top - video.bottom,
        videoHeight: video.height,
        videoScale: new DOMMatrixReadOnly(getComputedStyle(videoElement).transform).a,
      }
    })

    const expectedVideoHeight = Math.min(544, Math.max(256, viewport.height * 0.55))
    expect(layout.videoHeight).toBeCloseTo(expectedVideoHeight, 0)
    expect(layout.videoFit).toBe('cover')
    expect(layout.videoScale).toBe(viewport.videoScale)
    expect(layout.videoGap).toBeGreaterThanOrEqual(28)
    expect(layout.cardGap).toBeGreaterThanOrEqual(0)
    expect(layout.drawerGap).toBeGreaterThanOrEqual(0)
    expect(layout.drawerToAchievements).toBeGreaterThanOrEqual(8)
    expect(layout.sceneContainsAssembly).toBe(true)
    if (viewport.centerTolerance) {
      expect(layout.assemblyCenterDelta).toBeLessThanOrEqual(viewport.centerTolerance)
    }
  })
}

test('résumé preview and Gmail compose open in new tabs', async ({ page, context, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.route('https://mail.google.com/**', (route) => route.fulfill({
    body: '<title>Gmail compose</title>',
    contentType: 'text/html',
  }))
  await page.goto('/')
  await page.locator('.credential-card__turn').click()
  await expectDossierDrawer(page)

  const profileLinks = page.getByRole('navigation', { name: 'Profile links' })
  const resume = profileLinks.getByRole('link', { name: /Résumé/u })
  const email = profileLinks.getByRole('link', { name: /Email/u })
  await expect(resume).toHaveAttribute('target', '_blank')
  await expect(email).toHaveAttribute('target', '_blank')

  const pdfResponse = await request.get('/Mohit-Sharma-Resume.pdf')
  expect(pdfResponse.status()).toBe(200)
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf')
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe('%PDF-')

  const resumePopupPromise = page.waitForEvent('popup')
  await resume.click()
  const resumePopup = await resumePopupPromise
  expect(context.pages()).toHaveLength(2)
  await resumePopup.close()

  const emailPopupPromise = page.waitForEvent('popup')
  await email.click()
  const emailPopup = await emailPopupPromise
  await emailPopup.waitForLoadState('domcontentloaded')
  const composeUrl = new URL(emailPopup.url())
  expect(composeUrl.origin).toBe('https://mail.google.com')
  expect(composeUrl.pathname).toBe('/mail/')
  expect(composeUrl.searchParams.get('view')).toBe('cm')
  expect(composeUrl.searchParams.get('fs')).toBe('1')
  expect(composeUrl.searchParams.get('to')).toBe('rinz0x0cruz@gmail.com')
  await emailPopup.close()
})

test('blog link opens the static archive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.credential-card__turn').click()
  await expectDossierDrawer(page)
  await page.getByRole('link', { name: 'Blog' }).click()

  await expect(page).toHaveURL(/\/blog\/$/)
  await expect(page.getByRole('heading', { name: 'Security field notes', level: 1 })).toBeVisible()
  await expect(page.locator('script[type="module"]')).toHaveCount(0)
})

test('blog motion settles without layout overflow and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/blog/')

  expect(await page.evaluate(() => ({
    entry: getComputedStyle(document.querySelector('.post-item')).animationName,
    head: getComputedStyle(document.querySelector('.site-head')).animationName,
    rule: getComputedStyle(document.querySelector('.blog-head'), '::after').animationName,
    title: getComputedStyle(document.querySelector('.blog-head h1')).animationName,
  }))).toEqual({
    entry: 'note-rise',
    head: 'note-drop',
    rule: 'note-rule',
    title: 'note-rise',
  })

  await expect.poll(() => page.locator('.post-item').evaluateAll((elements) => elements.every((element) => {
    const style = getComputedStyle(element)
    return style.opacity === '1' && style.transform === 'matrix(1, 0, 0, 1, 0, 0)'
  }))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.evaluate(() => ({
    entry: getComputedStyle(document.querySelector('.post-item')).animationName,
    head: getComputedStyle(document.querySelector('.site-head')).animationName,
    rule: getComputedStyle(document.querySelector('.blog-head'), '::after').animationName,
    title: getComputedStyle(document.querySelector('.blog-head h1')).animationName,
  }))).toEqual({ entry: 'none', head: 'none', rule: 'none', title: 'none' })

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  const forcedColors = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(forcedColors.violations).toEqual([])
})

test('introduction post renders the Markdown article fixtures', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/blog/')
  await page.getByRole('link', { name: 'Field notes, not victory laps' }).click()

  await expect(page).toHaveURL(/\/blog\/welcome-to-the-field-notes\/$/u)
  await expect(page.getByRole('heading', { name: 'Field notes, not victory laps', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The first draft behaved too well', level: 2 })).toBeVisible()
  await expect(page.locator('.article-body')).toContainText('175 words long')
  await expect(page.locator('blockquote')).toContainText('I probably published the conclusion too early')
  await expect(page.locator('pre')).toHaveAttribute('tabindex', '0')
  await expect(page.getByRole('link', { name: 'public projects' })).toHaveAttribute('rel', 'noreferrer')
  await expect(page.getByRole('link', { name: 'portfolio home page' })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'RSS feed' })).toHaveAttribute('href', '/blog/feed.xml')
  await expect(page.locator('script[type="module"]')).toHaveCount(0)
})

test('ExploitRank field note keeps forecasts, evidence, and applicability distinct', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/blog/')
  await page.getByRole('link', { name: '8,218 CVEs, 411 seats' }).click()

  await expect(page).toHaveURL(/\/blog\/fixed-budget-vulnerability-triage\/$/u)
  await expect(page.getByRole('heading', { name: 'The impossible inbox', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The boring rule won', level: 2 })).toBeVisible()
  await expect(page.locator('.article-body')).toContainText('8,218 eligible CVEs')
  await expect(page.locator('.article-body')).toContainText('411 review seats')
  await expect(page.locator('.article-body')).toContainText('attention constraint, not a new exploitation probability')
  await expect(page.locator('.article-body')).toContainText('does not determine whether a CVE affects a specific environment')
  await expect(page.getByRole('link', { name: 'FIRST EPSS' })).toHaveAttribute('href', 'https://www.first.org/epss/')
  await expect(page.getByRole('link', { name: 'CISA KEV' })).toHaveAttribute(
    'href',
    'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
  )
  await expect(page.getByRole('link', { name: 'live ExploitRank dashboard' })).toHaveAttribute(
    'href',
    'https://rinz0x0cruz.github.io/exploitrank/',
  )
  await expect(page.getByRole('link', { name: 'artifact repository' })).toHaveAttribute(
    'href',
    'https://github.com/rinz0x0cruz/exploitrank',
  )
  await expect(page.locator('script[type="module"]')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
})

test('Malscope field note preserves the public release boundary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/blog/')
  await page.getByRole('link', { name: 'The TLP label that stopped this post' }).click()

  await expect(page).toHaveURL(/\/blog\/publishing-malware-analysis-evidence\/$/u)
  await expect(page.getByRole('heading', { name: 'The sentence that failed its own fact-check', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Three files, or it does not ship', level: 2 })).toBeVisible()
  await expect(page.locator('.article-body')).toContainText('the article had found the defect before a reviewer did')
  await expect(page.locator('.article-body')).toContainText('reports.reports[0].tlp must be TLP:CLEAR')
  await expect(page.locator('.article-body')).toContainText('sample data, not malware sample bytes')
  await expect(page.getByRole('link', { name: 'validator' })).toHaveAttribute(
    'href',
    'https://github.com/rinz0x0cruz/malscope-dashboard/blob/main/scripts/validate-public-data.mjs',
  )
  await expect(page.getByRole('link', { name: 'YARA' })).toHaveAttribute(
    'href',
    'https://yara.readthedocs.io/en/stable/',
  )
  await expect(page.getByRole('link', { name: 'Sigma' })).toHaveAttribute(
    'href',
    'https://sigmahq.io/docs/',
  )
  await expect(page.getByRole('link', { name: 'FIRST TLP 2.0' })).toHaveAttribute(
    'href',
    'https://www.first.org/tlp/',
  )
  await expect(page.getByRole('link', { name: 'public artifact repository' })).toHaveAttribute(
    'href',
    'https://github.com/rinz0x0cruz/malscope-dashboard',
  )
  await expect(page.locator('script[type="module"]')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
})

test('Quorum field note separates mechanics, correctness, and judgment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/blog/')
  await page.getByRole('link', { name: 'The benchmark said 85. Accuracy said zero.' }).click()

  await expect(page).toHaveURL(/\/blog\/benchmark-before-you-debate\/$/u)
  await expect(page.getByRole('heading', { name: 'A beautiful score for a wrong answer', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Judges have tells', level: 2 })).toBeVisible()
  await expect(page.locator('.article-body')).toContainText('zero correct answers')
  await expect(page.locator('.article-body')).toContainText('Mock scores prove plumbing, not answer quality')
  await expect(page.locator('.article-body')).toContainText('There is no universal winning strategy')
  await expect(page.getByRole('link', { name: 'six versioned evaluation packs' })).toHaveAttribute(
    'href',
    'https://github.com/rinz0x0cruz/quorum/tree/main/evals/packs',
  )
  await expect(page.getByRole('link', { name: 'deterministic matchers' })).toHaveAttribute(
    'href',
    'https://github.com/rinz0x0cruz/quorum/blob/main/quorum/grade.py',
  )
  await expect(page.getByRole('link', { name: 'Judging LLM-as-a-Judge' })).toHaveAttribute(
    'href',
    'https://arxiv.org/abs/2306.05685',
  )
  await expect(page.getByRole('link', { name: 'Quorum repository' })).toHaveAttribute(
    'href',
    'https://github.com/rinz0x0cruz/quorum',
  )
  await expect(page.locator('script[type="module"]')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
})

test('fullscreen keeps outcomes close while compact credits stay outside main', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1300 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const layout = await page.evaluate(() => {
    const card = document.querySelector('.identity-card').getBoundingClientRect()
    const footer = document.querySelector('.site-footer').getBoundingClientRect()
    const disclosure = document.querySelector('.site-footer__credits')
    const summary = disclosure.querySelector('summary').getBoundingClientRect()
    const deck = document.querySelector('.achievement-deck').getBoundingClientRect()
    const heading = document.querySelector('.achievement-deck__header').getBoundingClientRect()
    const scene = document.querySelector('.scene').getBoundingClientRect()

    return {
      cardToHeading: heading.top - card.bottom,
      creditCount: disclosure.querySelectorAll('.font-credit').length,
      disclosureInsideFooter: document.querySelector('.site-footer').contains(disclosure),
      disclosureOpen: disclosure.open,
      footerBelowDeck: footer.top - deck.bottom,
      footerHeight: Math.round(footer.height),
      footerOutsideMain: !document.querySelector('.portfolio').contains(disclosure),
      summaryHeight: Math.round(summary.height),
      unusedScene: scene.bottom - card.bottom,
    }
  })

  expect(layout.creditCount).toBe(3)
  expect(layout.disclosureInsideFooter).toBe(true)
  expect(layout.disclosureOpen).toBe(false)
  expect(layout.footerOutsideMain).toBe(true)
  expect(layout.footerBelowDeck).toBeGreaterThanOrEqual(0)
  expect(layout.footerHeight).toBeLessThanOrEqual(46)
  expect(layout.summaryHeight).toBeGreaterThanOrEqual(44)
  expect(layout.unusedScene).toBeLessThanOrEqual(8)
  expect(layout.cardToHeading).toBeGreaterThanOrEqual(64)
  expect(layout.cardToHeading).toBeLessThanOrEqual(80)
})

test('footer credits meet normal-text contrast', async ({ page }) => {
  await page.goto('/')
  await page.locator('.site-footer__credits > summary').click()
  await expect(page.locator('.site-footer__credits')).toHaveJSProperty('open', true)

  const credits = await page.locator('.font-credit').evaluateAll((elements) => {
    const channel = (value) => {
      const normalized = value / 255
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4
    }
    const luminance = (color) => {
      const [red, green, blue] = color.match(/[\d.]+/g).slice(0, 3).map(Number)
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
    }

    return elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        contrast: (luminance(style.color) + 0.05) / 0.05,
        fontSize: parseFloat(style.fontSize),
      }
    })
  })

  expect(credits.every(({ contrast }) => contrast >= 4.5)).toBe(true)
  expect(credits.every(({ fontSize }) => fontSize >= 12)).toBe(true)
})

test('secondary labels meet normal-text contrast', async ({ page }) => {
  await page.goto('/')

  const selectors = [
    '.experience__axis > span:not(.experience__axis-track)',
    '.album__head > div > p',
    '.language-switch button.language-switch__button--active span',
  ]
  const contrasts = await page.locator(selectors.join(',')).evaluateAll((elements) => {
    const channel = (value) => {
      const normalized = value / 255
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4
    }
    const luminance = (color) => {
      const [red, green, blue] = color.match(/[\d.]+/g).slice(0, 3).map(Number)
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
    }

    return elements.map((element) => {
      const style = getComputedStyle(element)
      const background = getComputedStyle(element.closest('.language-switch') ?? document.body).backgroundColor
      const foregroundLuminance = luminance(style.color)
      const backgroundLuminance = luminance(background)
      return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
    })
  })

  expect(contrasts).toHaveLength(6)
  expect(contrasts.every((contrast) => contrast >= 4.5)).toBe(true)
})

test('portfolio has no WCAG A or AA violations', async ({ page }) => {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

  // axe cannot score text painted over a gradient or artwork, so it files those
  // as `incomplete` instead of a violation and an assertion on violations alone
  // reads clean while the text is unchecked. These ceilings ratchet: unscored
  // text may shrink, never quietly grow back. Anything other than contrast
  // becoming unscorable is a new blind spot and fails outright.
  const unscored = (results) => results.incomplete
    .filter((result) => result.id === 'color-contrast')
    .reduce((total, result) => total + result.nodes.length, 0)
  const otherBlindSpots = (results) => results.incomplete
    .filter((result) => result.id !== 'color-contrast')
    .map((result) => result.id)

  for (const media of [
    { ceiling: { closed: 216, open: 216 }, forcedColors: 'none', height: 900, width: 1440 },
    { ceiling: { closed: 173, open: 173 }, forcedColors: 'none', height: 844, width: 390 },
    { ceiling: { closed: 144, open: 144 }, forcedColors: 'active', height: 844, width: 390 },
  ]) {
    await page.setViewportSize({ width: media.width, height: media.height })
    await page.emulateMedia({
      forcedColors: media.forcedColors,
      reducedMotion: 'reduce',
    })
    await page.goto('/')

    const closed = await new AxeBuilder({ page }).withTags(tags).analyze()
    expect(closed.violations).toEqual([])
    expect(otherBlindSpots(closed)).toEqual([])
    expect(unscored(closed)).toBeLessThanOrEqual(media.ceiling.closed)

    await page.locator('.recruiter-nav__links').click()
    await expectDossierDrawer(page)
    const open = await new AxeBuilder({ page }).withTags(tags).analyze()
    expect(open.violations).toEqual([])
    expect(otherBlindSpots(open)).toEqual([])
    expect(unscored(open)).toBeLessThanOrEqual(media.ceiling.open)
  }
})

test('footer credits stay compact and open from the keyboard', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 700 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const footer = page.locator('.site-footer')
    const disclosure = footer.locator('.site-footer__credits')
    const summary = disclosure.locator('summary')
    await footer.scrollIntoViewIfNeeded()

    const closed = await footer.evaluate((element) => ({
      height: Math.round(element.getBoundingClientRect().height),
      open: element.querySelector('details').open,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      summaryHeight: Math.round(element.querySelector('summary').getBoundingClientRect().height),
    }))
    expect(closed.open).toBe(false)
    expect(closed.height).toBeLessThanOrEqual(46)
    expect(closed.summaryHeight).toBeGreaterThanOrEqual(44)
    expect(closed.overflowX).toBe(0)

    await summary.focus()
    await page.keyboard.press('Enter')
    await expect(disclosure).toHaveJSProperty('open', true)
    const opened = await footer.evaluate((element) => {
      const grid = element.querySelector('.site-footer__credit-grid')
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        creditsVisible: [...grid.querySelectorAll('.font-credit')].every((credit) => (
          credit.getBoundingClientRect().height > 0
        )),
        focused: document.activeElement === element.querySelector('summary'),
        height: Math.round(element.getBoundingClientRect().height),
        overflowX: document.documentElement.scrollWidth - innerWidth,
      }
    })
    expect(opened.columns).toBe(viewport.width <= 700 ? 1 : 3)
    expect(opened.creditsVisible).toBe(true)
    expect(opened.focused).toBe(true)
    expect(opened.height).toBeGreaterThan(closed.height)
    expect(opened.overflowX).toBe(0)
  }
})

test('reduced motion settles the achievement vines fully grown', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.achievement-deck').scrollIntoViewIfNeeded()
  await expect(page.locator('.achievement-window')).toHaveClass(/achievement-window--active/)

  const settled = await page.evaluate(() => {
    const running = (root) => root.getAnimations({ subtree: true }).filter(({ animationName }) => (
      animationName?.startsWith('achievement-vine')
    )).length
    const window = document.querySelector('.achievement-window')

    return {
      running: running(window),
      stemDashoffset: getComputedStyle(window.querySelector('.achievement-vines__stem')).strokeDashoffset,
      vinesOpacity: getComputedStyle(window.querySelector('.achievement-vines')).opacity,
    }
  })

  expect(settled.running).toBe(0)
  expect(settled.stemDashoffset).toBe('0px')
  expect(settled.vinesOpacity).toBe('1')
})

test('namecard rests equidistant between the MP4 and Selected Outcomes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const layout = await page.evaluate(() => {
      const bounds = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top }
      }
      const overlapArea = (first, second) => (
        Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
        * Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top))
      )
      const video = bounds('.scene__window')
      const card = bounds('.identity-card')
      const credit = bounds('.site-footer__credits > summary')
      const outcomes = bounds('.achievement-deck__header')

      return {
        below: outcomes.top - card.bottom,
        cardCreditOverlap: overlapArea(card, credit),
        creditOutcomesOverlap: overlapArea(credit, outcomes),
        above: card.top - video.bottom,
      }
    })

    expect(layout.above).toBeCloseTo(76, 0)
    expect(layout.below).toBeCloseTo(76, 0)
    expect(Math.abs(layout.above - layout.below)).toBeLessThan(1)
    expect(layout.cardCreditOverlap).toBe(0)
    expect(layout.creditOutcomesOverlap).toBe(0)
  }
})

test('discipline band uses only the supported namecard space', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of [
    { width: 1440, height: 900, card: [1024, 363.39], visible: true },
    { width: 1024, height: 768, card: [962.56, 363.39], visible: true },
    { width: 1000, height: 700, card: [940, 363.39], visible: true },
    { width: 999, height: 700, card: [939.06, 363.39], visible: false },
    { width: 390, height: 844, card: [326, 271.91], visible: false },
    { width: 320, height: 568, card: [256, 288], visible: false },
    { width: 844, height: 390, card: [780, 255.5], visible: false },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const band = page.locator('.discipline-band')
    await expect(band).toHaveAttribute(
      'aria-label',
      `Disciplines: ${profile.disciplines.map(({ name, detail }) => `${name} - ${detail}`).join('. ')}.`,
    )
    await expect(band.locator('button, a, input, [tabindex]')).toHaveCount(0)
    if (viewport.visible) await expect(band).toBeVisible()
    else await expect(band).toBeHidden()

    const layout = await page.evaluate(() => {
      const bounds = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        }
      }
      const overlaps = (first, second) => (
        first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      )
      const avatar = bounds('.identity-avatar')
      const card = bounds('.identity-card')
      const copy = bounds('.identity-card__copy')
      const band = bounds('.discipline-band')
      const quote = bounds('.identity-card__statement')
      const role = bounds('.identity-card__role')
      const list = document.querySelector('.discipline-band__list')

      return {
        card,
        contained: band.left >= copy.left
          && band.right <= copy.right
          && band.top >= role.bottom - 0.5
          && band.bottom <= quote.top,
        display: getComputedStyle(document.querySelector('.discipline-band')).display,
        // the cells must not spill past the band
        listOverflow: list ? list.getBoundingClientRect().bottom - band.bottom : 0,
        // every cell must read as exactly two lines: one name, one detail
        wrappedCells: [
          '.discipline-band__name',
          '.discipline-band__detail',
        ].flatMap((selector) => [...document.querySelectorAll(selector)].filter((node) => (
          Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)) > 1
        ))).length,
        // nothing in the band or the status readout may drop below the role size
        smallestText: Math.min(...[
          '.discipline-band__topline',
          '.discipline-band__name',
          '.discipline-band__detail',
          '.availability',
        ].map((selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize))),
        band,
        overlaps: [avatar, role, quote].some((element) => overlaps(band, element)),
        overflowX: document.documentElement.scrollWidth - innerWidth,
      }
    })

    expect(layout.card.width).toBeCloseTo(viewport.card[0], 1)
    expect(layout.card.height).toBeCloseTo(viewport.card[1], 1)
    expect(layout.overflowX).toBe(0)
    if (viewport.visible) {
      expect(layout.display).toBe('block')
      expect(layout.band.width).toBeLessThanOrEqual(710)
      expect(layout.listOverflow).toBeLessThanOrEqual(0)
      // the band text was unreadable at 8.8px; this is the floor it settled on
      expect(layout.smallestText).toBeGreaterThanOrEqual(10)
      expect(layout.wrappedCells).toBe(0)
      expect(layout.contained).toBe(true)
      expect(layout.overlaps).toBe(false)
    } else {
      expect(layout.display).toBe('none')
      expect(layout.band.width).toBe(0)
      expect(layout.band.height).toBe(0)
    }
  }
})

test('discipline band reveals once and stops', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 641 })
  await page.addInitScript(() => {
    const NativeIntersectionObserver = window.IntersectionObserver
    const stats = { disconnected: 0, observed: 0 }
    window.__bandObserver = stats
    window.IntersectionObserver = class extends NativeIntersectionObserver {
      observe(target) {
        if (target.classList?.contains('discipline-band')) {
          this.disciplineBand = true
          stats.observed += 1
        }
        return super.observe(target)
      }

      disconnect() {
        if (this.disciplineBand) stats.disconnected += 1
        return super.disconnect()
      }
    }
  })
  await page.goto('/')

  const band = page.locator('.discipline-band')
  await expect(band).toHaveAttribute('data-band-state', 'armed')
  expect(await page.evaluate(() => window.__bandObserver)).toEqual({
    disconnected: 0,
    observed: 1,
  })

  await band.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await expect(band).toHaveAttribute('data-band-state', 'shown')
  expect(await page.evaluate(() => window.__bandObserver)).toEqual({
    disconnected: 1,
    observed: 1,
  })

  const timing = await band.evaluate((element) => {
    const animations = element.getAnimations({ subtree: true }).filter(({ animationName }) => (
      animationName?.startsWith('discipline-band-')
    ))
    return {
      count: animations.length,
      iterations: animations.map((animation) => animation.effect.getTiming().iterations),
      maximumEnd: Math.max(...animations.map((animation) => {
        const { delay, duration } = animation.effect.getTiming()
        return delay + duration
      })),
    }
  })
  expect(timing.count).toBeGreaterThan(0)
  // the reveal runs once and is over quickly; nothing here loops
  expect(timing.iterations.every((iterations) => iterations === 1)).toBe(true)
  expect(timing.maximumEnd).toBeLessThanOrEqual(1600)

  await page.waitForTimeout(1800)
  expect(await band.evaluate((element) => ({
    running: element.getAnimations({ subtree: true }).filter((animation) => (
      animation.playState === 'running'
    )).length,
    abbrs: [...element.querySelectorAll('.discipline-band__abbr')].map((node) => node.textContent),
    // every rule opens fully, revealing the expansion beneath it
    rulesFullWidth: [...element.querySelectorAll('.discipline-band__cell')].every((cell) => (
      Math.abs(
        cell.querySelector('.discipline-band__rule').getBoundingClientRect().width
        - cell.getBoundingClientRect().width,
      ) < 0.5
    )),
  }))).toEqual({
    running: 0,
    abbrs: profile.disciplines.map(({ abbr }) => abbr),
    rulesFullWidth: true,
  })

  await page.locator('.achievement-deck').evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await band.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(350)
  await expect(band).toHaveAttribute('data-band-state', 'shown')
  expect(await band.evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => (
    animation.playState === 'running'
  )).length)).toBe(0)
})

test('discipline band stays readable when its environment changes', async ({ page }) => {
  const showBand = async () => {
    await page.setViewportSize({ width: 1000, height: 641 })
    await page.goto('/')
    const band = page.locator('.discipline-band')
    await band.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await expect(band).toHaveAttribute('data-band-state', 'shown')
    return band
  }
  const expectSettled = async (band) => {
    await expect(band).toHaveAttribute('data-band-state', 'static')
    expect(await band.evaluate((element) => element.getAnimations({ subtree: true }).filter(({ animationName }) => (
      animationName?.startsWith('discipline-band-')
    )).length)).toBe(0)
    // an interrupted reveal must still leave every discipline legible
    expect(await band.locator('.discipline-band__name').allTextContents()).toEqual(
      profile.disciplines.map(({ name }) => name),
    )
  }

  let band = await showBand()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expectSettled(band)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  band = await showBand()
  await page.emulateMedia({ forcedColors: 'active' })
  await expectSettled(band)

  await page.emulateMedia({ forcedColors: 'none' })
  band = await showBand()
  await page.setViewportSize({ width: 999, height: 700 })
  await expect(band).toBeHidden()
  await expectSettled(band)
  await page.setViewportSize({ width: 1000, height: 700 })
  await expect(band).toBeVisible()
  await expectSettled(band)
})

test('reduced motion stops ambient animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const disciplineBand = page.locator('.discipline-band')
  await expect(disciplineBand).toBeVisible()
  await expect(disciplineBand).toHaveAttribute('data-band-state', 'static')
  expect(await disciplineBand.evaluate((element) => ({
    animations: element.getAnimations({ subtree: true }).filter(({ animationName }) => (
      animationName?.startsWith('discipline-band-')
    )).length,
    abbrs: [...element.querySelectorAll('.discipline-band__abbr')].map((node) => node.textContent),
    // scaleX(1) and no transform both mean unscaled, so measure the drawn width
    rulesFullWidth: [...element.querySelectorAll('.discipline-band__cell')].every((cell) => (
      Math.abs(
        cell.querySelector('.discipline-band__rule').getBoundingClientRect().width
        - cell.getBoundingClientRect().width,
      ) < 0.5
    )),
  }))).toEqual({
    animations: 0,
    abbrs: profile.disciplines.map(({ abbr }) => abbr),
    rulesFullWidth: true,
  })

  const initialQuote = await currentQuote(page)
  await page.waitForTimeout(5_500)

  expect(await currentQuote(page)).toBe(initialQuote)
  await expect(page.locator('video')).toBeHidden()
  expect(await page.locator('video').evaluate((video) => video.paused)).toBe(true)
  expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length)).toBe(0)
  expect(await page.locator('.achievement-card').first().evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s')
  const achievementWindow = page.locator('.achievement-window')
  await achievementWindow.scrollIntoViewIfNeeded()
  await expect(achievementWindow).toHaveClass(/achievement-window--active/)
  await expect(achievementWindow.locator('.achievement-stage')).toBeVisible()
  await expect(achievementWindow.locator('.achievement-card__foil')).toHaveCount(achievementCount)
  expect(await achievementWindow.evaluate((element) => ({
    cardGlareDisplay: getComputedStyle(element.querySelector('.achievement-card__foil'), '::after').display,
    cardVineLeafTransform: getComputedStyle(element.querySelector('.achievement-card__vine-leaves path')).transform,
    cardVineOpacity: getComputedStyle(element.querySelector('.achievement-card__vine')).opacity,
    cardVineStemDashoffset: getComputedStyle(element.querySelector('.achievement-card__vine-stem')).strokeDashoffset,
    cornerOpacity: getComputedStyle(element.querySelector('.achievement-window__frame')).opacity,
    filigreeAnimation: getComputedStyle(element.querySelector('.achievement-filigree')).animationName,
    filigreeOpacity: getComputedStyle(element.querySelector('.achievement-filigree')).opacity,
    leafTransform: getComputedStyle(element.querySelector('.achievement-filigree__leaves path')).transform,
    railAnimation: getComputedStyle(element.querySelector('.achievement-window__frame'), '::before').animationName,
    sideAnimation: getComputedStyle(element, '::before').animationName,
    stemDashoffset: getComputedStyle(element.querySelector('.achievement-filigree__path--stem')).strokeDashoffset,
    stitchDisplay: getComputedStyle(element.querySelector('.achievement-filigree__stitch')).display,
    vineGrowthPosition: getComputedStyle(element.querySelector('.achievement-vines__growth--crown')).backgroundPosition,
    vineLeafAnimation: getComputedStyle(element.querySelector('.achievement-vines__leaf')).animationName,
    vineLeafOpacity: getComputedStyle(element.querySelector('.achievement-vines__leaf')).opacity,
    vineStemDashoffset: getComputedStyle(element.querySelector('.achievement-vines__stem')).strokeDashoffset,
    vinesOpacity: getComputedStyle(element.querySelector('.achievement-vines')).opacity,
  }))).toEqual({
    cardGlareDisplay: 'none',
    cardVineLeafTransform: 'matrix(1, 0, 0, 1, 0, 0)',
    cardVineOpacity: '0.34',
    cardVineStemDashoffset: '0px',
    cornerOpacity: '1',
    filigreeAnimation: 'none',
    filigreeOpacity: '1',
    leafTransform: 'matrix(1, 0, 0, 1, 0, 0)',
    railAnimation: 'none',
    sideAnimation: 'none',
    stemDashoffset: '0px',
    stitchDisplay: 'none',
    vineGrowthPosition: '100% 0px',
    vineLeafAnimation: 'none',
    vineLeafOpacity: '1',
    vineStemDashoffset: '0px',
    vinesOpacity: '1',
  })

  const dossierToggle = page.locator('.credential-card__turn')
  await dossierToggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.credential-card__drawer')).toHaveCSS('transition-duration', '0s')
  await expect(page.locator('.credential-card__drawer')).toHaveCSS('transform', 'none')
  await expect(page.locator('.credential-card__drawer')).toHaveCSS('opacity', '1')
  await expect(page.locator('.identity-card')).toBeVisible()
})

test('career rail scrolls sideways without spilling the page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.locator('.experience').scrollIntoViewIfNeeded()

    const layout = await page.evaluate(() => {
      const rail = document.querySelector('.experience__rail')
      const chapters = [...document.querySelectorAll('.chapter')]
      const railRect = rail.getBoundingClientRect()

      return {
        count: chapters.length,
        // the rail must be the only thing that scrolls sideways
        railOverflows: rail.scrollWidth > rail.clientWidth + 1,
        pageOverflowX: document.documentElement.scrollWidth - innerWidth,
        // every chapter sits on one shared top edge: it is a row, not a grid
        sameRow: chapters.every((c) => Math.abs(c.getBoundingClientRect().top - railRect.top) < 40),
        focusable: rail.tabIndex === 0,
        named: !!rail.getAttribute('aria-label'),
      }
    })

    expect(layout.count).toBe(profile.experience.length)
    expect(layout.pageOverflowX).toBe(0)
    expect(layout.railOverflows).toBe(true)
    expect(layout.sameRow).toBe(true)
    expect(layout.focusable).toBe(true)
    expect(layout.named).toBe(true)
  }
})

test('career rail is drivable from the keyboard alone', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const rail = page.locator('.experience__rail')
  await rail.scrollIntoViewIfNeeded()
  await rail.focus()

  const left = () => rail.evaluate((el) => el.scrollLeft)
  expect(await left()).toBe(0)

  await page.keyboard.press('ArrowRight')
  await expect.poll(left).toBeGreaterThan(0)

  await page.keyboard.press('End')
  await expect
    .poll(left)
    .toBeGreaterThan(await rail.evaluate((el) => el.scrollWidth - el.clientWidth - 2))

  await page.keyboard.press('Home')
  await expect.poll(left).toBe(0)
})

test('career rail states every role in the order they happened', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const section = page.getByRole('region', { name: "Where I've worked" })
  // newest first: a reader meets what he does now before how he got here
  await expect(section.locator('.chapter__company')).toHaveText(profile.experience.map(({ company }) => company))
  await expect(section.locator('.chapter__dates')).toHaveText(profile.experience.map(({ period }) => period))
  await expect(section.locator('.chapter__outcome')).toHaveCount(profile.experience.length)
  await expect(section.locator('.chapter__notable li')).toHaveCount(
    profile.experience.reduce((total, { notable }) => total + notable.length, 0),
  )
  // the volunteer investigation stays deliberately unquantified
  await expect(section.locator('.chapter__outcome')).not.toContainText(['4,800'])

  // every card carries a picture now, and every one of them is described
  const photos = section.locator('.chapter__photo img')
  await expect(photos).toHaveCount(profile.experience.filter(({ photo }) => photo).length)
  for (const alt of await photos.evaluateAll((els) => els.map((e) => e.alt))) {
    expect(alt.length).toBeGreaterThan(20)
  }

  // the borrowed photographs are credited in the page footer, not on the cards
  // where the credit line crowded the caption off the card
  await expect(section.locator('.photo-credit')).toHaveCount(0)
  const credits = page.locator('.font-credit--photos')
  await expect(credits).toContainText('Sukhna Lake')
  await expect(credits.locator('a[rel~="license"]')).toHaveCount(
    profile.experience.filter(({ photo }) => photo?.credit).length,
  )
})

test('career chapter fronts contain every record without distortion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    expect(await page.locator('.chapter').evaluateAll((chapters) => chapters.map((chapter) => {
      const face = chapter.querySelector('.chapter__face--front')
      const faceBounds = face.getBoundingClientRect()
      const turnBounds = chapter.querySelector('.chapter__turn').getBoundingClientRect()
      return {
        company: chapter.querySelector('.chapter__company').textContent.trim(),
        contained: face.scrollHeight <= face.clientHeight && turnBounds.bottom <= faceBounds.bottom + 0.5,
      }
    }))).toEqual(profile.experience.map(({ company }) => ({ company, contained: true })))
  }
})

test('career photographs are framed, not cropped a second time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const frames = page.locator(
    '.experience__frontispiece img, .chapter__photo img, .chapter__scene img',
  )
  const frameCount = 1 + profile.experience.reduce(
    (total, role) => total + Number(Boolean(role.photo)) + Number(Boolean(role.scene)),
    0,
  )
  await expect(frames).toHaveCount(frameCount)
  await page.locator('.experience').scrollIntoViewIfNeeded()

  for (let i = 0; i < frameCount; i += 1) {
    await frames.nth(i).scrollIntoViewIfNeeded()
    await expect
      .poll(() => frames.nth(i).evaluate((e) => e.complete && e.naturalWidth > 0))
      .toBe(true)

    const fit = await frames.nth(i).evaluate((img) => {
      const box = img.getBoundingClientRect()
      return {
        src: img.getAttribute('src'),
        rendered: box.width / box.height,
        source: img.naturalWidth / img.naturalHeight,
        anchored: getComputedStyle(img).objectPosition,
        described: img.alt.length,
      }
    })

    // the export has to match the slot: a mismatch means object-fit crops the
    // subject a second time, which is what sliced the photograph before
    expect(Math.abs(fit.rendered - fit.source), fit.src).toBeLessThan(0.06)
    // every frame names its own anchor rather than trusting the middle
    expect(fit.anchored, fit.src).not.toBe('50% 50%')
    expect(fit.described, fit.src).toBeGreaterThan(15)
  }
})

test('rail motion is opted into, so reduced motion gets the finished layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  const still = await page.locator('.chapter__face--front').first().evaluate((el) => ({
    animation: getComputedStyle(el).animationName,
    scale: getComputedStyle(el).scale,
    filter: getComputedStyle(el).filter,
  }))
  expect(still.animation).toBe('none')
  expect(still.filter).toBe('none')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  const moving = await page
    .locator('.chapter__face--front')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName)
  // only where scroll timelines exist; elsewhere the static layout is correct
  const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'))
  expect(moving).toBe(supported ? 'chapter-develop' : 'none')
})

test('a plate develops as it reaches the middle of the window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  if (!(await page.evaluate(() => CSS.supports('animation-timeline: view()')))) return

  const read = async (left) => {
    await page.evaluate((x) => {
      document.querySelector('.experience__rail').scrollLeft = x
    }, left)
    await page.waitForTimeout(200)
    return page.evaluate(() => {
      const face = document.querySelector('.chapter__face--front')
      const img = document.querySelector('.chapter__photo img')
      const scale = getComputedStyle(face).scale
      return {
        // a timeline that resolves to null leaves the animation attached but
        // never running, which is how the old card drift sat dead while its
        // animation-name still read exactly right
        live: face.getAnimations().some((a) => a.timeline && a.timeline.currentTime != null),
        saturation: Number(/saturate\(([\d.]+)\)/.exec(getComputedStyle(face).filter)?.[1] ?? NaN),
        scale: scale === 'none' ? 1 : Number(scale),
        pan: Number(getComputedStyle(img).getPropertyValue('--frame-pan').replace('%', '')),
      }
    })
  }

  const samples = []
  for (const left of [0, 200, 400, 600]) samples.push(await read(left))

  expect(samples.every((s) => s.live)).toBe(true)
  const span = (key) => Math.max(...samples.map((s) => s[key])) - Math.min(...samples.map((s) => s[key]))
  // colour has to actually drain, not merely be declared to
  expect(span('saturation')).toBeGreaterThan(0.5)
  // developing the negative must not fractionally scale and blur the whole card
  expect(samples.every(({ scale }) => scale === 1)).toBe(true)
  // and the picture pans inside its mount as the plate winds past
  expect(span('pan')).toBeGreaterThan(2)
})

test('the pixel face is reserved for machine-authored readouts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const period = page.locator('.chapter__period').first()
  await expect(period).toHaveCSS('font-family', /Mackie Pixel/)
  // bitmap glyphs sit on a pixel grid, so a fractional size smears the stems
  await expect(period).toHaveCSS('font-size', '12px')
  // editorial voice stays in the text faces
  await expect(page.locator('.chapter__company').first()).toHaveCSS('font-family', /Danviska/)
  await expect(page.locator('.chapter__learnt p').first()).toHaveCSS('font-family', /Caveat/)
})

test('reduced motion moves the rail without coasting', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const rail = page.locator('.experience__rail')
  await rail.scrollIntoViewIfNeeded()
  await rail.evaluate((el) =>
    el.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 100, shiftKey: true, bubbles: true, cancelable: true }),
    ),
  )
  await page.waitForTimeout(80)
  const straightAway = await rail.evaluate((el) => el.scrollLeft)
  await page.waitForTimeout(700)
  const later = await rail.evaluate((el) => el.scrollLeft)

  // it moves at once and then stops: no ramp, no coasting. Snap may ease it to a
  // resting chapter, so the exact pixel is not the contract; the absence of
  // momentum is.
  expect(straightAway).toBeGreaterThan(0)
  expect(Math.abs(later - straightAway)).toBeLessThan(60)

  // nothing smooths or intercepts the document's own scrolling, which is what
  // keeps find-in-page, scroll anchoring and assistive tech behaving normally
  const behaviour = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollBehavior,
  )
  expect(behaviour).toBe('auto')
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(100)
  await page.evaluate(() => scrollBy(0, 400))
  expect(await page.evaluate(() => scrollY)).toBe(400)
})

// Real pointer targeting/capture is covered by the drag test below. Keep throw
// timing in-page so worker load cannot turn protocol latency into a stale release.
async function dragStickyNote(note, { distance, hold = 0 }) {
  return note.evaluate(async (element, options) => {
    element.setPointerCapture = () => {}
    element.releasePointerCapture = () => {}
    const send = (type, clientX) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX,
      clientY: 100,
      pointerId: 17,
    }))

    send('pointerdown', 200)
    for (let step = 1; step <= 4; step += 1) {
      send('pointermove', 200 + options.distance * (step / 4))
    }
    send('pointermove', 200 + options.distance)
    await new Promise(requestAnimationFrame)
    const released = Number.parseFloat(getComputedStyle(element).getPropertyValue('--note-x'))
    if (options.hold) await new Promise((resolve) => setTimeout(resolve, options.hold))
    send('pointerup', 200 + options.distance)
    return released
  }, { distance, hold })
}

test('a thrown note keeps travelling and stays within reach', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const rail = page.locator('.experience__rail')
  await rail.scrollIntoViewIfNeeded()
  // the note sits under the portrait at the head of the rail now
  await rail.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
  await page.emulateMedia({ reducedMotion: 'no-preference' })

  const note = page.locator('.sticky-note')
  const released = await dragStickyNote(note, { distance: -120 })
  await expect.poll(() => note.evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).getPropertyValue('--note-x'))
  ))).toBeLessThan(released)

  // let go in motion, it coasts past the point the pointer let go of it
  expect(released).toBeLessThan(0)
  // and never past its tether, so a hard throw cannot lose it off the rail
  const carried = await note.evaluate((el) =>
    Math.abs(parseFloat(getComputedStyle(el).getPropertyValue('--note-x'))),
  )
  expect(carried).toBeLessThanOrEqual(260)
})

test('a held note stays where it is released', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const note = page.locator('.sticky-note')
  const placed = await dragStickyNote(note, { distance: 80, hold: 550 })
  await note.evaluate(() => new Promise((resolve) => {
    let frames = 0
    const wait = () => {
      frames += 1
      if (frames === 3) resolve()
      else requestAnimationFrame(wait)
    }
    requestAnimationFrame(wait)
  }))
  expect(await note.evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).getPropertyValue('--note-x'))
  ))).toBeCloseTo(placed, 0)
})

test('pictures drift against vertical scroll, and hold still when asked', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  const frame = page.locator('.chapter__photo img').first()
  const supported = await page.evaluate(() => CSS.supports('animation-timeline: view()'))

  if (supported) {
    // Sample the whole reachable scroll range and measure how far things
    // actually travel. Asserting only that a value changed is what let a 7px
    // effect ship: it was technically animating and visibly nothing.
    // The window is the section's own pass, not the tail of the document:
    // anything added below the strip used to move the sampled range off it.
    const pass = await page.evaluate(() => {
      const section = document.querySelector('.experience')
      const top = section.getBoundingClientRect().top + scrollY
      return {
        from: Math.max(0, top - innerHeight * 0.8),
        to: Math.min(document.documentElement.scrollHeight - innerHeight, top + section.offsetHeight),
      }
    })
    const step = Math.max(50, Math.round((pass.to - pass.from) / 12))
    const samples = []
    for (let y = pass.from; y <= pass.to; y += step) {
      await page.evaluate((to) => scrollTo(0, to), y)
      await page.waitForTimeout(150)
      samples.push(
        await page.evaluate(() => {
          const card = document.querySelector('.chapter:has(.chapter__photo)')
          const picture = card.querySelector('.chapter__photo img')
          return {
            card: card.getBoundingClientRect().top,
            // the picture's offset inside its own card: the card lagging the
            // page moves both together, so only this shows real parallax
            inside: picture.getBoundingClientRect().top - card.getBoundingClientRect().top,
          }
        }),
      )
    }

    const span = (key) => {
      const values = samples.map((s) => s[key])
      return Math.max(...values) - Math.min(...values)
    }
    // the card is one object that lags the page, and the picture drifts on
    // inside it: two layers, or the strip is a flat sheet
    expect(span('card')).toBeGreaterThan(100)
    expect(span('inside')).toBeGreaterThan(8)
    // and the range has to be reachable: this section never leaves the top of
    // the viewport, so a range that assumes it does is mostly unscrollable.
    // Settled means stopped, not sitting at zero.
    expect(Math.abs(samples.at(-1).inside - samples.at(-2).inside)).toBeLessThan(3)

    // the page itself is never the thing being animated
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  }

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  const still = await frame.evaluate((el) => ({
    animation: getComputedStyle(el).animationName,
    scale: getComputedStyle(el).scale,
  }))
  expect(still.animation).toBe('none')
  expect(still.scale).toBe('none')

  const cards = await page.locator('.chapter').first().evaluate((el) => ({
    animation: getComputedStyle(el).animationName,
    translate: getComputedStyle(el).translate,
  }))
  expect(cards.animation).toBe('none')
  expect(cards.translate).toBe('none')
})

test('the career heading holds the page measure while the window sits centred', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const box = (selector) =>
    page.locator(selector).first().evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { left: Math.round(r.left), right: Math.round(innerWidth - r.right), width: Math.round(r.width) }
    })

  const deck = await box('.achievement-deck__inner')
  expect((await box('.experience__head')).left).toBe(deck.left)

  // the strip is wider than the page measure, and centred rather than pinned
  for (const part of ['.experience__window', '.experience__axis']) {
    const it = await box(part)
    expect(it.width, part).toBeGreaterThan(deck.width)
    expect(Math.abs(it.left - it.right), part).toBeLessThanOrEqual(1)
  }
})

test('a card leans toward the pointer and settles back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const face = page.locator('.chapter__face--front').first()
  const angle = async () => {
    const value = await face.evaluate((el) => getComputedStyle(el).rotate)
    return Number(/(-?[\d.]+)deg/.exec(value)?.[1] ?? 0)
  }

  expect(await angle()).toBe(0)

  const card = page.locator('.chapter').first()
  const box = await card.boundingBox()
  const hoverPosition = { x: box.width * 0.85, y: box.height * 0.18 }
  await card.hover({ position: hoverPosition })
  // polled rather than sampled after a fixed wait: the assertion is that the
  // card leans and then settles, not that it does so by one arbitrary moment
  await expect.poll(angle, { timeout: 3000 }).toBeGreaterThan(3)

  // the sheen tracks the pointer, so the card catches light where it is touched
  const sheen = await face.evaluate((el) => getComputedStyle(el).backgroundImage)
  expect(sheen).toContain('radial-gradient')

  await page.mouse.move(4, 4)
  await expect.poll(angle, { timeout: 3000 }).toBe(0)

  // and it never leans for a visitor who asked for less motion
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.locator('.chapter').first().hover({ position: hoverPosition })
  await page.waitForTimeout(300)
  expect(await angle()).toBe(0)
})

test('a print keeps its metadata hidden until the card is hovered', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const read = () =>
    page.evaluate(() => {
      const figure = document.querySelector('.chapter__photo')
      return {
        meta: Number(getComputedStyle(figure.querySelector('figcaption')).opacity),
        // the overlay is out of flow, so the print must not move when it shows
        print: Math.round(figure.getBoundingClientRect().height),
      }
    })

  const rest = await read()
  expect(rest.meta).toBe(0)

  const card = await page.locator('.chapter:has(.chapter__photo)').first().boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  // polled, not sampled after a fixed wait: a slower machine had the fade at
  // 0.91 when the wait expired, which says nothing about whether it reveals
  await expect.poll(async () => (await read()).meta, { timeout: 3000 }).toBe(1)

  const hovered = await read()
  expect(hovered.print).toBe(rest.print)

  // both facts are there once revealed, and neither is cut off
  const labels = await page.evaluate(() => {
    const figure = document.querySelector('.chapter__photo')
    const read = (sel) => {
      const el = figure.querySelector(sel)
      return { text: el.textContent.trim(), clipped: el.scrollWidth > el.clientWidth + 1 }
    }
    return [read('.photo-where'), read('.photo-what')]
  })
  for (const label of labels) {
    expect(label.text.length).toBeGreaterThan(3)
    expect(label.clipped, label.text).toBe(false)
  }
})

test('the drawing wears the same gold filigree as the achievement window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const ornament = await page.evaluate(() => {
    const filigree = document.querySelector('.portrait-filigree')
    const frame = document.querySelector('.experience__frontispiece .photo-frame').getBoundingClientRect()
    const box = filigree.getBoundingClientRect()
    const caption = document.querySelector('.experience__frontispiece figcaption').getBoundingClientRect()
    const lowest = Math.max(
      ...[...filigree.querySelectorAll('.achievement-filigree__corner')].map(
        (corner) => corner.getBoundingClientRect().bottom,
      ),
    )
    return {
      corners: filigree.querySelectorAll('.achievement-filigree__corner').length,
      opacity: Number(getComputedStyle(filigree).opacity),
      // reduced motion has no draw-on, so the ornament must already be drawn
      dashoffset: getComputedStyle(
        filigree.querySelector('.achievement-filigree__path--stem'),
      ).strokeDashoffset,
      leaf: getComputedStyle(
        filigree.querySelector('.achievement-filigree__leaves path'),
      ).transform,
      surrounds: {
        left: Math.round(box.left - frame.left),
        top: Math.round(box.top - frame.top),
      },
      clearsCaption: Math.round(caption.top - lowest),
      copies: document.querySelectorAll('.achievement-filigree').length,
    }
  })

  expect(ornament.corners).toBe(4)
  expect(ornament.opacity).toBe(1)
  expect(ornament.dashoffset).toBe('0px')
  expect(ornament.leaf).toBe('matrix(1, 0, 0, 1, 0, 0)')
  // it frames the picture rather than floating somewhere near it
  expect(ornament.surrounds.left).toBeLessThan(0)
  expect(ornament.surrounds.top).toBeLessThan(0)
  // and its lower corners do not sit on the plate caption
  expect(ornament.clearsCaption).toBeGreaterThanOrEqual(0)
  // the achievement window keeps its own: this is shared markup, not moved
  expect(ornament.copies).toBe(2)

  await page.emulateMedia({ forcedColors: 'active' })
  await expect(page.locator('.portrait-filigree')).toBeHidden()
})

test('the artist credit is written in a letter at a time on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const read = () =>
    page.evaluate(() => {
      const letters = [...document.querySelectorAll('.plate-credit__letter')]
      const axis = (el, name) =>
        Number(new RegExp(`"${name}" ([\\d.]+)`).exec(getComputedStyle(el).fontVariationSettings)?.[1])
      return {
        block: Number(getComputedStyle(document.querySelector('.plate-credit')).opacity),
        letters: letters.map((el) => Number(getComputedStyle(el).opacity)),
        weight: axis(letters[0], 'wght'),
        casual: axis(letters[0], 'CASL'),
        underline: getComputedStyle(document.querySelector('.plate-credit__name')).backgroundSize,
        delays: letters.map((el) => Number.parseFloat(getComputedStyle(el).transitionDelay)),
      }
    })

  // hidden by opacity, not removed: the attribution stays in the accessible
  // tree and is announced whether or not anyone can hover
  await expect(page.locator('.plate-credit')).toContainText('Drawn by Sugarplum')
  const rest = await read()
  expect(rest.block).toBe(0)
  expect(rest.letters.every((o) => o === 0)).toBe(true)
  expect(rest.underline).toBe('0px 1px')

  // The cascade is the per-letter delay, which is a stable property. Sampling
  // the wave of opacities instead only holds during the ~470ms it lasts, and a
  // loaded machine misses that window entirely and then never sees it again.
  expect(rest.delays).toEqual([...rest.delays].sort((a, b) => a - b))
  expect(rest.delays.at(-1)).toBeGreaterThan(rest.delays[0])

  const frontispiece = page.locator('.experience__frontispiece')
  const height = await page.locator('.experience__index').evaluate((el) => el.getBoundingClientRect().height)
  await frontispiece.hover()

  await expect.poll(async () => (await read()).weight, { timeout: 3000 }).toBe(780)
  // polled separately: the rule takes 460ms against the letters' 300ms, so
  // waiting only for the weight caught it mid-draw at 99.85%
  await expect.poll(async () => (await read()).underline, { timeout: 3000 }).toBe('100% 1px')
  // and the last letter lands after the rule does, 208ms of stagger plus its
  // own 260ms against the rule's 460ms, so it needs polling in its own right
  await expect
    .poll(async () => (await read()).letters.every((o) => o === 1), { timeout: 3000 })
    .toBe(true)

  const shown = await read()
  expect(shown.block).toBe(1)
  expect(shown.casual).toBe(1)

  // laid across the head of the print, inside its edges, and revealing it
  // must not shift the column underneath
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector('.experience__frontispiece .photo-frame').getBoundingClientRect()
    const credit = document.querySelector('.plate-credit').getBoundingClientRect()
    const words = [...document.querySelectorAll('.plate-credit__letter')].map((el) => el.getBoundingClientRect())
    return {
      fromTop: Math.round(credit.top - frame.top),
      spillLeft: Math.round(frame.left - Math.min(...words.map((w) => w.left))),
      spillRight: Math.round(Math.max(...words.map((w) => w.right)) - frame.right),
    }
  })
  expect(geometry.fromTop).toBeLessThanOrEqual(2)
  expect(geometry.spillLeft).toBeLessThanOrEqual(0)
  expect(geometry.spillRight).toBeLessThanOrEqual(0)
  expect(
    await page.locator('.experience__index').evaluate((el) => el.getBoundingClientRect().height),
  ).toBe(height)

  // reduced motion still arrives at the same state, it just does not travel
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  expect(
    await page.locator('.plate-credit__letter').first().evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe('0s')
  await page.locator('.experience__frontispiece').hover()
  await page.waitForTimeout(200)
  expect((await read()).block).toBe(1)
})

test('without hover the artist credit simply stays visible', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 430, height: 900 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage()
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  // there is no hover to reveal with, so the credit is never withheld
  await expect(page.locator('.plate-credit')).toBeVisible()
  expect(
    await page.locator('.plate-credit').evaluate((el) => Number(getComputedStyle(el).opacity)),
  ).toBe(1)
  await context.close()
})

test('the album holds one stamp per project and opens its catalogue page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.locator('.album').scrollIntoViewIfNeeded()

  const stamps = page.locator('.stamp')
  await expect(stamps).toHaveCount(profile.projects.length)
  await expect(page.locator('.album__name')).toHaveText(profile.projects[0].name)

  const exploitrank = page.locator('.stamp', { hasText: 'ExploitRank' })
  await exploitrank.click()
  await expect(page.locator('.album__name')).toHaveText('ExploitRank')
  await expect(exploitrank).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.album__prompt')).toHaveCount(0)

  // every link must resolve; a private repository shows a note instead
  const links = page.locator('.album__links a')
  await expect(links).toHaveCount(2)
  await expect(page.getByRole('link', { name: 'Case study', exact: true })).toHaveAttribute(
    'href',
    'https://rinz0x0cruz.github.io/blog/fixed-budget-vulnerability-triage/',
  )
  for (const href of await links.evaluateAll((els) => els.map((el) => el.href))) {
    expect(href).toMatch(/^https:\/\/(github\.com|rinz0x0cruz\.github\.io)\//)
  }

  // clicking the held stamp keeps the useful record open
  await exploitrank.click()
  await expect(page.locator('.album__name')).toHaveText('ExploitRank')
  await expect(exploitrank).toHaveAttribute('aria-pressed', 'true')
})

test('public project records route reviewers to their evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.locator('.album').scrollIntoViewIfNeeded()

  const projects = [
    {
      name: 'jobscope',
      links: {
        'Source': 'https://github.com/rinz0x0cruz/jobscope',
        'Offline review': 'https://github.com/rinz0x0cruz/jobscope#review-path-offline',
      },
    },
    {
      name: 'quorum',
      links: {
        'Case study': 'https://rinz0x0cruz.github.io/blog/benchmark-before-you-debate/',
        'Offline review': 'https://github.com/rinz0x0cruz/quorum#review-path-offline',
      },
    },
    {
      name: 'malscope',
      links: {
        'Live dashboard': 'https://rinz0x0cruz.github.io/malscope-dashboard/',
        'Case study': 'https://rinz0x0cruz.github.io/blog/publishing-malware-analysis-evidence/',
      },
    },
  ]

  for (const project of projects) {
    await page.locator('.stamp', { hasText: project.name }).click()
    for (const [label, href] of Object.entries(project.links)) {
      await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.album').scrollIntoViewIfNeeded()
  await page.locator('.stamp', { hasText: 'ExploitRank' }).click()
  expect(await page.locator('.album__page').evaluate((catalogue) => {
    const bounds = catalogue.getBoundingClientRect()
    return {
      linksContained: [...catalogue.querySelectorAll('.album__links a')].every((link) => {
        const linkBounds = link.getBoundingClientRect()
        return linkBounds.left >= bounds.left && linkBounds.right <= bounds.right
      }),
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
    }
  })).toEqual({ linksContained: true, pageOverflow: 0 })
})

test('artifacts occupy separate page gutters without the left hero fragment', async ({ page }) => {
  const fragmentRequests = []
  page.on('request', (request) => {
    if (request.url().includes('fragmentary-head')) fragmentRequests.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  await expect(page.locator('[data-artifact-name="head"]')).toHaveCount(0)
  await expect(page.locator('[data-artifact-name]')).toHaveCount(3)
  await expect(page.locator('[data-model-state="ready"]', { has: page.locator('[data-artifact-name]') })).toHaveCount(0)
  await page.locator('[data-artifact-name="helios"]').hover()
  await expect(page.locator('[data-artifact-name="helios"][data-model-state="ready"]')).toHaveCount(1, { timeout: 15_000 })
  await page.locator('.achievement-deck').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-artifact-name="sun"][data-model-state="ready"]')).toHaveCount(1, { timeout: 15_000 })
  await page.locator('.album').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-artifact-name="moon"][data-model-state="ready"]')).toHaveCount(1, { timeout: 15_000 })

  const placement = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    artifacts: Object.fromEntries([...document.querySelectorAll('[data-artifact-name]')].map((artifact) => {
      const bounds = artifact.getBoundingClientRect()
      const owner = artifact.closest('section')
      return [artifact.dataset.artifactName, {
        owner: owner?.className ?? '',
        left: bounds.left,
        right: bounds.right,
        top: bounds.top + scrollY,
      }]
    })),
  }))
  const { artifacts } = placement
  expect(artifacts.helios.owner).toContain('scene')
  expect(artifacts.sun.owner).toContain('achievement-deck')
  expect(artifacts.moon.owner).toContain('album')
  expect(artifacts.helios.top).toBeLessThan(artifacts.sun.top)
  expect(artifacts.sun.top).toBeLessThan(artifacts.moon.top)
  expect(artifacts.helios.left).toBeGreaterThan(placement.viewportWidth / 2)
  expect(artifacts.sun.right).toBeLessThan(placement.viewportWidth / 2)
  expect(artifacts.moon.left).toBeGreaterThan(placement.viewportWidth / 2)
  expect(fragmentRequests).toEqual([])
})

test('scattered reliefs load with complete fallbacks and provenance', async ({ page }) => {
  const reliefRequests = []
  page.on('request', (request) => {
    if (request.url().includes('/models/tarot/') || request.url().includes('/models/artifacts/')) {
      reliefRequests.push(new URL(request.url()).pathname)
    }
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  const hero = page.locator('.tarot-hanging--hero')
  const heroSlots = hero.locator('[data-tarot-slot]')
  await expect(heroSlots).toHaveCount(1)
  await expect(page.locator('.tarot-hanging__sculpture--upper')).toHaveCount(0)
  await expect(page.locator('.tarot-hanging__sculpture--helios img')).toHaveAttribute('src', '/models/artifacts/helios.webp')
  expect(await heroSlots.locator('img').evaluateAll((images) => images.map((image) => image.alt))).toEqual([''])
  await expect.poll(() => heroSlots.locator('img').evaluateAll((images) => (
    images.map((image) => image.naturalWidth)
  )), { timeout: 15_000 }).toEqual([280])
  await heroSlots.hover()
  await expect(hero.locator('[data-model-state="ready"]')).toHaveCount(1, { timeout: 15_000 })
  await expect(hero).toHaveAttribute('data-render-state', 'ready')
  await expect(hero.locator('canvas')).toHaveAttribute('data-render-state', 'ready')

  const sunStage = page.locator('.tarot-hanging--sun')
  const moonStage = page.locator('.tarot-hanging--moon')
  await sunStage.scrollIntoViewIfNeeded()
  await moonStage.scrollIntoViewIfNeeded()
  const cards = page.locator('.tarot-hanging__card')
  await expect(cards).toHaveCount(2)
  await expect(sunStage.locator('[data-tarot-slot]')).toHaveCount(1)
  await expect(moonStage.locator('[data-tarot-slot]')).toHaveCount(1)
  await expect(page.locator('.tarot-hanging__card--sun img')).toHaveAttribute('src', '/tarot-sun.webp')
  await expect(page.locator('.tarot-hanging__card--moon img')).toHaveAttribute('src', '/tarot-moon.webp')
  expect(await cards.locator('img').evaluateAll((images) => images.map((image) => image.alt))).toEqual(['', ''])
  await expect.poll(() => cards.locator('img').evaluateAll((images) => (
    images.map((image) => image.naturalWidth)
  ))).toEqual([128, 116])
  expect(await cards.locator('img').evaluateAll((images) => (
    images.map((image) => new URL(image.currentSrc).pathname)
  ))).toEqual(['/tarot-sun-256.webp', '/tarot-moon-256.webp'])
  for (const stage of [sunStage, moonStage]) {
    await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(1)
    await expect(stage).toHaveAttribute('data-render-state', 'ready')
    await expect(stage.locator('canvas')).toHaveAttribute('data-render-state', 'ready')
  }
  expect(await page.locator('.tarot-hanging [data-model-state="ready"]').evaluateAll((slots) => (
    slots.map((slot) => Number(slot.dataset.reliefDepth))
  ))).toEqual(expect.arrayContaining([expect.any(Number), expect.any(Number)]))
  expect(await page.locator('.tarot-hanging [data-model-state="ready"]').evaluateAll((slots) => (
    slots.every((slot) => Number(slot.dataset.reliefDepth) > 0.25)
  ))).toBe(true)
  expect(reliefRequests.sort()).toEqual([
    '/models/artifacts/helios.glb',
    '/models/artifacts/helios.webp',
    '/models/tarot/moon-atlas.webp',
    '/models/tarot/moon.glb',
    '/models/tarot/sun-atlas.webp',
    '/models/tarot/sun.glb',
  ])
  const artifactCredit = page.locator('.font-credit--artifacts')
  await expect(artifactCredit).toContainText('Helios statue')
  await expect(artifactCredit).not.toContainText('Fragmentary colossal marble head of youth')
  expect(await artifactCredit.locator('a').evaluateAll((links) => links.map((link) => link.href))).toEqual([
    'https://sketchfab.com/3d-models/helios-statue-48a564cc64554bb9961eaad5216d2f2e',
    'https://sketchfab.com/kolen',
    'https://creativecommons.org/licenses/by/4.0/',
  ])

  const readSilhouettes = (target) => target.evaluate((root) => {
    const canvas = root.querySelector('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const rootBounds = root.getBoundingClientRect()
    const scaleX = canvas.width / rootBounds.width
    const scaleY = canvas.height / rootBounds.height

    return [...root.querySelectorAll('[data-model-state="ready"]')].map((slot) => {
      const slotBounds = slot.getBoundingClientRect()
      const left = Math.max(0, Math.floor((slotBounds.left - rootBounds.left) * scaleX))
      const bottom = Math.max(0, Math.floor((rootBounds.bottom - slotBounds.bottom) * scaleY))
      const width = Math.min(canvas.width - left, Math.ceil(slotBounds.width * scaleX))
      const height = Math.min(canvas.height - bottom, Math.ceil(slotBounds.height * scaleY))
      const pixels = new Uint8Array(width * height * 4)
      context.readPixels(left, bottom, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
      let count = 0
      const rows = Array(height).fill(0)
      const columns = Array(width).fill(0)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (pixels[(y * width + x) * 4 + 3] <= 16) continue
          count += 1
          rows[y] += 1
          columns[x] += 1
        }
      }
      return {
        name: slot.dataset.artifactName,
        density: count / (width * height),
        continuousRows: rows.filter((row) => row >= width * 0.5).length / height,
        continuousColumns: columns.filter((column) => column >= height * 0.5).length / width,
      }
    })
  })
  const silhouettes = [
    ...(await readSilhouettes(sunStage)),
    ...(await readSilhouettes(moonStage)),
  ]
  expect(silhouettes).toHaveLength(2)
  expect(silhouettes.every(({ density, continuousRows, continuousColumns }) => (
    density > 0.5 && continuousRows > 0.75 && continuousColumns > 0.65
  ))).toBe(true)
  const heroSilhouettes = await readSilhouettes(hero)
  expect(heroSilhouettes).toHaveLength(1)
  expect(heroSilhouettes.every(({ density }) => (
    density > 0.08
  ))).toBe(true)

  const desktop = await page.evaluate(() => {
    const album = document.querySelector('.album')
    const albumBounds = album.getBoundingClientRect()
    const window = document.querySelector('.album__window').getBoundingClientRect()
    const hanging = [
      document.querySelector('.tarot-hanging--sun'),
      document.querySelector('.tarot-hanging--moon'),
    ]
    const hero = document.querySelector('.tarot-hanging--hero')
    const card = document.querySelector('.identity-card').getBoundingClientRect()
    const deck = document.querySelector('.achievement-deck__inner').getBoundingClientRect()
    const cards = [...document.querySelectorAll('.tarot-hanging__card')]
    const artifacts = [...document.querySelectorAll('.tarot-hanging--sun [data-tarot-slot], .tarot-hanging--moon [data-tarot-slot]')].map((slot) => {
      const box = slot.getBoundingClientRect()
      return {
        name: slot.dataset.artifactName,
        left: box.left,
        right: box.right,
        inViewport: box.left >= 0 && box.right <= innerWidth,
      }
    })
    const heroArtifacts = [...hero.querySelectorAll('[data-tarot-slot]')].map((slot) => {
      const box = slot.getBoundingClientRect()
      return {
        name: slot.dataset.artifactName,
        bottom: box.bottom,
        height: box.height,
        left: box.left,
        right: box.right,
        top: box.top,
        width: box.width,
        inViewport: box.left >= 0 && box.right <= innerWidth,
      }
    })
    const helios = heroArtifacts[0]
    return {
      albumLeft: albumBounds.left,
      albumRight: albumBounds.right,
      deckLeft: deck.left,
      hidden: hanging.every((root) => root.getAttribute('aria-hidden') === 'true'),
      heroHidden: hero.getAttribute('aria-hidden'),
      heroDisplay: getComputedStyle(hero).display,
      overflow: document.documentElement.scrollWidth - innerWidth,
      moonInsideAlbum: album.contains(hanging[1]),
      sunInsideDeck: document.querySelector('.achievement-deck').contains(hanging[0]),
      cards: cards.map((card) => {
        const box = card.getBoundingClientRect()
        return {
          inViewport: box.left >= 0 && box.right <= innerWidth,
          thread: Number.parseFloat(getComputedStyle(card, '::before').height),
          width: box.width,
        }
      }),
      artifacts,
      heroArtifacts,
      rightGap: helios.left - card.right,
      sunGap: deck.left - artifacts[0].right,
      windowInsideAlbum: window.left >= albumBounds.left && window.right <= albumBounds.right,
    }
  })
  expect(desktop.hidden).toBe(true)
  expect(desktop.heroHidden).toBe('true')
  expect(desktop.heroDisplay).toBe('block')
  expect(desktop.overflow).toBe(0)
  expect(desktop.moonInsideAlbum).toBe(true)
  expect(desktop.sunInsideDeck).toBe(true)
  expect(desktop.windowInsideAlbum).toBe(true)
  expect(desktop.cards.every(({ inViewport, thread, width }) => (
    inViewport && thread > 20 && width >= 110
  ))).toBe(true)
  expect(desktop.artifacts.every(({ inViewport }) => inViewport)).toBe(true)
  expect(desktop.sunGap).toBeGreaterThanOrEqual(24)
  expect(desktop.artifacts[1].left).toBeGreaterThanOrEqual(desktop.albumRight - 8)
  expect(desktop.artifacts[1].left - desktop.artifacts[0].right).toBeGreaterThan(900)
  expect(desktop.heroArtifacts.every(({ inViewport }) => inViewport)).toBe(true)
  const heroArtifact = Object.fromEntries(desktop.heroArtifacts.map((item) => [item.name, item]))
  expect(heroArtifact.helios.width).toBeGreaterThanOrEqual(147)
  expect(desktop.rightGap).toBeGreaterThanOrEqual(16)
  const artifact = Object.fromEntries(desktop.artifacts.map((item) => [item.name, item]))
  expect(artifact.sun.right).toBeLessThan(artifact.moon.left)

  await page.setViewportSize({ width: 1366, height: 650 })
  await expect(hero).toBeVisible()
  const laptop = await page.evaluate(() => {
    const card = document.querySelector('.identity-card').getBoundingClientRect()
    const root = document.querySelector('.tarot-hanging--hero')
    const artifacts = [...root.querySelectorAll('[data-tarot-slot]')].map((slot) => {
      const bounds = slot.getBoundingClientRect()
      return {
        name: slot.dataset.artifactName,
        overlapsCard: bounds.left < card.right
          && bounds.right > card.left
          && bounds.top < card.bottom
          && bounds.bottom > card.top,
        width: bounds.width,
      }
    })
    const helios = root.querySelector('[data-artifact-name="helios"]').getBoundingClientRect()
    return {
      artifacts,
      overflow: document.documentElement.scrollWidth - innerWidth,
      renderState: root.dataset.renderState,
      rightGap: helios.left - card.right,
      visibleArtifacts: artifacts.map(({ name }) => name),
    }
  })
  expect(laptop.visibleArtifacts).toEqual(['helios'])
  expect(laptop.artifacts.every(({ overlapsCard, width }) => !overlapsCard && width > 0)).toBe(true)
  expect(laptop.rightGap).toBeGreaterThanOrEqual(8)
  expect(laptop.overflow).toBe(0)
  expect(laptop.renderState).toBe('ready')
  const laptopTarot = await page.evaluate(() => {
    const deck = document.querySelector('.achievement-deck__inner').getBoundingClientRect()
    const artifacts = [...document.querySelectorAll('.tarot-hanging--sun [data-tarot-slot], .tarot-hanging--moon [data-tarot-slot]')].map((slot) => {
      const bounds = slot.getBoundingClientRect()
      return {
        left: bounds.left,
        right: bounds.right,
        inViewport: bounds.left >= 0 && bounds.right <= innerWidth,
      }
    })
    return {
      artifacts,
      gap: artifacts[1].left - artifacts[0].right,
      sunGap: deck.left - artifacts[0].right,
    }
  })
  expect(laptopTarot.artifacts.every(({ inViewport }) => inViewport)).toBe(true)
  expect(laptopTarot.gap).toBeGreaterThan(900)
  expect(laptopTarot.sunGap).toBeGreaterThanOrEqual(24)
  expect(await cards.evaluateAll((elements) => elements.every((card) => {
    const box = card.getBoundingClientRect()
    return box.left >= 0 && box.right <= innerWidth
  }))).toBe(true)

  await page.setViewportSize({ width: 1359, height: 700 })
  await expect(hero).toBeHidden()

  await page.setViewportSize({ width: 1366, height: 640 })
  await expect(hero).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.album').scrollIntoViewIfNeeded()
  const mobile = await page.evaluate(() => {
    const hero = document.querySelector('.tarot-hanging--hero')
    const achievementWindow = document.querySelector('.achievement-window').getBoundingClientRect()
    const roots = [
      document.querySelector('.tarot-hanging--sun'),
      document.querySelector('.tarot-hanging--moon'),
    ]
    const artifacts = roots.map((root) => root.querySelector('[data-tarot-slot]').getBoundingClientRect())
    return {
      heroHidden: getComputedStyle(hero).display === 'none',
      contained: artifacts.every((artifact) => artifact.left >= 0 && artifact.right <= innerWidth),
      canvasContained: roots.every((root) => {
        const hanging = root.getBoundingClientRect()
        const canvas = root.querySelector('canvas').getBoundingClientRect()
        return Math.abs(canvas.width - hanging.width) < 0.5
          && Math.abs(canvas.height - hanging.height) < 0.5
      }),
      largeEnough: artifacts.every((artifact) => artifact.width >= 110),
      overflow: document.documentElement.scrollWidth - innerWidth,
      separateSections: roots[0].closest('section').classList.contains('achievement-deck')
        && roots[1].closest('section').classList.contains('album'),
      sunGap: roots[0].getBoundingClientRect().top - achievementWindow.bottom,
    }
  })
  expect(mobile).toMatchObject({
    heroHidden: true,
    contained: true,
    canvasContained: true,
    largeEnough: true,
    overflow: 0,
    separateSections: true,
  })
  expect(mobile.sunGap).toBeGreaterThanOrEqual(24)
  for (const stage of [sunStage, moonStage]) {
    await expect.poll(() => stage.evaluate((root) => {
      const canvas = root.querySelector('canvas')
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
      const rootBounds = root.getBoundingClientRect()
      const slotBounds = root.querySelector('[data-model-state="ready"]').getBoundingClientRect()
      const scaleX = canvas.width / rootBounds.width
      const scaleY = canvas.height / rootBounds.height
      const left = Math.max(0, Math.floor((slotBounds.left - rootBounds.left) * scaleX))
      const bottom = Math.max(0, Math.floor((rootBounds.bottom - slotBounds.bottom) * scaleY))
      const width = Math.min(canvas.width - left, Math.ceil(slotBounds.width * scaleX))
      const height = Math.min(canvas.height - bottom, Math.ceil(slotBounds.height * scaleY))
      const pixels = new Uint8Array(width * height * 4)
      context.readPixels(left, bottom, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
      let count = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) count += 1
      }
      return count > 100
    })).toBe(true)
  }

  await page.emulateMedia({ forcedColors: 'active' })
  await expect(hero).toBeHidden()
  await expect(sunStage).toBeHidden()
  await expect(moonStage).toBeHidden()
})

test('tarot cards tilt in 3D and become still for reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  const stage = page.locator('.tarot-hanging--sun')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(1)
  const canvas = stage.locator('canvas')

  await expect.poll(async () => {
    const before = Number(await canvas.getAttribute('data-render-count'))
    await page.waitForTimeout(180)
    return before > 0 && before === Number(await canvas.getAttribute('data-render-count'))
  }, { timeout: 10_000 }).toBe(true)

  const signature = () => stage.evaluate((root) => {
    const canvas = root.querySelector('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const rootBounds = root.getBoundingClientRect()
    const slotBounds = root.querySelector('.tarot-hanging__card--sun').getBoundingClientRect()
    const scaleX = canvas.width / rootBounds.width
    const scaleY = canvas.height / rootBounds.height
    const left = Math.floor((slotBounds.left - rootBounds.left) * scaleX)
    const bottom = Math.floor((rootBounds.bottom - slotBounds.bottom) * scaleY)
    const width = Math.ceil(slotBounds.width * scaleX)
    const height = Math.ceil(slotBounds.height * scaleY)
    const pixels = new Uint8Array(width * height * 4)
    context.readPixels(left, bottom, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
    let hash = 0
    for (let index = 0; index < pixels.length; index += 16) {
      hash = (hash * 31 + pixels[index] + pixels[index + 1] + pixels[index + 2] + pixels[index + 3]) >>> 0
    }
    return hash
  })

  const rest = await signature()
  const sun = await page.locator('.tarot-hanging__card--sun').boundingBox()
  await page.mouse.move(sun.x + sun.width * 0.85, sun.y + sun.height * 0.2)
  await expect.poll(signature).not.toBe(rest)

  const moonStage = page.locator('.tarot-hanging--moon')
  await moonStage.scrollIntoViewIfNeeded()
  await expect(moonStage.locator('[data-model-state="ready"]')).toHaveCount(1)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(250)
  const moonCanvas = moonStage.locator('canvas')
  const still = [
    Number(await canvas.getAttribute('data-render-count')),
    Number(await moonCanvas.getAttribute('data-render-count')),
  ]
  const moon = await page.locator('.tarot-hanging__card--moon').boundingBox()
  await page.mouse.move(moon.x + moon.width * 0.2, moon.y + moon.height * 0.8)
  await page.waitForTimeout(250)
  expect([
    Number(await canvas.getAttribute('data-render-count')),
    Number(await moonCanvas.getAttribute('data-render-count')),
  ]).toEqual(still)
})

test('artifact relief failures preserve all static fallbacks', async ({ page }) => {
  await page.route('**/models/tarot/**', (route) => route.abort())
  await page.route('**/models/artifacts/*.glb', (route) => route.abort())
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const cases = [
    [page.locator('.tarot-hanging--hero'), 280],
    [page.locator('.tarot-hanging--sun'), 128],
    [page.locator('.tarot-hanging--moon'), 116],
  ]
  for (const [stage, width] of cases) {
    await stage.scrollIntoViewIfNeeded()
    if (width === 280) await stage.locator('[data-tarot-slot]').hover()
    await expect(stage).toHaveAttribute('data-render-state', 'failed', { timeout: 15_000 })
    await expect(stage.locator('[data-model-state="failed"]')).toHaveCount(1)
    await expect(stage.locator('canvas')).toHaveAttribute('data-render-state', 'failed')
    expect(await stage.locator('img').evaluateAll((images) => images.map((image) => ({
      opacity: Number(getComputedStyle(image).opacity),
      width: image.naturalWidth,
    })))).toEqual([{ opacity: 1, width }])
  }
})

test('no stamp offers a link to a repository that is not public', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.locator('.album').scrollIntoViewIfNeeded()

  const geometry = () =>
    page.evaluate(() => ({
      window: Math.round(document.querySelector('.album__window').getBoundingClientRect().height),
      page: Math.round(document.querySelector('.album__page').getBoundingClientRect().height),
      overflow: Math.round(
        document.querySelector('.album__page').scrollHeight -
          document.querySelector('.album__page').clientHeight,
      ),
      stamps: [
        ...new Set(
          [...document.querySelectorAll('.stamp')].map((el) =>
            Math.round(el.getBoundingClientRect().height),
          ),
        ),
      ],
    }))

  const empty = await geometry()
  expect(empty).toEqual({ window: 461, page: 411, overflow: 0, stamps: [196] })

  const stamps = await page.locator('.stamp').count()
  for (let i = 0; i < stamps; i += 1) {
    await page.locator('.stamp').nth(i).click()
    const links = await page.locator('.album__links a').count()
    const note = await page.locator('.album__note').count()
    // a project either points somewhere real or says why it does not
    expect(links + note).toBeGreaterThan(0)

    // and every one draws what it does to what you give it, in stages that
    // are actually written rather than an empty diagram
    const stages = await page.locator('.album__flow li').allTextContents()
    expect(stages.length).toBeGreaterThanOrEqual(3)
    expect(stages.every((s) => s.trim().length > 0)).toBe(true)

    // three reasons to care, on every project, none of them blank
    const points = await page.locator('.album__points li').allTextContents()
    expect(points).toHaveLength(3)
    expect(points.every((p) => p.trim().length > 10)).toBe(true)
    expect(points.every((p) => p.trim().split(/\s+/).length <= 8)).toBe(true)

    // opening a catalogue page must not grow the album or stretch its stamps
    expect(await geometry()).toEqual(empty)
  }
})

test('the album rearranges and reshuffles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.locator('.album').scrollIntoViewIfNeeded()

  const order = () => page.$$eval('.stamp__name', (els) => els.map((el) => el.textContent.trim()))
  const byField = await order()

  await page.locator('.album__sort select').selectOption('name')
  const byName = await order()
  expect(byName).not.toEqual(byField)
  expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)))

  // shuffling must move the stamps and lean them, not just relabel the button
  await page.locator('.album__shuffle').click()
  await expect(page.locator('.album__shuffle')).toContainText('Reshuffle')
  // the lean is on the mount: the paper keeps its own rotate for pointer tilt
  const leans = await page.$$eval('.album__field li', (els) => els.map((el) => getComputedStyle(el).rotate))
  expect(new Set(leans).size).toBeGreaterThan(1)
  expect(await order()).toHaveLength(byName.length)
})

test('a stamp can be reached and held from the keyboard', async ({ page }) => {
  await page.goto('/')
  await page.locator('.album').scrollIntoViewIfNeeded()

  const first = page.locator('.stamp').first()
  await first.focus()
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.album__name')).toHaveCount(1)
})

test('a stamp leans away from the pointer and lifts off the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.album__field').scrollIntoViewIfNeeded()

  const paper = () =>
    page.evaluate(() => {
      const el = document.querySelector('.stamp__paper')
      const cs = getComputedStyle(el)
      const [ax, ay, , deg] = cs.rotate.split(' ')
      return {
        axis: [Number(ax), Number(ay)],
        deg: Number.parseFloat(deg),
        z: Number.parseFloat(cs.translate.split(' ')[2] ?? '0'),
      }
    })

  // there is no depth without a perspective on the parent: a rotated flat
  // element just squashes
  expect(await page.locator('.stamp').first().evaluate((el) => getComputedStyle(el).perspective)).toBe('780px')

  const rest = await paper()
  expect(rest.deg).toBe(0)

  const box = await page.locator('.stamp').first().boundingBox()
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await expect.poll(async () => (await paper()).deg, { timeout: 2000 }).toBeGreaterThan(4)
  // the lean is set per frame but the lift eases over 260ms, so reading it in
  // the same breath catches it still on the page
  await expect.poll(async () => (await paper()).z, { timeout: 2000 }).toBeGreaterThan(8)
  const topLeft = await paper()

  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8)
  await page.waitForTimeout(120)
  const bottomRight = await paper()
  // the far corner leans the other way, or the stamp is only scaling
  expect(Math.sign(bottomRight.axis[0])).toBe(-Math.sign(topLeft.axis[0]))
  expect(Math.sign(bottomRight.axis[1])).toBe(-Math.sign(topLeft.axis[1]))
})

test('a stamp stays flat when motion is not wanted', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.album__field').scrollIntoViewIfNeeded()

  const box = await page.locator('.stamp').first().boundingBox()
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await page.waitForTimeout(200)

  const flat = await page.locator('.stamp__paper').first().evaluate((el) => ({
    rotate: getComputedStyle(el).rotate,
    transition: getComputedStyle(el).transitionDuration,
  }))
  expect(flat.rotate).toBe('0 0 0 0deg')
  expect(flat.transition).toBe('0s')
})

test('languages and certifications stay in independent sections', async ({ page }) => {
  await page.goto('/')

  const languages = page.locator('.qualifications--languages')
  const certifications = page.locator('.qualifications--certifications')

  await expect(page.locator('main > .qualifications')).toHaveCount(2)
  await expect(languages.locator('h2')).toHaveText('Languages')
  await expect(languages.locator('.language-console')).toHaveCount(1)
  await expect(languages.locator('.certification-press')).toHaveCount(0)
  await expect(certifications.locator('h2')).toHaveText('Certifications')
  await expect(certifications.locator('.certification-press')).toHaveCount(1)
  await expect(certifications.locator('.language-console')).toHaveCount(0)
})

test('the closing review path bridges certifications and the footer', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const gaps = await page.evaluate(() => {
      const certifications = document.querySelector(
        '.qualifications--certifications',
      ).getBoundingClientRect()
      const review = document.querySelector('.review-path').getBoundingClientRect()
      const footer = document.querySelector('.site-footer').getBoundingClientRect()
      return {
        beforeReview: review.top - certifications.bottom,
        beforeFooter: footer.top - review.bottom,
      }
    })

    expect(gaps.beforeReview).toBeGreaterThanOrEqual(64)
    expect(gaps.beforeReview).toBeLessThanOrEqual(96)
    expect(Math.abs(gaps.beforeFooter)).toBeLessThanOrEqual(1)
  }
})

test('the language instrument stays compact on desktop and phone', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, maximumHeight: 96 },
    { width: 390, height: 844, maximumHeight: 160 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.locator('.language-switch button').nth(2).click()

    const height = await page.locator(
      '.qualifications--languages .qualifications__instrument',
    ).evaluate((instrument) => instrument.getBoundingClientRect().height)
    expect(height).toBeLessThanOrEqual(viewport.maximumHeight)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  }
})

test('language switch derives its columns from the language count', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const layout = await page.locator('.language-switch').evaluate((switcher) => {
    const source = switcher.querySelector('button')
    const extra = source.cloneNode(true)
    extra.classList.remove('language-switch__button--active')
    extra.setAttribute('aria-pressed', 'false')
    extra.querySelector('span').textContent = 'Français'
    switcher.append(extra)
    switcher.style.setProperty('--language-count', '4')

    const widths = [...switcher.querySelectorAll('button')].map(
      (button) => button.getBoundingClientRect().width,
    )
    return {
      columns: getComputedStyle(switcher).gridTemplateColumns.split(' ').length,
      count: Number(getComputedStyle(switcher).getPropertyValue('--language-count')),
      widthSpread: Math.max(...widths) - Math.min(...widths),
      overflow: switcher.scrollWidth - switcher.clientWidth,
    }
  })

  expect(layout).toEqual({ columns: 4, count: 4, widthSpread: 0, overflow: 0 })
})

test('feature layouts contain one additional plug-in record', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1000, height: 700 })
  await page.goto('/')
  expect(await page.locator('.discipline-band').evaluate((band) => {
    const list = band.querySelector('ol')
    const extra = list.lastElementChild.cloneNode(true)
    extra.querySelector('.discipline-band__abbr').textContent = 'IR'
    extra.querySelector('.discipline-band__name').textContent = 'Incident response'
    extra.querySelector('.discipline-band__detail').textContent = 'Triage · containment · recovery'
    list.append(extra)
    band.style.setProperty('--discipline-columns', String(Math.min(list.children.length, 4)))
    return {
      cellsContained: [...list.children].every((cell) => cell.scrollWidth <= cell.clientWidth),
      columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
      overflow: band.scrollWidth - band.clientWidth,
    }
  })).toEqual({ cellsContained: true, columns: profile.disciplines.length + 1, overflow: 0 })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.credential-card__records ol').evaluate((list) => {
    list.append(list.lastElementChild.cloneNode(true))
    list.style.setProperty('--profile-link-count', String(list.children.length))
  })
  await page.locator('.credential-card__turn').click()
  await expectDossierDrawer(page)
  expect(await page.locator('.credential-card__drawer').evaluate((drawer) => {
    const list = drawer.querySelector('ol')
    const count = list.children.length
    const rows = Math.ceil(count / 3)
    drawer.style.setProperty('--profile-link-count', String(count))
    drawer.style.setProperty('--profile-link-mobile-rows', String(rows))
    drawer.style.setProperty('--profile-drawer-mobile-height', `${rows * 4.75 + 0.5}rem`)
    drawer.closest('.scene').style.setProperty('--profile-drawer-mobile-space', `${rows * 4.75 + 2}rem`)
    const drawerBounds = drawer.getBoundingClientRect()
    return {
      columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
      contained: [...list.querySelectorAll('a')].every((link) => {
        const bounds = link.getBoundingClientRect()
        return bounds.left >= drawerBounds.left
          && bounds.right <= drawerBounds.right
          && bounds.top >= drawerBounds.top
          && bounds.bottom <= drawerBounds.bottom
      }),
      overflow: document.documentElement.scrollWidth - innerWidth,
      rows: getComputedStyle(list).gridTemplateRows.split(' ').length,
    }
  })).toEqual({ columns: 3, contained: true, overflow: 0, rows: 2 })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.credential-card__records ol').evaluate((list) => {
    list.append(list.lastElementChild.cloneNode(true))
  })
  await page.locator('.credential-card__turn').click()
  await expectDossierDrawer(page)
  expect(await page.locator('.credential-card__drawer').evaluate((drawer) => {
    const list = drawer.querySelector('ol')
    const count = list.children.length
    const columns = Math.ceil(count / 2)
    drawer.style.setProperty('--profile-link-count', String(count))
    drawer.style.setProperty('--profile-link-columns', String(columns))
    drawer.style.setProperty('--profile-link-rows', '2')
    drawer.style.setProperty('--profile-drawer-height', `${2 * 4.75 + 0.5}rem`)
    drawer.closest('.scene').style.setProperty('--profile-drawer-space', `${2 * 4.75 + 2.75}rem`)
    const drawerBounds = drawer.getBoundingClientRect()
    return {
      columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
      contained: [...list.querySelectorAll('a')].every((link) => {
        const bounds = link.getBoundingClientRect()
        return bounds.left >= drawerBounds.left
          && bounds.right <= drawerBounds.right
          && bounds.top >= drawerBounds.top
          && bounds.bottom <= drawerBounds.bottom
          && link.scrollWidth <= link.clientWidth
          && link.scrollHeight <= link.clientHeight
      }),
      rows: getComputedStyle(list).gridTemplateRows.split(' ').length,
    }
  })).toEqual({ columns: 3, contained: true, rows: 2 })

  await page.goto('/')
  await page.locator('.achievement-deck').scrollIntoViewIfNeeded()
  expect(await page.locator('.achievement-grid').evaluate((grid) => {
    grid.append(grid.querySelector('.achievement-card').cloneNode(true))
    grid.style.setProperty('--achievement-columns', String(grid.querySelectorAll('.achievement-card').length))
    const bounds = grid.getBoundingClientRect()
    const cards = [...grid.querySelectorAll('.achievement-card')]
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      contained: cards.every((card) => {
        const cardBounds = card.getBoundingClientRect()
        return cardBounds.left >= bounds.left
          && cardBounds.right <= bounds.right
          && card.scrollWidth <= card.clientWidth
      }),
      count: cards.length,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })).toEqual({ columns: achievementCount + 1, contained: true, count: achievementCount + 1, overflow: 0 })
})

test('large feature collections reflow or scroll without page overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.setViewportSize({ width: 1000, height: 700 })
  await page.goto('/')
  expect(await page.locator('.discipline-band').evaluate((band) => {
    const list = band.querySelector('ol')
    while (list.children.length < 8) list.append(list.lastElementChild.cloneNode(true))
    band.style.setProperty('--discipline-columns', '4')
    band.closest('.scene').style.setProperty('--discipline-rows', '2')
    const card = document.querySelector('.identity-card').getBoundingClientRect()
    const deck = document.querySelector('.achievement-deck').getBoundingClientRect()
    const quote = document.querySelector('.identity-card__statement').getBoundingClientRect()
    return {
      cardBeforeDeck: card.bottom <= deck.top,
      cellsFit: [...list.children].every((cell) => (
        cell.scrollWidth <= cell.clientWidth && cell.scrollHeight <= cell.clientHeight
      )),
      columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
      insideCard: band.getBoundingClientRect().bottom <= quote.top,
      overflow: document.documentElement.scrollWidth - innerWidth,
      rows: new Set([...list.children].map((cell) => Math.round(cell.getBoundingClientRect().top))).size,
    }
  })).toEqual({ cardBeforeDeck: true, cellsFit: true, columns: 4, insideCard: true, overflow: 0, rows: 2 })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.credential-card__records ol').evaluate((list) => {
    while (list.children.length < 8) list.append(list.lastElementChild.cloneNode(true))
  })
  await page.locator('.credential-card__turn').click()
  await expectDossierDrawer(page)
  expect(await page.locator('.credential-card__drawer').evaluate((drawer) => {
    const list = drawer.querySelector('ol')
    drawer.style.setProperty('--profile-link-count', '8')
    drawer.style.setProperty('--profile-link-columns', '4')
    drawer.style.setProperty('--profile-link-rows', '2')
    drawer.style.setProperty('--profile-link-mobile-rows', '3')
    drawer.style.height = `${3 * 4.75 + 0.5}rem`
    drawer.closest('.scene').style.setProperty('--profile-drawer-mobile-space', `${3 * 4.75 + 2}rem`)
    const bounds = drawer.getBoundingClientRect()
    const deck = document.querySelector('.achievement-deck').getBoundingClientRect()
    return {
      contained: [...list.querySelectorAll('a')].every((link) => {
        const linkBounds = link.getBoundingClientRect()
        return linkBounds.left >= bounds.left
          && linkBounds.right <= bounds.right
          && linkBounds.top >= bounds.top
          && linkBounds.bottom <= bounds.bottom
          && link.scrollWidth <= link.clientWidth
          && link.scrollHeight <= link.clientHeight
      }),
      drawerBeforeDeck: bounds.bottom <= deck.top,
      overflow: document.documentElement.scrollWidth - innerWidth,
      rows: getComputedStyle(list).gridTemplateRows.split(' ').length,
    }
  })).toEqual({ contained: true, drawerBeforeDeck: true, overflow: 0, rows: 3 })

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/')
  await page.locator('.credential-card__records ol').evaluate((list) => {
    while (list.children.length < 8) list.append(list.lastElementChild.cloneNode(true))
  })
  await page.locator('.credential-card__turn').click()
  await expectDossierDrawer(page)
  const drawer = page.locator('.credential-card__drawer')
  await drawer.evaluate((element) => {
    element.classList.add('credential-card__drawer--scrolling')
    element.style.setProperty('--profile-link-count', '8')
  })
  const lastLink = drawer.locator('a').last()
  await lastLink.focus()
  await expect(lastLink).toBeFocused()
  expect(await drawer.evaluate((element) => {
    const list = element.querySelector('ol')
    const drawerBounds = element.getBoundingClientRect()
    const focusedBounds = document.activeElement.getBoundingClientRect()
    return {
      focusedVisible: focusedBounds.left >= drawerBounds.left && focusedBounds.right <= drawerBounds.right,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      scrollable: list.scrollWidth > list.clientWidth,
    }
  })).toEqual({ focusedVisible: true, pageOverflow: 0, scrollable: true })

  await page.goto('/')
  const languageSwitch = page.locator('.language-switch')
  await languageSwitch.evaluate((switcher) => {
    while (switcher.querySelectorAll('button').length < 8) {
      const button = switcher.querySelector('button:last-of-type').cloneNode(true)
      button.querySelector('span').textContent = `Language ${switcher.querySelectorAll('button').length + 1}`
      switcher.append(button)
    }
    switcher.style.setProperty('--language-count', '8')
    switcher.classList.add('language-switch--scrolling')
  })
  const lastLanguage = languageSwitch.locator('button').last()
  await lastLanguage.focus()
  await expect(lastLanguage).toBeFocused()
  expect(await languageSwitch.evaluate((switcher) => {
    const bounds = switcher.getBoundingClientRect()
    const focusedBounds = document.activeElement.getBoundingClientRect()
    return {
      buttonsFit: [...switcher.querySelectorAll('button')].every((button) => (
        button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight
      )),
      focusedVisible: focusedBounds.left >= bounds.left && focusedBounds.right <= bounds.right,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
      scrollable: switcher.scrollWidth > switcher.clientWidth,
    }
  })).toEqual({ buttonsFit: true, focusedVisible: true, pageOverflow: 0, scrollable: true })

  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  const forcedColors = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(forcedColors.violations).toEqual([])

  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  expect(await page.evaluate(() => {
    const cloneTo = (selector, count) => {
      const container = document.querySelector(selector)
      while (container.children.length < count) container.append(container.lastElementChild.cloneNode(true))
      return container
    }
    const chapters = cloneTo('.experience__chapters', 12)
    const projects = document.querySelector('.album__field')
    while (projects.children.length < 12) {
      projects.append(projects.firstElementChild.cloneNode(true))
    }
    const achievements = cloneTo('.achievement-grid', 10)
    achievements.style.setProperty('--achievement-columns', '5')
    const certifications = cloneTo('.certification-press__seals', 8)
    const fits = (selector) => [...document.querySelectorAll(selector)].every((element) => (
      element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight
    ))
    return {
      achievements: {
        columns: getComputedStyle(achievements).gridTemplateColumns.split(' ').length,
        fit: fits('.achievement-card'),
        rows: new Set([...achievements.children].map((card) => Math.round(card.getBoundingClientRect().top))).size,
      },
      certifications: {
        fit: fits('.certification-seal'),
        scrollable: certifications.scrollHeight > certifications.clientHeight,
      },
      experience: {
        count: chapters.children.length,
        scrollable: chapters.closest('.experience__rail').scrollWidth > chapters.closest('.experience__rail').clientWidth,
      },
      overflow: document.documentElement.scrollWidth - innerWidth,
      projects: {
        count: projects.children.length,
        fit: fits('.stamp'),
        overflow: projects.scrollHeight - projects.clientHeight,
      },
    }
  })).toEqual({
    achievements: { columns: 5, fit: true, rows: 2 },
    certifications: { fit: true, scrollable: true },
    experience: { count: 12, scrollable: true },
    overflow: 0,
    projects: { count: 12, fit: true, overflow: 0 },
  })
})

test('languages morph between exact proficiency records without invented percentages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.qualifications--languages').scrollIntoViewIfNeeded()

  const choices = page.locator('.language-switch button')
  await expect(choices).toHaveCount(profile.languages.length)
  await expect(choices).toHaveText(profile.languages.map(({ native }) => native))

  // Selection and content change in the same render. Motion decorates the new
  // state; it never gates it behind transitionend, which hidden tabs can freeze.
  await choices.nth(2).evaluate((el) => el.click())
  await expect(choices.nth(2)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.language-stage__word')).toHaveText('日本語')
  await expect(page.locator('.language-stage__word')).toHaveAttribute('lang', 'ja')
  await expect(page.locator('.language-stage__level')).toHaveText('JLPT N4')
  await expect(page.locator('.language-stage a')).toHaveAttribute('href', /jlpt\.jp/)
  await expect(page.locator('.language-console')).not.toContainText('%')

  const delays = await page.locator('.language-stage__letter').evaluateAll((letters) =>
    letters.map((letter) => Number.parseFloat(getComputedStyle(letter).animationDelay)),
  )
  expect(delays).toEqual([...delays].sort((a, b) => a - b))
  expect(new Set(delays).size).toBe(delays.length)
})

test('certification seals expose exact statuses and only authoritative sources', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await page.locator('.qualifications--certifications').scrollIntoViewIfNeeded()

  const seals = page.locator('.certification-seal')
  await expect(seals).toHaveCount(profile.certifications.length)
  await expect(page.locator('.certification-focus dt').first()).toHaveText('Status')
  const expected = profile.certifications.map(({ name, status }) => [name, status])

  for (let index = 0; index < expected.length; index += 1) {
    await seals.nth(index).evaluate((el) => el.click())
    await expect(seals.nth(index)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.certification-focus h4')).toHaveText(expected[index][0])
    await expect(page.locator('.certification-focus dd').first()).toHaveText(expected[index][1])

    const hosts = await page.locator('.certification-focus a').evaluateAll((links) =>
      links.map((link) => new URL(link.href).hostname),
    )
    expect(hosts.every((host) =>
      ['www.isc2.org', 'learn.microsoft.com', 'pecb.com', 'www.iso.org'].includes(host),
    )).toBe(true)
  }

  // Issuer and standards pages support the claim; none is presented as a
  // personal verification URL that the repository does not have.
  await expect(page.locator('.certification-press')).not.toContainText('Verified')
})

test('selecting a certification never exposes transient scrollbars', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.qualifications--certifications').scrollIntoViewIfNeeded()

  const overflow = await page.locator('.certification-press__seals').evaluate(async (shelf) => {
    const samples = []
    const startedAt = performance.now()
    shelf.querySelector('.certification-seal:last-child').click()

    await new Promise((resolve) => {
      const sample = () => {
        samples.push({
          pageX: document.documentElement.scrollWidth - innerWidth,
          shelfX: shelf.scrollWidth - shelf.clientWidth,
          shelfY: shelf.scrollHeight - shelf.clientHeight,
        })
        if (performance.now() - startedAt < 850) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })

    return {
      pageX: Math.max(...samples.map(({ pageX }) => pageX)),
      shelfX: Math.max(...samples.map(({ shelfX }) => shelfX)),
      shelfY: Math.max(...samples.map(({ shelfY }) => shelfY)),
    }
  })

  expect(overflow).toEqual({ pageX: 0, shelfX: 0, shelfY: 0 })
})

test('a certification seal tilts, lifts, and traces the selected source', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.certification-press').scrollIntoViewIfNeeded()

  const seal = page.locator('.certification-seal').nth(1)
  const coin = seal.locator('.certification-seal__coin')
  const box = await seal.boundingBox()
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)

  await expect.poll(async () => coin.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).rotate.split(' ').at(-1)),
  )).toBeGreaterThan(3)
  await expect.poll(async () => coin.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).translate.split(' ')[2] ?? '0'),
  )).toBeGreaterThan(6)

  await seal.evaluate((el) => el.click())
  await expect(seal).toHaveAttribute('aria-pressed', 'true')
  expect(await coin.evaluate((el) => getComputedStyle(el, '::before').animationName)).toBe(
    'certification-trace',
  )
})

test('qualification motion has keyboard and reduced-motion equivalents', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.qualifications--languages').scrollIntoViewIfNeeded()

  const hindi = page.locator('.language-switch button').nth(1)
  await hindi.focus()
  await page.keyboard.press('Enter')
  await expect(hindi).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.language-stage__word')).toHaveText('हिन्दी')

  const seal = page.locator('.certification-seal').nth(2)
  await seal.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.certification-focus h4')).toHaveText('ISO/IEC 27001 Lead Auditor')

  const coin = seal.locator('.certification-seal__coin')
  const box = await seal.boundingBox()
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  const still = await coin.evaluate((el) => ({
    rotate: getComputedStyle(el).rotate,
    transition: getComputedStyle(el).transitionDuration,
    trace: getComputedStyle(el, '::before').animationName,
  }))
  expect(still.rotate).toBe('0 0 0 0deg')
  expect(still.transition).toBe('0s')
  expect(still.trace).toBe('none')
})

test('qualifications stay contained on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.qualifications--languages').scrollIntoViewIfNeeded()

  for (const button of await page.locator('.language-switch button').all()) {
    await button.evaluate((el) => el.click())
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  }
  for (const seal of await page.locator('.certification-seal').all()) {
    await seal.evaluate((el) => el.click())
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  }

  const geometry = await page.evaluate(() => ({
    overflows: [...document.querySelectorAll('.qualifications__instrument')].map(
      (instrument) => instrument.scrollWidth - instrument.clientWidth,
    ),
    seals: [...document.querySelectorAll('.certification-seal__coin')].map((el) => ({
      width: el.offsetWidth,
      height: el.offsetHeight,
    })),
  }))
  expect(geometry.overflows).toEqual([0, 0])
  expect(geometry.seals.every((seal) => Math.abs(seal.width - seal.height) < 0.1)).toBe(true)
  const widths = geometry.seals.map((seal) => seal.width)
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
})

test('the certification shelf grows without growing the instrument', async ({ page }) => {
  const addSyntheticSeals = () =>
    page.evaluate(() => {
      const shelf = document.querySelector('.certification-press__seals')
      const source = shelf.querySelector('.certification-seal')
      for (let index = shelf.children.length; index < 12; index += 1) {
        const seal = source.cloneNode(true)
        seal.classList.remove('certification-seal--active')
        seal.setAttribute('aria-label', `Synthetic certification ${index + 1}`)
        seal.setAttribute('aria-pressed', 'false')
        shelf.append(seal)
      }
    })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.qualifications--certifications').scrollIntoViewIfNeeded()
  await expect(page.locator('.qualifications__label', { hasText: 'Record' })).toContainText('/ 04')

  const current = await page.evaluate(() => {
    const instrument = document.querySelector(
      '.qualifications--certifications .qualifications__instrument',
    )
    const shelf = document.querySelector('.certification-press__seals')
    return {
      instrument: Math.round(instrument.getBoundingClientRect().height),
      shelfScrolls: shelf.scrollHeight > shelf.clientHeight + 1,
    }
  })
  expect(current).toEqual({ instrument: 384, shelfScrolls: false })

  await addSyntheticSeals()
  const desktop = await page.evaluate(() => {
    const instrument = document.querySelector(
      '.qualifications--certifications .qualifications__instrument',
    )
    const shelf = document.querySelector('.certification-press__seals')
    return {
      count: shelf.children.length,
      instrument: Math.round(instrument.getBoundingClientRect().height),
      shelfScrolls: shelf.scrollHeight > shelf.clientHeight + 1,
      sizes: [...new Set(
        [...shelf.querySelectorAll('.certification-seal__coin')].map(
          (seal) => `${seal.offsetWidth}x${seal.offsetHeight}`,
        ),
      )],
    }
  })
  expect(desktop).toEqual({ count: 12, instrument: 384, shelfScrolls: true, sizes: ['74x74'] })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('.qualifications--certifications').scrollIntoViewIfNeeded()
  await addSyntheticSeals()
  const mobile = await page.evaluate(() => {
    const shelf = document.querySelector('.certification-press__seals')
    return {
      count: shelf.children.length,
      horizontalScroll: shelf.scrollWidth > shelf.clientWidth + 1,
      rows: new Set([...shelf.children].map((seal) => seal.offsetTop)).size,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
  expect(mobile).toEqual({ count: 12, horizontalScroll: true, rows: 1, pageOverflow: 0 })
})

test('a card turns over to its evidence, by pointer and by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()

  const card = page.locator('.chapter').first()
  const front = card.locator('.chapter__face--front')
  const back = card.locator('.chapter__face--back')
  const opener = front.locator('.chapter__turn')

  // the evidence is genuinely on the other side, not merely stacked behind
  await expect(front).toHaveCSS('backface-visibility', 'hidden')
  await expect(back).toHaveCSS('backface-visibility', 'hidden')
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await expect(opener).toHaveAttribute('aria-controls', await back.getAttribute('id'))

  // inert rather than aria-hidden: the far side has to leave the tab order too
  const inertOf = async (side) => side.evaluate((el) => el.inert === true)
  expect(await inertOf(back)).toBe(true)
  expect(await inertOf(front)).toBe(false)

  await opener.evaluate((el) => el.click())
  await page.waitForTimeout(750)
  await expect(opener).toHaveAttribute('aria-expanded', 'true')
  expect(await inertOf(back)).toBe(false)
  expect(await inertOf(front)).toBe(true)
  await expect(back.locator('.chapter__outcome p')).not.toBeEmpty()

  // and back again from the keyboard, so the turn is not pointer-only
  const closer = back.locator('.chapter__turn')
  await closer.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(750)
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  expect(await inertOf(back)).toBe(true)

  // turning one card leaves the rest of the strip alone
  const others = await page
    .locator('.chapter:not(:first-child) .chapter__face--front')
    .evaluateAll((els) => els.map((el) => el.inert === true))
  expect(others.every((v) => v === false)).toBe(true)
})

test('the cluster lags a fast scroll and springs back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)

  // sampled inside the page: a round trip per frame would miss the response
  const lags = await page.evaluate(
    () =>
      new Promise((done) => {
        const section = document.querySelector('.experience')
        const out = []
        let n = 0
        const tick = () => {
          out.push(
            Number.parseFloat(getComputedStyle(section).getPropertyValue('--lag')) || 0,
          )
          if (n < 6) scrollBy(0, -55)
          if (++n < 40) requestAnimationFrame(tick)
          else done(out)
        }
        requestAnimationFrame(tick)
      }),
  )

  // It has to fall meaningfully behind, or there is no weight to feel. The
  // peak depends on how much scrolling lands per frame, so it moves with the
  // machine: 14.8 on a loaded CI runner against 16 or so locally. The bar sits
  // below both, since either is plainly visible and neither is a regression.
  expect(Math.max(...lags.map(Math.abs))).toBeGreaterThan(12)
  // and it is a spring, not an ease: it passes through rest and comes back
  expect(lags.some((v) => v > 1) && lags.some((v) => v < -1)).toBe(true)
  // and it must actually come to rest, not hum forever
  expect(Math.abs(lags.at(-1))).toBeLessThan(2)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  const quiet = await page.evaluate(
    () =>
      new Promise((done) => {
        const section = document.querySelector('.experience')
        const out = []
        let n = 0
        const tick = () => {
          out.push(
            Number.parseFloat(getComputedStyle(section).getPropertyValue('--lag')) || 0,
          )
          if (n < 6) scrollBy(0, -55)
          if (++n < 20) requestAnimationFrame(tick)
          else done(out)
        }
        requestAnimationFrame(tick)
      }),
  )
  expect(Math.max(...quiet.map(Math.abs))).toBe(0)
})

test('the rail reads wheel deltas in lines as well as pixels', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  // Firefox reports wheel deltas in lines, so one notch arrives as about 3
  // rather than about 100. Treated as pixels it is a 30x weaker shove and the
  // rail is effectively immovable there, which no Chrome test would ever catch.
  const travel = (deltaY, deltaMode) =>
    page.evaluate(
      ([dy, dm]) =>
        new Promise((done) => {
          const rail = document.querySelector('.experience__rail')
          rail.scrollLeft = 0
          let n = 0
          const tick = () => {
            if (n === 2) {
              rail.dispatchEvent(
                new WheelEvent('wheel', {
                  deltaY: dy,
                  deltaMode: dm,
                  shiftKey: true,
                  bubbles: true,
                  cancelable: true,
                }),
              )
            }
            if (++n < 120) requestAnimationFrame(tick)
            else done(rail.scrollLeft)
          }
          requestAnimationFrame(tick)
        }),
      [deltaY, deltaMode],
    )

  const pixels = await travel(100, 0)
  const lines = await travel(3, 1)

  expect(pixels).toBeGreaterThan(140)
  // the same physical gesture has to move the rail a comparable distance
  expect(lines / pixels).toBeGreaterThan(0.5)
  expect(lines / pixels).toBeLessThan(2)
})

test('the page carries the wheel instead of jumping a notch at a time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(300)

  const run = await page.evaluate(
    () =>
      new Promise((done) => {
        scrollTo(0, 300)
        const ys = []
        let n = 0
        const tick = () => {
          ys.push(scrollY)
          if (n === 2) {
            dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
          }
          if (++n < 110) requestAnimationFrame(tick)
          else done(ys)
        }
        requestAnimationFrame(tick)
      }),
  )

  const steps = run.slice(1).map((v, i) => Math.abs(v - run[i])).filter((v) => v > 0)
  expect(run.at(-1) - run[0]).toBeGreaterThan(60)
  // a native wheel notch lands the whole 100px in one frame, which is what made
  // everything keyed to scrolling jump. Spread over frames, no step is large.
  expect(Math.max(...steps)).toBeLessThan(40)
  expect(steps.length).toBeGreaterThan(8)
})

test('smooth page scroll never takes over anything but the wheel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')

  // programmatic scrolling, anchors, find-in-page and scroll restoration all
  // depend on these staying exactly as the browser defines them
  const behaviour = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollBehavior,
  )
  expect(behaviour).toBe('auto')
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(100)
  await page.evaluate(() => scrollBy(0, 400))
  expect(await page.evaluate(() => scrollY)).toBe(400)

  // and reduced motion gets the browser's own scrolling back
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForTimeout(200)
  const still = await page.evaluate(
    () =>
      new Promise((done) => {
        scrollTo(0, 300)
        const start = scrollY
        dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
        let n = 0
        const tick = () => {
          if (++n < 30) requestAnimationFrame(tick)
          else done(scrollY - start)
        }
        requestAnimationFrame(tick)
      }),
  )
  // a synthetic event does no native scrolling, so nothing of ours may move it
  expect(still).toBe(0)
})

test('the rail never holds the page hostage', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.evaluate(() => {
    const section = document.querySelector('.experience')
    scrollTo(0, scrollY + section.getBoundingClientRect().top - 700)
  })
  await page.waitForTimeout(400)

  const rail = page.locator('.experience__rail')
  const box = await rail.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  const before = await page.evaluate(() => scrollY)
  // a continuous run of notches, as a reader moving down the page produces.
  // The page is travelling throughout, so the rail must let every one past.
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, 100)
    await page.waitForTimeout(45)
  }
  await page.waitForTimeout(700)

  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 200)
  expect(await rail.evaluate((el) => el.scrollLeft)).toBe(0)
})

test('a wheel over the rail moves it once the page has come to rest', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  // long enough for any page momentum to be spent: this is the whole signal
  await page.waitForTimeout(1400)

  const rail = page.locator('.experience__rail')
  const box = await rail.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  const before = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, 100)
  await page.waitForTimeout(900)

  expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(140)
  expect(await page.evaluate(() => scrollY)).toBe(before)
})

test('the rail carries momentum when moved sideways on purpose', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const rail = page.locator('.experience__rail')
  await rail.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const early = await rail.evaluate((el) => new Promise((resolve) => {
    el.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 100, shiftKey: true, bubbles: true, cancelable: true }),
    )
    requestAnimationFrame(() => resolve(el.scrollLeft))
  }))
  const requiredCarry = Math.max(140, early / 0.3)
  await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(requiredCarry)
  const settled = await rail.evaluate((el) => el.scrollLeft)

  expect(early).toBeGreaterThan(0)
  expect(settled).toBeGreaterThan(early)
  // heavy: only a small share of the journey happens in the first moments
  expect(early / settled).toBeLessThan(0.3)
})

test('the rail can be moved by its own controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()

  const rail = page.locator('.experience__rail')
  const back = page.getByRole('button', { name: 'More recent roles' })
  const on = page.getByRole('button', { name: 'Earlier roles' })

  // at the start there is nowhere back to go
  await expect(back).toBeDisabled()
  await expect(on).toBeEnabled()

  await on.click()
  await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  await expect(back).toBeEnabled()

  await rail.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
  await expect(on).toBeDisabled()
})

test('the rail is a named, focusable scroll region', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const rail = page.locator('.experience__rail')
  await expect(rail).toHaveAttribute('aria-label', /work history/i)
  expect(await rail.evaluate((el) => el.tabIndex)).toBe(0)

  // it is a scrollable strip, not a carousel: no slide semantics to mislead
  await expect(page.locator('[aria-roledescription]')).toHaveCount(0)
  expect(await rail.evaluate((el) => getComputedStyle(el).scrollSnapType)).toBe('none')
})

test('the rail can be dragged, and a release keeps carrying', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  const rail = page.locator('.experience__rail')
  const box = await rail.boundingBox()
  const position = { x: box.width - 140, y: box.height / 2 }
  await rail.hover({ position })
  const stableBox = await rail.boundingBox()
  const y = stableBox.y + position.y
  let x = stableBox.x + position.x

  await page.mouse.down()
  // moves a frame apart, as a hand produces them. Sent all at once the browser
  // never sees the drag end, which hides the snap conflict this guards.
  for (let i = 0; i < 7; i += 1) {
    x -= 90
    await page.mouse.move(x, y)
    await page.waitForTimeout(16)
  }
  const dragged = await rail.evaluate((el) => el.scrollLeft)
  await page.mouse.up()
  await page.waitForTimeout(1400)
  const settled = await rail.evaluate((el) => el.scrollLeft)

  // the drag has to survive: snap re-engaging between moves used to pull the
  // rail back to the start after every one, leaving it exactly where it began
  expect(dragged).toBeGreaterThan(300)
  // and letting go while moving carries it further
  expect(settled).toBeGreaterThan(dragged + 60)
})

test('sticky note flips on click and returns on the second', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const note = page.locator('.sticky-note')
  await note.scrollIntoViewIfNeeded()

  const front = note.locator('.sticky-note__face--front')
  const back = note.locator('.sticky-note__face--back')
  await expect(front).toContainText('Energetic')
  // the back exists in the DOM either way, so state is read from aria, not text
  await expect(back).toHaveAttribute('aria-hidden', 'true')
  await expect(front).toHaveAttribute('aria-pressed', 'false')

  await front.click()
  await expect(note).toHaveClass(/sticky-note--flipped/)
  await expect(front).toHaveAttribute('aria-hidden', 'true')
  await expect(front).toHaveAttribute('inert', '')
  await expect(back).toHaveAttribute('aria-hidden', 'false')
  await expect(back).not.toHaveAttribute('inert', '')
  await expect(back).toContainText('Could not have done it without both of you')
  expect(await note.ariaSnapshot()).toBe('- button "Could not have done it without both of you"')

  await note.locator('.sticky-note__reply').click()
  await expect(note).not.toHaveClass(/sticky-note--flipped/)
  await expect(front).toHaveAttribute('aria-hidden', 'false')
  await expect(front).not.toHaveAttribute('inert', '')
  await expect(back).toHaveAttribute('aria-hidden', 'true')
  await expect(back).toHaveAttribute('inert', '')
  expect(await note.ariaSnapshot()).toBe(
    '- button "You are the most Energetic Person here and your Enthusiasm Makes the whole place feels lighter. +1"',
  )
})

test('sticky note flips from the keyboard and keeps focus reachable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const note = page.locator('.sticky-note')
  await note.scrollIntoViewIfNeeded()

  // only the face that is showing may be reachable by Tab
  await note.locator('.sticky-note__face--front').focus()
  await page.keyboard.press('Enter')
  await expect(note).toHaveClass(/sticky-note--flipped/)
  await expect(note.locator('.sticky-note__reply')).toBeFocused()
  expect(await note.locator('.sticky-note__face--front').getAttribute('tabindex')).toBe('-1')
  expect(await note.locator('.sticky-note__reply').getAttribute('tabindex')).toBe('0')

  await page.keyboard.press('Enter')
  await expect(note).not.toHaveClass(/sticky-note--flipped/)
  await expect(note.locator('.sticky-note__face--front')).toBeFocused()
})

test('sticky note drags only when grabbed, and dragging never flips it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const rail = page.locator('.experience__rail')
  await rail.scrollIntoViewIfNeeded()
  // the note sits under the portrait at the head of the rail now
  await rail.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))

  const note = page.locator('.sticky-note')
  const start = await note.boundingBox()

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 - 140, start.y + start.height / 2 + 60, { steps: 12 })
  await page.mouse.up()

  const moved = await note.boundingBox()
  expect(Math.round(start.x - moved.x)).toBeGreaterThan(100)
  expect(Math.round(moved.y - start.y)).toBeGreaterThan(40)
  // a drag is not a click: the note must not have turned over
  await expect(note).not.toHaveClass(/sticky-note--flipped/)
})

test('achievement cards present every verified outcome', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const deck = page.getByRole('region', { name: 'Selected outcomes' })
  const cards = deck.locator('.achievement-card')
  await expect(cards).toHaveCount(achievementCount)
  await expect(deck).toHaveCSS('background-image', 'none')
  await expect(deck).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(deck).toHaveCSS('border-top-width', '0px')
  await expect(deck.locator('h3')).toHaveText(profile.achievements.map(({ title }) => title))
  await expect(deck.locator('.achievement-card__copy > b')).toHaveText(profile.achievements.map(({ metric }) => metric))
  await expect(deck.locator('.achievement-card__topline > span')).toHaveCount(0)
  await expect(deck.locator('.achievement-card__topline > strong')).toHaveText(profile.achievements.map(({ glyph }) => glyph))
  await expect(deck.getByRole('tab')).toHaveCount(0)
  await deck.scrollIntoViewIfNeeded()
  const stage = deck.locator('.achievement-stage')
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  await expect(stage.locator('.achievement-stage__canvas')).toHaveAttribute('data-render-state', 'ready')
  await expect(deck.locator('.achievement-card__visual .achievement-art')).toHaveCount(staticAchievementCount)

  const presentation = await cards.evaluateAll((elements) => ({
    canvasZ: Number(getComputedStyle(elements[0].parentElement.querySelector('canvas')).zIndex),
    cardZ: Number(getComputedStyle(elements[0]).zIndex),
    cards: elements.map((card) => ({
      boxShadow: getComputedStyle(card).boxShadow,
      borderRadius: getComputedStyle(card).borderRadius,
      copyHeight: card.querySelector('.achievement-card__copy').getBoundingClientRect().height,
      transform: getComputedStyle(card).transform,
    })),
    columns: getComputedStyle(elements[0].parentElement).gridTemplateColumns.split(' ').length,
  }))
  expect(presentation.columns).toBe(Math.min(achievementCount, 5))
  expect(presentation.canvasZ).toBeGreaterThan(presentation.cardZ)
  expect(presentation.cards.every(({ boxShadow }) => boxShadow !== 'none')).toBe(true)
  expect(presentation.cards.every(({ borderRadius }) => borderRadius !== '0px')).toBe(true)
  expect(presentation.cards.every(({ copyHeight }) => Math.abs(copyHeight - presentation.cards[0].copyHeight) < 0.5)).toBe(true)
  expect(presentation.cards.every(({ transform }) => transform === 'none')).toBe(true)
})

test('achievement window encloses the gallery and settles after one filigree pass', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const window = page.locator('.achievement-window')
  await window.scrollIntoViewIfNeeded()
  await expect(window).toHaveClass(/achievement-window--active/)
  await expect(window).toHaveClass(/achievement-window--ambient/)
  await page.waitForTimeout(1_900)

  const presentation = await window.evaluate((element) => {
    const filigree = element.querySelector('.achievement-filigree')
    const frame = element.querySelector('.achievement-window__frame')
    const grid = element.querySelector('.achievement-grid')
    const leaf = element.querySelector('.achievement-filigree__leaves path')
    const stem = element.querySelector('.achievement-filigree__path--stem')
    const stitch = element.querySelector('.achievement-filigree__stitch')
    const vineGrowth = element.querySelector('.achievement-vines__growth--crown')
    const vineLeaf = element.querySelector('.achievement-vines__leaf')
    const vinePulse = element.querySelector('.achievement-vines__branch--crown > g:nth-of-type(3) .achievement-vines__leaf-face')
    const vines = element.querySelector('.achievement-vines')
    const vineStem = element.querySelector('.achievement-vines__stem')
    const vineSway = element.querySelector('.achievement-vines__leaf-sway')
    const bounds = (target) => {
      const rect = target.getBoundingClientRect()
      return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top }
    }
    const animation = (target, pseudo) => {
      const style = getComputedStyle(target, pseudo)
      return { iterations: style.animationIterationCount, name: style.animationName }
    }

    return {
      filigree: bounds(filigree),
      filigreeOpacity: getComputedStyle(filigree).opacity,
      frame: bounds(frame),
      frameOpacity: getComputedStyle(frame).opacity,
      grid: bounds(grid),
      leafTransform: getComputedStyle(leaf).transform,
      overflow: getComputedStyle(element).overflow,
      rail: animation(frame, '::before'),
      running: document.getAnimations().filter(({ animationName, playState }) => (
        animationName?.startsWith('achievement-window-') && playState === 'running'
      )).length,
      side: animation(element, '::before'),
      stem: {
        ...animation(stem),
        dashoffset: getComputedStyle(stem).strokeDashoffset,
        timing: getComputedStyle(stem).animationTimingFunction,
      },
      stitch: {
        ...animation(stitch),
        offsetDistance: getComputedStyle(stitch).offsetDistance,
        opacity: getComputedStyle(stitch).opacity,
      },
      vineGrowthPosition: getComputedStyle(vineGrowth).backgroundPosition,
      vineLeafOpacity: getComputedStyle(vineLeaf).opacity,
      vineLeafTransform: getComputedStyle(vineLeaf).transform,
      vinePulseState: getComputedStyle(vinePulse).animationPlayState,
      vinesOpacity: getComputedStyle(vines).opacity,
      vineStem: {
        ...animation(vineStem),
        dashoffset: getComputedStyle(vineStem).strokeDashoffset,
        timing: getComputedStyle(vineStem).animationTimingFunction,
      },
      vineSwayState: getComputedStyle(vineSway).animationPlayState,
    }
  })

  expect(presentation.frame.left).toBeLessThan(presentation.grid.left)
  expect(presentation.frame.top).toBeLessThan(presentation.grid.top)
  expect(presentation.frame.right).toBeGreaterThan(presentation.grid.right)
  expect(presentation.frame.bottom).toBeGreaterThan(presentation.grid.bottom)
  expect(presentation.filigree).toEqual(presentation.frame)
  expect(presentation.filigreeOpacity).toBe('1')
  expect(presentation.frameOpacity).toBe('1')
  expect(presentation.leafTransform).toBe('matrix(1, 0, 0, 1, 0, 0)')
  expect(presentation.overflow).toBe('visible')
  expect(presentation.rail).toEqual({ iterations: '1', name: 'achievement-window-rails' })
  expect(presentation.side).toEqual({ iterations: '1', name: 'achievement-window-sides' })
  expect(presentation.stem).toEqual({
    dashoffset: '0px',
    iterations: '1',
    name: 'achievement-filigree-grow',
    timing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  })
  expect(presentation.stitch).toEqual({
    iterations: '1',
    name: 'achievement-filigree-stitch',
    offsetDistance: '100%',
    opacity: '0',
  })
  expect(presentation.vineGrowthPosition).toBe('100% 0px')
  expect(presentation.vineLeafOpacity).toBe('1')
  expect(presentation.vineLeafTransform).toBe('matrix(1, 0, 0, 1, 0, 0)')
  expect(presentation.vinePulseState).toBe('running')
  expect(presentation.vinesOpacity).toBe('1')
  expect(presentation.vineStem).toEqual({
    dashoffset: '0px',
    iterations: '1',
    name: 'achievement-vine-grow',
    timing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  })
  expect(presentation.vineSwayState).toBe('running')
  expect(presentation.running).toBe(0)
})

test('living border growth advances continuously without geometry jitter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')

  const window = page.locator('.achievement-window')
  await window.scrollIntoViewIfNeeded()
  await expect(window).toHaveClass(/achievement-window--active/)

  const presentation = await window.evaluate((element) => {
    const sample = (selector, animationName, intervals) => {
      const target = element.querySelector(selector)
      const animation = target.getAnimations().find((candidate) => candidate.animationName === animationName)
      const timing = animation.effect.getComputedTiming()
      const values = []
      const geometry = []

      animation.pause()
      for (let index = 0; index <= intervals; index += 1) {
        animation.currentTime = timing.delay + timing.duration * index / intervals
        const bounds = target.getBoundingClientRect()
        values.push(Number.parseFloat(getComputedStyle(target).strokeDashoffset))
        geometry.push([bounds.x, bounds.y, bounds.width, bounds.height].join(':'))
      }

      return {
        geometryStates: new Set(geometry).size,
        timing: getComputedStyle(target).animationTimingFunction,
        uniqueValues: new Set(values).size,
      }
    }

    const sampleTransform = (selector, animationName, intervals) => {
      const target = element.querySelector(selector)
      const animation = target.getAnimations().find((candidate) => candidate.animationName === animationName)
      const timing = animation.effect.getComputedTiming()
      const values = []

      animation.pause()
      for (let index = 0; index <= intervals; index += 1) {
        animation.currentTime = timing.delay + timing.duration * index / intervals
        values.push(getComputedStyle(target).transform)
      }

      return {
        timing: getComputedStyle(target).animationTimingFunction,
        uniqueValues: new Set(values).size,
      }
    }

    return {
      filigree: sample('.achievement-filigree__path--stem', 'achievement-filigree-grow', 24),
      filigreeLeaf: sampleTransform('.achievement-filigree__leaves path', 'achievement-filigree-leaf', 16),
      vine: sample('.achievement-vines__stem', 'achievement-vine-grow', 30),
      vineLeaf: sampleTransform('.achievement-vines__leaf', 'achievement-vine-unfurl', 16),
    }
  })

  expect(presentation.filigree.timing).toBe('cubic-bezier(0.22, 1, 0.36, 1)')
  expect(presentation.filigree.uniqueValues).toBeGreaterThan(19)
  expect(presentation.filigree.geometryStates).toBe(1)
  expect(presentation.filigreeLeaf.timing).toBe('cubic-bezier(0.22, 1, 0.36, 1)')
  expect(presentation.filigreeLeaf.uniqueValues).toBeGreaterThan(12)
  expect(presentation.vine.timing).toBe('cubic-bezier(0.22, 1, 0.36, 1)')
  expect(presentation.vine.uniqueValues).toBeGreaterThan(23)
  expect(presentation.vine.geometryStates).toBe(1)
  expect(presentation.vineLeaf.timing).toBe('cubic-bezier(0.22, 1, 0.36, 1)')
  expect(presentation.vineLeaf.uniqueValues).toBeGreaterThan(12)
})

test('achievement 3D payload waits until the deck enters the viewport', async ({ page }) => {
  const requested = []
  page.on('request', (request) => {
    if (profile.achievements.some(({ instrument }) => instrument?.src && request.url().endsWith(instrument.src))) {
      requested.push(request.url())
    }
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(300)

  expect(requested).toEqual([])
  expect(await page.evaluate(() => scrollY)).toBe(0)

  const deck = page.locator('.achievement-deck')
  await expect(deck.locator('.achievement-stage')).toHaveCount(1)
  await expect(deck.locator('.achievement-card')).toHaveCount(achievementCount)
  await expect(deck.locator('.achievement-stage__canvas')).toHaveAttribute('data-render-state', 'standby')
  await deck.scrollIntoViewIfNeeded()
  await expect(deck.locator('.achievement-stage [data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  expect(requested).toHaveLength(instrumentedAchievementCount)
})

test('reload settles the living border before initializing 3D instruments', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const window = page.locator('.achievement-window')
  await window.scrollIntoViewIfNeeded()
  await expect(window.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(window).toHaveClass(/achievement-window--active/)

  const entryAnimations = await window.evaluate((element) => {
    const animations = element.getAnimations({ subtree: true }).filter((animation) => (
      Number.isFinite(animation.effect.getComputedTiming().endTime)
    ))
    animations.forEach((animation) => animation.pause())
    return {
      maximumEffectiveEnd: Math.max(...animations.map((animation) => (
        animation.effect.getComputedTiming().endTime / animation.playbackRate
      ))),
      names: [...new Set(animations.map(({ animationName }) => animationName))],
      playbackRates: [...new Set(animations.map(({ playbackRate }) => playbackRate))],
    }
  })

  expect(entryAnimations.names).toContain('achievement-filigree-leaf')
  expect(entryAnimations.names).toContain('achievement-vine-unfurl')
  expect(entryAnimations.playbackRates).toEqual([2.4])
  expect(entryAnimations.maximumEffectiveEnd).toBeLessThanOrEqual(775)
  const stage = window.locator('.achievement-stage')
  await expect(stage).toHaveCount(1)
  await expect(stage.locator('.achievement-card')).toHaveCount(achievementCount)
  await expect(stage.locator('canvas')).toHaveAttribute('data-render-state', 'standby')
  await page.waitForTimeout(100)
  await expect(stage).toHaveCount(1)
  await expect(stage.locator('.achievement-card')).toHaveCount(achievementCount)

  await window.evaluate((element) => {
    const stage = element.querySelector('.achievement-stage')
    const state = {
      heights: [],
      minimumCards: stage.querySelectorAll('.achievement-card').length,
      removedCards: 0,
    }
    window.__achievementReloadContinuity = state
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node.matches?.('.achievement-card') || node.querySelector?.('.achievement-card')) {
            state.removedCards += 1
          }
        }
      }
    })
    observer.observe(stage, { childList: true, subtree: true })
    const sample = () => {
      state.minimumCards = Math.min(
        state.minimumCards,
        stage.querySelectorAll('.achievement-card').length,
      )
      state.heights.push(stage.getBoundingClientRect().height)
      if (stage.querySelector('canvas').dataset.renderState === 'ready') {
        observer.disconnect()
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })

  await window.evaluate((element) => {
    element.getAnimations({ subtree: true })
      .filter((animation) => Number.isFinite(animation.effect.getComputedTiming().endTime))
      .forEach((animation) => animation.finish())
  })
  await expect(window.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  expect(await page.evaluate(() => {
    const state = window.__achievementReloadContinuity
    return {
      heightRange: Math.max(...state.heights) - Math.min(...state.heights),
      minimumCards: state.minimumCards,
      removedCards: state.removedCards,
    }
  })).toEqual({ heightRange: 0, minimumCards: achievementCount, removedCards: 0 })
})

test('living border pauses ambient motion outside the achievement window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const window = page.locator('.achievement-window')
  await window.scrollIntoViewIfNeeded()
  await expect(window).toHaveClass(/achievement-window--ambient/)
  expect(await window.evaluate((element) => ({
    pulse: getComputedStyle(element.querySelector('.achievement-vines__branch--crown > g:nth-of-type(3) .achievement-vines__leaf-face')).animationPlayState,
    sway: getComputedStyle(element.querySelector('.achievement-vines__leaf-sway')).animationPlayState,
  }))).toEqual({ pulse: 'running', sway: 'running' })

  await page.evaluate(() => scrollTo(0, 0))
  await expect(window).not.toHaveClass(/achievement-window--ambient/)
  expect(await window.evaluate((element) => ({
    pulse: getComputedStyle(element.querySelector('.achievement-vines__branch--crown > g:nth-of-type(3) .achievement-vines__leaf-face')).animationPlayState,
    sway: getComputedStyle(element.querySelector('.achievement-vines__leaf-sway')).animationPlayState,
  }))).toEqual({ pulse: 'paused', sway: 'paused' })
})

test('achievement instruments render every nonblank model in one canvas', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const stage = await revealAchievementStage(page)
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  await expect(stage.locator('canvas')).toHaveAttribute('data-render-state', 'ready')
  await page.waitForTimeout(300)

  const opaquePixels = await stage.evaluate((root) => {
    const canvas = root.querySelector('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const rootBounds = root.getBoundingClientRect()
    const scaleX = canvas.width / rootBounds.width
    const scaleY = canvas.height / rootBounds.height

    return [...root.querySelectorAll('[data-model-state="ready"]')].map((slot) => {
      const slotBounds = slot.getBoundingClientRect()
      const left = Math.max(0, Math.floor((slotBounds.left - rootBounds.left) * scaleX))
      const bottom = Math.max(0, Math.floor((rootBounds.bottom - slotBounds.bottom) * scaleY))
      const width = Math.min(canvas.width - left, Math.ceil(slotBounds.width * scaleX))
      const height = Math.min(canvas.height - bottom, Math.ceil(slotBounds.height * scaleY))
      const pixels = new Uint8Array(width * height * 4)
      context.readPixels(left, bottom, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels)
      let count = 0
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) count += 1
      }
      return count
    })
  })

  expect(opaquePixels).toHaveLength(instrumentedAchievementCount)
  expect(opaquePixels.every((count) => count > 100)).toBe(true)
  expect(pageErrors).toEqual([])
})

test('achievement instruments keep a static reduced-motion render', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const stage = await revealAchievementStage(page)
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  const canvas = stage.locator('canvas')
  await page.waitForTimeout(300)
  const before = Number(await canvas.getAttribute('data-render-count'))
  await page.waitForTimeout(250)
  const after = Number(await canvas.getAttribute('data-render-count'))
  expect(before).toBeGreaterThan(0)
  expect(after).toBe(before)
})

test('reduced data skips the 3D payload and keeps the artwork', async ({ page }) => {
  const requested = []
  page.on('request', (request) => {
    if (/three\.module-.*\.js$|models\/tarot|\.glb$|\.mp4$/.test(request.url())) requested.push(request.url())
  })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  await expect(page.locator('.scene__landscape')).toBeVisible()
  const hero = page.locator('.tarot-hanging--hero')
  await expect(hero).toHaveAttribute('data-render-state', 'fallback')
  await expect(hero.locator('[data-model-state="fallback"]')).toHaveCount(1)
  await expect(hero.locator('canvas')).toHaveAttribute('data-render-state', 'fallback')
  const deck = page.locator('.achievement-deck')
  await deck.scrollIntoViewIfNeeded()
  await expect(deck.locator('.achievement-card')).toHaveCount(achievementCount)
  await expect(deck.locator('.achievement-card__visual .achievement-art')).toHaveCount(achievementCount)
  for (const stage of [page.locator('.tarot-hanging--sun'), page.locator('.tarot-hanging--moon')]) {
    await stage.scrollIntoViewIfNeeded()
    await expect(stage).toHaveAttribute('data-render-state', 'fallback')
    await expect(stage.locator('[data-model-state="fallback"]')).toHaveCount(1)
    await expect(stage.locator('canvas')).toHaveAttribute('data-render-state', 'fallback')
  }
  await page.waitForTimeout(1_500)
  await expect(deck.locator('.achievement-stage')).toHaveCount(1)
  await expect(deck.locator('.achievement-stage__canvas')).toHaveAttribute('data-render-state', 'standby')
  expect(requested).toEqual([])
})

test('achievement instruments remain still while idle', async ({ page }) => {
  await page.goto('/')

  const stage = await revealAchievementStage(page)
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  const canvas = stage.locator('canvas')
  await expect.poll(async () => {
    const first = Number(await canvas.getAttribute('data-render-count'))
    await page.waitForTimeout(200)
    return first > 0 && first === Number(await canvas.getAttribute('data-render-count'))
  }, { timeout: 10_000 }).toBe(true)
  const before = Number(await canvas.getAttribute('data-render-count'))
  await page.waitForTimeout(400)
  const after = Number(await canvas.getAttribute('data-render-count'))
  expect(before).toBeGreaterThan(0)
  expect(after).toBe(before)
})

test('failed instrument loads preserve the artwork fallback', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(/(industrial_microscope|retro_multimeter|vintage_spacecraft_instrument|signal_flashlight)\/[^/]+\.glb$/, (route) => route.abort('failed'))
  await page.goto('/')

  const stage = await revealAchievementStage(page)
  await expect(stage.locator('[data-model-state="failed"]')).toHaveCount(achievementCount)
  await expect(stage.locator('canvas')).toHaveAttribute('data-render-state', 'failed')
  await expect(stage.locator('.achievement-art')).toHaveCount(achievementCount)
  expect(await stage.locator('.achievement-art').evaluateAll((elements) => (
    elements.every((element) => Number(getComputedStyle(element).opacity) > 0)
  ))).toBe(true)
  expect(pageErrors).toEqual([])
})

test('instrument slot mismatches fail safely without removing achievement cards', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')

  const deck = page.locator('.achievement-deck')
  await deck.locator('[data-instrument-index]').last().evaluate((slot) => slot.remove())
  await deck.scrollIntoViewIfNeeded()

  await expect(deck.locator('.achievement-stage__canvas')).toHaveAttribute('data-render-state', 'failed')
  await expect(deck.locator('.achievement-card')).toHaveCount(achievementCount)
  await expect(deck.locator('.achievement-art')).toHaveCount(achievementCount - 1)
  expect(pageErrors).toEqual([])
})

test('achievement instruments react across every full card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const stage = await revealAchievementStage(page)
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  const canvas = stage.locator('canvas')
  await page.waitForTimeout(600)
  for (const card of await stage.locator('.achievement-card').all()) {
    const before = Number(await canvas.getAttribute('data-render-count'))
    const bounds = await card.boundingBox()
    await page.mouse.move(bounds.x + bounds.width * 0.78, bounds.y + bounds.height * 0.86)
    await expect.poll(async () => Number(await canvas.getAttribute('data-render-count'))).toBeGreaterThan(before)
    await page.waitForTimeout(280)
  }
})

test('achievement shell synchronizes foil light and grows vines on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const stage = await revealAchievementStage(page)
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  const cards = stage.locator('.achievement-card')
  await expect(cards.locator('.achievement-card__effects')).toHaveCount(achievementCount)
  const card = cards.first()
  await expect(card.locator(':scope > .achievement-card__vines')).toHaveCount(1)
  await expect(card.locator(':scope > .achievement-card__vines > .achievement-card__vine')).toHaveCount(2)
  await expect(card.locator('.achievement-card__effects .achievement-card__vine')).toHaveCount(0)
  const before = await card.boundingBox()
  const target = { x: before.x + before.width * 0.78, y: before.y + before.height * 0.28 }
  await page.mouse.move(target.x, target.y)

  await expect.poll(async () => card.evaluate((element) => Number(
    getComputedStyle(element.querySelector('.achievement-card__foil')).opacity,
  ))).toBeGreaterThan(0.7)
  await expect.poll(async () => card.evaluate((element) => Number(
    getComputedStyle(element.querySelector('.achievement-card__vine')).opacity,
  ))).toBeGreaterThan(0.9)
  await expect.poll(async () => card.evaluate((element) => (
    getComputedStyle(element.querySelector('.achievement-card__vine-stem')).strokeDashoffset
  ))).toBe('0px')
  await expect.poll(async () => card.evaluate((element) => (
    getComputedStyle(element.querySelector('.achievement-card__vine-leaves path')).transform
  ))).toBe('matrix(1, 0, 0, 1, 0, 0)')

  const active = await card.evaluate((element) => ({
    glare: getComputedStyle(element.querySelector('.achievement-card__foil'), '::after').animationName,
    copyZ: Number(getComputedStyle(element.querySelector('.achievement-card__copy')).zIndex),
    overlayZ: Number(getComputedStyle(element.querySelector('.achievement-card__vines')).zIndex),
    pointerEvents: getComputedStyle(element.querySelector('.achievement-card__vines')).pointerEvents,
    toplineZ: Number(getComputedStyle(element.querySelector('.achievement-card__topline')).zIndex),
    x: Number.parseFloat(getComputedStyle(element).getPropertyValue('--card-x')),
    y: Number.parseFloat(getComputedStyle(element).getPropertyValue('--card-y')),
  }))
  expect(active.glare).toBe('achievement-card-glare')
  expect(active.overlayZ).toBeGreaterThan(active.toplineZ)
  expect(active.overlayZ).toBeGreaterThan(active.copyZ)
  expect(active.pointerEvents).toBe('none')
  expect(active.x).toBeCloseTo(78, 1)
  expect(active.y).toBeCloseTo(28, 1)
  expect(Number.parseFloat(await cards.nth(1).evaluate((element) => (
    getComputedStyle(element).getPropertyValue('--card-x')
  )))).toBe(50)
  expect(await card.boundingBox()).toEqual(before)

  await page.mouse.move(10, 10)
  await expect.poll(async () => card.evaluate((element) => Number.parseFloat(
    getComputedStyle(element).getPropertyValue('--card-x'),
  ))).toBe(50)
  await expect.poll(async () => page.evaluate(() => document.getAnimations().filter(({ animationName, playState }) => (
    animationName?.startsWith('achievement-card-') && playState === 'running'
  )).length)).toBe(0)
})

test('achievement gallery uses one WebGL context', async ({ page }) => {
  await page.goto('/')

  const stage = await revealAchievementStage(page)
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
  expect(await stage.locator('canvas').count()).toBe(1)
  expect(await page.locator('.achievement-stage canvas').count()).toBe(1)
})

const responsiveCases = [
  { width: 320, height: 568, video: 'background-study-loop-hd.mp4' },
  { width: 390, height: 844, video: 'background-study-loop-hd.mp4' },
  { width: 700, height: 600, video: 'background-study-loop-hd.mp4' },
  { width: 701, height: 581, video: 'background-study-loop-wide.mp4' },
  { width: 701, height: 641, video: 'background-study-loop-wide.mp4' },
  { width: 720, height: 450, video: 'background-study-loop-wide.mp4' },
  { width: 844, height: 390, video: 'background-study-loop-wide.mp4' },
  { width: 1024, height: 500, video: 'background-study-loop-wide.mp4' },
]

for (const viewport of responsiveCases) {
  test(`${viewport.width}x${viewport.height} keeps core content visible`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const layout = await page.evaluate(() => {
      const bounds = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
      }
      const card = bounds('.identity-card')
      const credit = bounds('.site-footer__credits > summary')
      const mask = bounds('.identity-avatar__mask')
      const avatar = bounds('.identity-avatar')
      const copy = bounds('.identity-card__copy')
      const quote = bounds('.identity-card__statement')
      const scene = bounds('.scene')
      const achievementDeck = bounds('.achievement-deck')
      const achievementHeader = bounds('.achievement-deck__header')
      const overlap = Math.max(0, Math.min(card.right, credit.right) - Math.max(card.x, credit.x))
        * Math.max(0, Math.min(card.bottom, credit.bottom) - Math.max(card.y, credit.y))

      return {
        avatar,
        achievementDeck,
        achievementHeader,
        card,
        copy,
        credit,
        mask,
        overlap,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        overflowY: document.documentElement.scrollHeight - innerHeight,
        quote,
        scene,
        viewport: { width: innerWidth, height: innerHeight },
        video: document.querySelector('video').currentSrc,
      }
    })

    expect(layout.overflowX).toBe(0)
    expect(layout.overflowY).toBeGreaterThan(0)
    expect(layout.card.x).toBeGreaterThanOrEqual(layout.scene.x)
    expect(layout.card.y).toBeGreaterThanOrEqual(layout.scene.y)
    expect(layout.card.right).toBeLessThanOrEqual(layout.scene.right)
    expect(layout.card.bottom).toBeLessThanOrEqual(layout.scene.bottom)
    expect(layout.credit.y).toBeGreaterThanOrEqual(layout.achievementDeck.bottom)
    expect(Math.abs(layout.achievementDeck.y - layout.scene.bottom)).toBeLessThan(1)
    expect(layout.quote.y).toBeGreaterThanOrEqual(Math.max(layout.avatar.bottom, layout.copy.bottom) - 0.5)
    expect(layout.quote.bottom).toBeLessThanOrEqual(layout.card.bottom)
    expect(Math.abs(
      (layout.quote.x + layout.quote.width / 2) - (layout.card.x + layout.card.width / 2),
    )).toBeLessThan(0.5)
    expect(layout.overlap).toBe(0)
    expect(layout.mask.width).toBeGreaterThanOrEqual(24)
    expect(layout.mask.height).toBeGreaterThanOrEqual(24)
    expect(layout.video).toMatch(new RegExp(`${viewport.video}$`))
  })
}

for (const viewport of [
  {
    width: 1440,
    height: 900,
    columns: Math.min(achievementCount, 5),
    rows: Math.ceil(achievementCount / 5),
    minimumVisualHeight: 200,
  },
  {
    width: 390,
    height: 844,
    columns: Math.min(achievementCount, 2),
    rows: Math.ceil(achievementCount / 2),
    minimumVisualHeight: 140,
  },
  {
    width: 320,
    height: 568,
    columns: Math.min(achievementCount, 2),
    rows: Math.ceil(achievementCount / 2),
    minimumVisualHeight: 140,
  },
]) {
  test(`${viewport.width}x${viewport.height} keeps achievement cards contained`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const deck = page.locator('.achievement-deck')
    await deck.scrollIntoViewIfNeeded()
    await expect(deck.locator('.achievement-stage [data-model-state="ready"]')).toHaveCount(instrumentedAchievementCount)
    const layout = await deck.evaluate((element) => {
      const bounds = (element) => {
        const rect = element.getBoundingClientRect()
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        }
      }
      const grid = element.querySelector('.achievement-grid')
      const frame = bounds(element.querySelector('.achievement-window__frame'))
      const ornaments = [...element.querySelectorAll('.achievement-filigree__corner')].map(bounds)
      const vineLayer = element.querySelector('.achievement-vines')
      const vines = [...element.querySelectorAll('.achievement-vines__branch')]
        .filter((branch) => getComputedStyle(branch).display !== 'none')
        .map((branch) => {
          const branchBounds = bounds(branch)
          const viewBox = branch.viewBox.baseVal
          return {
            ...branchBounds,
            preserveAspectRatio: branch.getAttribute('preserveAspectRatio'),
            ratioDelta: Math.abs(
              (branchBounds.width / branchBounds.height) - (viewBox.width / viewBox.height),
            ),
            vectorEffect: getComputedStyle(branch.querySelector('.achievement-vines__stem')).vectorEffect,
          }
        })
      const cards = [...element.querySelectorAll('.achievement-card')].map((card) => ({
        bounds: bounds(card),
        clientHeight: card.clientHeight,
        clientWidth: card.clientWidth,
        copy: bounds(card.querySelector('.achievement-card__copy')),
        detail: (() => {
          const detail = card.querySelector('.achievement-card__copy small')
          const range = document.createRange()
          range.selectNodeContents(detail)
          return {
            contained: detail.scrollHeight <= detail.clientHeight,
            lines: range.getClientRects().length,
          }
        })(),
        scrollHeight: card.scrollHeight,
        scrollWidth: card.scrollWidth,
        text: [...card.querySelectorAll('.achievement-card__copy > *')].map(bounds),
        visual: bounds(card.querySelector('.achievement-card__visual')),
      }))
      const overlaps = cards.some((card, index) => cards.slice(index + 1).some((other) => (
        card.bounds.left < other.bounds.right
        && card.bounds.right > other.bounds.left
        && card.bounds.top < other.bounds.bottom
        && card.bounds.bottom > other.bounds.top
      )))
      const titleStyle = getComputedStyle(element.querySelector('.achievement-card__copy h3'))
      const cardStyle = getComputedStyle(element.querySelector('.achievement-card'))
      return {
        borderWidth: cardStyle.borderTopWidth,
        cards,
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        frame,
        gridGap: Number.parseFloat(getComputedStyle(grid).columnGap),
        grid: bounds(grid),
        ornaments,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        overlaps,
        rows: new Set(cards.map(({ bounds: card }) => Math.round(card.top))).size,
        titleColor: titleStyle.color,
        titleShadow: titleStyle.textShadow,
        vineLayer: {
          overflow: getComputedStyle(vineLayer).overflow,
          zIndex: Number(getComputedStyle(vineLayer).zIndex),
        },
        vines,
        viewportWidth: innerWidth,
      }
    })

    expect(layout.columns).toBe(viewport.columns)
    expect(layout.rows).toBe(viewport.rows)
    expect(layout.overflowX).toBe(0)
    expect(layout.overlaps).toBe(false)
    expect(layout.cards).toHaveLength(achievementCount)
    expect(layout.cards.every(({ copy }) => Math.abs(copy.height - layout.cards[0].copy.height) < 0.5)).toBe(true)
    expect(layout.cards.every(({ detail }) => detail.contained && detail.lines <= 3)).toBe(true)
    expect(layout.borderWidth).toBe('2px')
    expect(layout.gridGap).toBeGreaterThanOrEqual(11)
    expect(layout.ornaments).toHaveLength(4)
    expect(layout.ornaments.every((ornament) => (
      ornament.left >= 0 && ornament.right <= layout.viewportWidth
    ))).toBe(true)
    expect(layout.vines).toHaveLength(5)
    expect(layout.vines.every((vine) => (
      vine.left >= 0 && vine.right <= layout.viewportWidth
    ))).toBe(true)
    expect(layout.vines.every((vine) => (
      vine.preserveAspectRatio === 'xMidYMid meet'
      && vine.ratioDelta < 0.002
      && vine.vectorEffect === 'none'
    ))).toBe(true)
    expect(layout.vineLayer.overflow).toBe('hidden')
    expect(layout.vineLayer.zIndex).toBeLessThan(1)
    expect(layout.frame.left).toBeGreaterThanOrEqual(0)
    expect(layout.frame.right).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.frame.left).toBeLessThan(layout.grid.left)
    expect(layout.frame.top).toBeLessThan(layout.grid.top)
    expect(layout.frame.right).toBeGreaterThan(layout.grid.right)
    expect(layout.frame.bottom).toBeGreaterThan(layout.grid.bottom)
    expect(layout.cards.every((card) => (
      card.bounds.left >= 0
      && card.bounds.right <= layout.viewportWidth
      && card.visual.left >= card.bounds.left
      && card.visual.right <= card.bounds.right
      && card.visual.height >= viewport.minimumVisualHeight
      && card.copy.left >= card.bounds.left
      && card.copy.right <= card.bounds.right
      && card.copy.bottom <= card.bounds.bottom
      && card.scrollWidth <= card.clientWidth
      && card.scrollHeight <= card.clientHeight
      && card.text.every((text) => (
        text.left >= card.bounds.left
        && text.right <= card.bounds.right
        && text.top >= card.bounds.top
        && text.bottom <= card.bounds.bottom
      ))
    ))).toBe(true)
    expect(layout.titleColor).toBe('rgb(240, 237, 231)')
    expect(layout.titleShadow).not.toBe('none')
  })
}

test('failed video keeps the still-image fallback', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route(/\.mp4(?:\?|$)/, (route) => route.abort('failed'))

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Mohit Sharma' })).toBeVisible()
  await expect(page.locator('.scene__landscape')).not.toHaveCSS('background-image', 'none')
  expect(pageErrors).toEqual([])
})

test('nonvisual preferences skip the decorative video payload', async ({ browser }) => {
  for (const preference of [
    { forcedColors: 'none', reducedMotion: 'reduce' },
    { forcedColors: 'active', reducedMotion: 'no-preference' },
  ]) {
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      ...preference,
    })
    const page = await context.newPage()
    const requested = []
    page.on('request', (request) => {
      if (request.url().endsWith('.mp4')) requested.push(request.url())
    })
    await page.goto('/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(100)

    expect(requested).toEqual([])
    await expect(page.locator('.scene__landscape')).not.toHaveCSS('background-image', 'none')
    await context.close()
  }
})

test('decorative hero enhancements wait until the page is idle', async ({ page }) => {
  const requested = []
  page.on('request', (request) => {
    if (/\.mp4$|three\.module-.*\.js$|models\/artifacts\/helios\.glb$/.test(request.url())) {
      requested.push(request.url())
    }
  })
  await page.addInitScript(() => {
    const idleCallbacks = new Map()
    let idleId = 0
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: (callback) => {
        idleId += 1
        idleCallbacks.set(idleId, callback)
        return idleId
      },
    })
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: (id) => idleCallbacks.delete(id),
    })
    window.runIdleEnhancements = () => {
      const callbacks = [...idleCallbacks.values()]
      idleCallbacks.clear()
      callbacks.forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 50 }))
    }
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.waitForLoadState('load')

  const video = page.locator('.scene__landscape-video')
  const hero = page.locator('.tarot-hanging--hero')
  const heroCanvas = hero.locator('canvas')
  const heroFallback = hero.locator('[data-artifact-name="helios"] img')
  const portfolio = page.locator('.portfolio')
  const criticalPreloads = await page.locator('link[rel="preload"]').evaluateAll((links) => (
    links.map((link) => ({
      as: link.getAttribute('as'),
      href: new URL(link.href).pathname,
      media: link.getAttribute('media'),
    }))
  ))
  expect(criticalPreloads).toEqual(expect.arrayContaining([
    { as: 'font', href: '/fonts/Danviska-Regular.woff2', media: null },
    { as: 'font', href: '/fonts/Recursive-Latin.woff2', media: null },
    { as: 'image', href: '/avatar-interactive-frame.webp', media: null },
    { as: 'image', href: '/avatar-interactive-person.webp', media: null },
    {
      as: 'image',
      href: expect.stringMatching(/^\/assets\/avatar-yokai-mask-.*\.svg$/u),
      media: null,
    },
    {
      as: 'image',
      href: '/models/artifacts/helios.webp',
      media: '(min-width: 1360px) and (min-height: 641px)',
    },
  ]))
  await expect(page.locator('.scene__landscape')).not.toHaveCSS('background-image', 'none')
  await expect(heroFallback).toBeVisible()
  await expect(hero).toHaveAttribute('data-render-state', 'standby')
  await expect(hero.locator('[data-tarot-slot]')).toHaveAttribute('data-model-state', 'standby')
  await expect(video).not.toHaveClass(/scene__landscape-video--ready/)
  await expect(video).toHaveCSS('opacity', '0')
  await expect(heroCanvas).toHaveCSS('opacity', '0')
  await expect(portfolio).toHaveClass(/portfolio--critical-ready/)
  await expect(portfolio).toHaveAttribute('aria-busy', 'false')
  expect(await page.evaluate(() => ({
    fontsReady: [
      document.fonts.check('400 1rem "Danviska"'),
      document.fonts.check('400 1rem "Kiona"'),
      document.fonts.check('400 1rem "Recursive Variable"'),
    ].every(Boolean),
    imagesReady: [...document.querySelectorAll(
      '.identity-avatar__frame, .identity-avatar__person, .identity-avatar__mask-art, .tarot-hanging--hero img',
    )].filter((image) => image.getClientRects().length > 0).every((image) => (
      image.complete && image.naturalWidth > 0
    )),
  }))).toEqual({ fontsReady: true, imagesReady: true })
  await expect(portfolio).not.toHaveClass(/portfolio--settled/)
  expect(await page.locator('.scene__content').evaluate((element) => (
    element.getAnimations().find(({ animationName }) => animationName === 'identity-card-float')?.playState
  ))).toBe('paused')
  expect(requested).toEqual([])

  await page.evaluate(() => window.runIdleEnhancements())
  await expect(portfolio).toHaveClass(/portfolio--settled/, { timeout: 2_000 })
  expect(await page.locator('.scene__content').evaluate((element) => (
    element.getAnimations().find(({ animationName }) => animationName === 'identity-card-float')?.playState
  ))).toBe('running')
  await expect.poll(() => requested.some((url) => url.endsWith('.mp4'))).toBe(true)
  expect(requested.some((url) => /three\.module-.*\.js$/.test(url))).toBe(false)
  expect(requested.some((url) => url.endsWith('/models/artifacts/helios.glb'))).toBe(false)
  await expect(video).toHaveClass(/scene__landscape-video--ready/, { timeout: 15_000 })
  await expect(video).toHaveCSS('opacity', '0.92')

  await heroFallback.hover()
  await expect.poll(() => requested.some((url) => /three\.module-.*\.js$/.test(url))).toBe(true)
  await expect.poll(() => requested.some((url) => url.endsWith('/models/artifacts/helios.glb'))).toBe(true)
  await expect(hero).toHaveAttribute('data-render-state', 'ready', { timeout: 15_000 })
  await expect.poll(() => heroCanvas.getAttribute('data-render-count')).not.toBe('0')
  await expect(heroCanvas).toHaveCSS('opacity', '1')
  await expect(heroFallback).toHaveCSS('opacity', '0')
})

test('decorative video starts when reduced motion is disabled later', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const requested = []
  page.on('request', (request) => {
    if (request.url().endsWith('.mp4')) requested.push(request.url())
  })
  await page.goto('/')
  await page.waitForLoadState('load')
  expect(requested).toEqual([])

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => requested.length).toBe(1)
  await expect.poll(() => page.locator('video').evaluate((video) => video.paused)).toBe(false)
})

test('mobile requests only the responsive hero still', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requested = []
  page.on('request', (request) => {
    if (/background-study.*\.webp$/.test(request.url())) {
      requested.push(request.url().split('/').at(-1))
    }
  })
  await page.goto('/')

  expect(requested).toContain('background-study-still.webp')
  expect(requested).not.toContain('background-study-wide-still.webp')
  await expect(page.locator('video')).not.toHaveAttribute('poster')
})

test('background kanji and its font payload are absent', async ({ page }) => {
  const requested = []
  page.on('request', (request) => {
    if (/Kouzan|Kanji/iu.test(request.url())) requested.push(request.url())
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  await expect(page.locator('.scene__kanji-layer, .scene__kanji')).toHaveCount(0)
  expect(requested).toEqual([])
})

test('forced colors removes decorative media and custom cursor', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/')

  await expect(page.locator('.scene__window')).toBeHidden()
  await expect(page.locator('.cursor-follower')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Mohit Sharma' })).toBeVisible()
  const quoteColors = await page.locator('.identity-card__quote').evaluate((element) => ({
    markColor: getComputedStyle(element, '::before').color,
    textColor: getComputedStyle(element).color,
    textShadow: getComputedStyle(element).textShadow,
  }))
  expect(quoteColors.markColor).toBe(quoteColors.textColor)
  expect(quoteColors.textShadow).toBe('none')

  const disciplineBand = page.getByRole('img', {
    name: `Disciplines: ${profile.disciplines.map(({ name, detail }) => `${name} - ${detail}`).join('. ')}.`,
  })
  await expect(disciplineBand).toBeVisible()
  await expect(disciplineBand).toHaveAttribute('data-band-state', 'static')
  expect(await disciplineBand.evaluate((element) => ({
    animations: element.getAnimations({ subtree: true }).filter(({ animationName }) => (
      animationName?.startsWith('discipline-band-')
    )).length,
    abbrColors: [...element.querySelectorAll('.discipline-band__abbr')].map((node) => (
      getComputedStyle(node).color
    )),
    // the accent rules must drop their brand colour for a system colour
    ruleBackgrounds: [...element.querySelectorAll('.discipline-band__rule')].map((rule) => (
      getComputedStyle(rule).backgroundColor
    )),
    detailColors: [...element.querySelectorAll('.discipline-band__detail')].map((node) => (
      getComputedStyle(node).color
    )),
    names: [...element.querySelectorAll('.discipline-band__name')].map((node) => node.textContent),
  }))).toEqual({
    animations: 0,
    abbrColors: Array(profile.disciplines.length).fill('rgb(0, 0, 0)'),
    ruleBackgrounds: Array(profile.disciplines.length).fill('rgb(0, 0, 0)'),
    detailColors: Array(profile.disciplines.length).fill('rgb(0, 0, 0)'),
    names: profile.disciplines.map(({ name }) => name),
  })

  const dossierToggle = page.locator('.credential-card__turn')
  await dossierToggle.focus()
  await page.keyboard.press('Enter')
  await expectDossierDrawer(page)
  await expect(page.locator('.identity-card')).toBeVisible()
  await page.keyboard.press('Tab')
  const resume = page.getByRole('navigation', { name: 'Profile links' }).getByRole('link', { name: /Résumé/u })
  await expect(resume).toBeFocused()
  await expect(page.locator('.credential-card__drawer')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  expect(await resume.evaluate((link) => ({
    style: getComputedStyle(link).outlineStyle,
    width: getComputedStyle(link).outlineWidth,
  }))).toEqual({ style: 'solid', width: '2px' })

  const deck = page.getByRole('region', { name: 'Selected outcomes' })
  await deck.scrollIntoViewIfNeeded()
  await expect(deck.locator('.achievement-card')).toHaveCount(achievementCount)
  await expect(deck.locator('.achievement-card h3')).toHaveCount(achievementCount)
  await expect(deck.locator('.achievement-card__visual').first()).toBeHidden()
  await expect(deck.locator('.achievement-stage__canvas')).toBeHidden()
  await expect(deck.locator('.achievement-filigree')).toBeHidden()
  await expect(deck.locator('.achievement-vines')).toBeHidden()
  await expect(deck.locator('.achievement-card__effects').first()).toBeHidden()
  expect(await deck.locator('.achievement-window').evaluate((element) => {
    const frame = getComputedStyle(element.querySelector('.achievement-window__frame'))
    return {
      background: frame.backgroundImage,
      borderStyle: frame.borderStyle,
      opacity: frame.opacity,
      sideDisplay: getComputedStyle(element, '::before').display,
    }
  })).toEqual({
    background: 'none',
    borderStyle: 'solid',
    opacity: '1',
    sideDisplay: 'none',
  })
  expect(await deck.locator('.achievement-card').evaluateAll((cards) => cards.every((card) => (
    getComputedStyle(card).boxShadow === 'none'
    && getComputedStyle(card).backgroundImage === 'none'
    && getComputedStyle(card, '::before').display === 'none'
  )))).toBe(true)
})

test('credential references and the closing review path name their purpose', async ({ page }) => {
  await page.goto('/')

  const credentials = page.locator('#credentials')
  await credentials.scrollIntoViewIfNeeded()
  await expect(credentials.locator('.certification-focus__references')).toHaveText('Credential references')
  for (const certification of profile.certifications) {
    await credentials.getByRole('button', {
      name: `${certification.issuer}: ${certification.name}`,
    }).click()
    await expect(credentials.locator('.certification-focus ul')).toHaveAttribute(
      'aria-label',
      `Credential references for ${certification.issuer} ${certification.name}`,
    )
  }
  await credentials.getByRole('button', { name: 'ISC2: Certified in Cybersecurity' }).click()
  expect(await credentials.locator('.certification-focus a').evaluateAll((links) => links.map(
    (link) => link.firstChild.textContent.trim(),
  ))).toEqual([
    'Certification page',
    'Badge program',
  ])

  const review = page.getByRole('region', { name: 'Continue reviewing' })
  await review.scrollIntoViewIfNeeded()
  await expect(review.getByRole('heading', { name: 'Continue reviewing' })).toBeVisible()
  expect(await review.getByRole('link').evaluateAll((links) => links.map((link) => ({
    detail: link.querySelector('small').textContent.trim(),
    href: link.getAttribute('href'),
    label: link.querySelector('strong').textContent.trim(),
    target: link.getAttribute('target'),
  })))).toEqual([
    {
      detail: 'Career + credentials',
      href: '/Mohit-Sharma-Resume.pdf',
      label: 'Résumé',
      target: '_blank',
    },
    {
      detail: 'Methods + research notes',
      href: '/blog/',
      label: 'Field notes',
      target: null,
    },
    {
      detail: 'Experience + professional profile',
      href: 'https://www.linkedin.com/in/rinz0x0cruz/',
      label: 'LinkedIn',
      target: '_blank',
    },
    {
      detail: 'Open your default mail app',
      href: 'mailto:rinz0x0cruz@gmail.com',
      label: 'Email',
      target: null,
    },
  ])
  expect(await review.evaluate((element) => ({
    insideMain: document.querySelector('.portfolio').contains(element),
    followedByCredits: element.nextElementSibling === null
      && document.querySelector('.site-footer__credits') !== null,
    overflowX: document.documentElement.scrollWidth - innerWidth,
  }))).toEqual({ insideMain: true, followedByCredits: true, overflowX: 0 })
})