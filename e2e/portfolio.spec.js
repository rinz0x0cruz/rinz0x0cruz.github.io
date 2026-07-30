import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

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

test('mask animation preserves keyboard focus', async ({ page }) => {
  await page.goto('/')

  const mask = page.getByRole('button', { name: 'Dismiss yokai mask' })
  await mask.focus()
  await page.keyboard.press('Enter')
  await expect(mask).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Enter')

  const restoreMask = page.getByRole('button', { name: 'Restore yokai mask' })
  await expect(restoreMask).toBeFocused()
  await expect(restoreMask).toHaveAttribute('aria-disabled', 'false')
})

test('quotes rotate in a dedicated card footer', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('.identity-card__role')).toContainText('Security Researcher')
  await expect(page.locator('.side-channel')).toHaveCount(0)
  await expect(page.locator('.identity-card__quote-measure q')).toHaveCount(9)

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

test('dossier drawer opens while the identity card remains visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const credential = page.locator('.credential-card')
  const card = page.locator('.identity-card')
  const drawer = page.locator('.credential-card__drawer')
  const toggle = page.locator('.credential-card__turn')
  const records = page.getByRole('navigation', { name: 'Profile records', includeHidden: true })
  const links = records.getByRole('link', { includeHidden: true })

  await expect(page.locator('.dossier-slot')).toHaveCount(0)
  await expect(page.locator('.dovetail-spine')).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toContainText('Press start')
  await expect(card).toBeVisible()
  await expect(card).not.toHaveAttribute('aria-hidden', 'true')
  await expect(drawer).toHaveAttribute('aria-hidden', 'true')
  await expect(links).toHaveCount(4)
  expect(await links.evaluateAll((elements) => elements.map((link) => ({
    detail: link.querySelector('em').textContent.trim(),
    href: link.getAttribute('href'),
    label: link.querySelector('strong').textContent.trim(),
    tabIndex: link.tabIndex,
  })))).toEqual([
    { detail: 'Experience record', href: 'https://rinz0x0cruz.github.io/Mohit-Sharma-Resume.pdf', label: 'Résumé', tabIndex: -1 },
    { detail: 'Source / systems', href: 'https://github.com/rinz0x0cruz', label: 'GitHub', tabIndex: -1 },
    { detail: 'Professional network', href: 'https://www.linkedin.com/in/rinz0x0cruz/', label: 'LinkedIn', tabIndex: -1 },
    { detail: 'Direct channel', href: 'mailto:rinz0x0cruz@gmail.com', label: 'Email', tabIndex: -1 },
  ])

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
  await expect(toggle).toContainText('Press back')
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
  { width: 390, height: 844, columns: 2, rows: 2 },
  { width: 320, height: 568, columns: 4, rows: 1 },
  { width: 844, height: 390, columns: 4, rows: 1 },
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

test('fullscreen keeps outcomes close while the credits sit in the page footer', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1300 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const layout = await page.evaluate(() => {
    const card = document.querySelector('.identity-card').getBoundingClientRect()
    const credit = document.querySelector('.font-credit')
    const footer = document.querySelector('.site-footer').getBoundingClientRect()
    const deck = document.querySelector('.achievement-deck').getBoundingClientRect()
    const heading = document.querySelector('.achievement-deck__header').getBoundingClientRect()
    const scene = document.querySelector('.scene').getBoundingClientRect()

    return {
      cardToHeading: heading.top - card.bottom,
      creditInsideFooter: document.querySelector('.site-footer').contains(credit),
      creditPosition: getComputedStyle(credit).position,
      // the footer has no height of its own, so matching heights proves the
      // credit is in flow rather than floated out of the box like it used to be
      footerBelowDeck: footer.top - deck.bottom,
      footerContentHeight: Math.round(
        footer.height - parseFloat(getComputedStyle(document.querySelector('.site-footer')).borderTopWidth),
      ),
      footerOutsideMain: !document.querySelector('.portfolio').contains(credit),
      // every credit line, so the check still means "the footer is exactly its
      // contents" now that pictures are credited alongside the fonts
      creditHeight: Math.round(
        [...document.querySelectorAll('.font-credit')].reduce(
          (total, el) => total + el.getBoundingClientRect().height,
          0,
        ),
      ),
      unusedScene: scene.bottom - card.bottom,
    }
  })

  expect(layout.creditPosition).toBe('relative')
  expect(layout.footerContentHeight).toBe(layout.creditHeight)
  expect(layout.creditInsideFooter).toBe(true)
  expect(layout.footerOutsideMain).toBe(true)
  expect(layout.footerBelowDeck).toBeGreaterThanOrEqual(0)
  expect(layout.unusedScene).toBeLessThanOrEqual(8)
  expect(layout.cardToHeading).toBeGreaterThanOrEqual(64)
  expect(layout.cardToHeading).toBeLessThanOrEqual(80)
})

test('footer vines grow on arrival and stay behind the credit line', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 900, height: 700 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const footer = page.locator('.site-footer')
    await expect(footer).not.toHaveClass(/site-footer--grown/)
    await footer.scrollIntoViewIfNeeded()
    await expect(footer).toHaveClass(/site-footer--grown/)

    const state = await footer.evaluate((element) => {
      const credit = element.querySelector('.font-credit')
      const vines = element.querySelector('.achievement-vines')

      return {
        borderTop: parseFloat(getComputedStyle(element).borderTopWidth),
        // the branches are placed with negative offsets, so the footer has to
        // clip them rather than let them widen the document
        clipped: getComputedStyle(element).overflow,
        creditLayer: Number(getComputedStyle(credit).zIndex),
        focusableDecoration: vines.querySelectorAll(
          'a[href], button, [tabindex]:not([tabindex="-1"])',
        ).length,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        vinesHidden: vines.getAttribute('aria-hidden'),
        vinesLayer: Number(getComputedStyle(vines).zIndex),
      }
    })

    expect(state.vinesHidden).toBe('true')
    expect(state.focusableDecoration).toBe(0)
    expect(state.creditLayer).toBeGreaterThan(state.vinesLayer)
    expect(state.clipped).toBe('hidden')
    expect(state.overflowX).toBe(0)
    expect(state.borderTop).toBeGreaterThanOrEqual(4)
  }
})

test('reduced motion settles the vines fully grown everywhere', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.site-footer').scrollIntoViewIfNeeded()

  const settled = await page.evaluate(() => {
    const running = (root) => root.getAnimations({ subtree: true }).filter(({ animationName }) => (
      animationName?.startsWith('achievement-vine')
    )).length
    const footer = document.querySelector('.site-footer')

    return {
      deckRunning: running(document.querySelector('.achievement-deck')),
      footerRunning: running(footer),
      stemDashoffset: getComputedStyle(footer.querySelector('.achievement-vines__stem')).strokeDashoffset,
      vinesOpacity: getComputedStyle(footer.querySelector('.achievement-vines')).opacity,
    }
  })

  expect(settled.footerRunning).toBe(0)
  expect(settled.deckRunning).toBe(0)
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
      const credit = bounds('.font-credit')
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
    { width: 320, height: 568, card: [256, 301.89], visible: false },
    { width: 844, height: 390, card: [780, 255.5], visible: false },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const band = page.locator('.discipline-band')
    await expect(band).toHaveAttribute(
      'aria-label',
      'Disciplines: Threat intelligence - Hunt reporting · OSINT · ATT&CK.'
      + ' Governance, risk & compliance - ISO 27001/42001 LA · CIS controls.'
      + ' Vulnerability management - CVE triage · exploitability.',
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
    abbrs: ['TI', 'GRC', 'VM'],
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
    expect(await band.locator('.discipline-band__name').allTextContents()).toEqual([
      'Threat intelligence',
      'Governance, risk & compliance',
      'Vulnerability management',
    ])
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
    abbrs: ['TI', 'GRC', 'VM'],
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

    expect(layout.count).toBe(5)
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
  await expect(section.locator('.chapter__company')).toHaveText([
    'Microsoft',
    'Hacker4Justice',
    'Microsoft',
    'Black Hills',
    'IndussianAssist',
  ])
  await expect(section.locator('.chapter__dates')).toHaveText([
    'Jun 2025 — Present',
    'Jun 2025 — Jun 2026',
    'May 2024 — Jul 2024',
    'May 2023 — Aug 2023',
    'Feb 2023 — Apr 2023',
  ])
  await expect(section.locator('.chapter__outcome')).toHaveCount(5)
  await expect(section.locator('.chapter__notable li')).toHaveCount(15)
  // the volunteer investigation stays deliberately unquantified
  await expect(section.locator('.chapter__outcome')).not.toContainText(['4,800'])

  // every card carries a picture now, and every one of them is described
  const photos = section.locator('.chapter__photo img')
  await expect(photos).toHaveCount(5)
  for (const alt of await photos.evaluateAll((els) => els.map((e) => e.alt))) {
    expect(alt.length).toBeGreaterThan(20)
  }

  // the borrowed photographs are credited in the page footer, not on the cards
  // where the credit line crowded the caption off the card
  await expect(section.locator('.photo-credit')).toHaveCount(0)
  const credits = page.locator('.font-credit--photos')
  await expect(credits).toContainText('Sukhna Lake')
  await expect(credits.locator('a[rel~="license"]')).toHaveCount(3)
})

test('career photographs are framed, not cropped a second time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const frames = page.locator(
    '.experience__frontispiece img, .chapter__photo img, .chapter__scene img',
  )
  await expect(frames).toHaveCount(7)
  await page.locator('.experience').scrollIntoViewIfNeeded()

  for (let i = 0; i < 7; i += 1) {
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
      return {
        // a timeline that resolves to null leaves the animation attached but
        // never running, which is how the old card drift sat dead while its
        // animation-name still read exactly right
        live: face.getAnimations().some((a) => a.timeline && a.timeline.currentTime != null),
        saturation: Number(/saturate\(([\d.]+)\)/.exec(getComputedStyle(face).filter)?.[1] ?? NaN),
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

test('a thrown note keeps travelling and stays within reach', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const rail = page.locator('.experience__rail')
  await rail.scrollIntoViewIfNeeded()
  // the note sits under the portrait at the head of the rail now
  await rail.evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }))
  await page.waitForTimeout(300)

  const note = page.locator('.sticky-note')
  const start = await note.boundingBox()
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 - 120, start.y + start.height / 2, { steps: 4 })
  await page.mouse.up()

  const released = await note.boundingBox()
  await page.waitForTimeout(700)
  const rest = await note.boundingBox()

  // let go in motion, it coasts past the point the pointer let go of it
  expect(rest.x).toBeLessThan(released.x)
  // and never past its tether, so a hard throw cannot lose it off the rail
  const carried = await note.evaluate((el) =>
    Math.abs(parseFloat(getComputedStyle(el).getPropertyValue('--note-x'))),
  )
  expect(carried).toBeLessThanOrEqual(260)
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
    const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
    const samples = []
    for (let y = Math.max(0, maxY - 800); y <= maxY; y += 100) {
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

  const box = await page.locator('.chapter').first().boundingBox()
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.18)
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
  const still = await page.locator('.chapter').first().boundingBox()
  await page.mouse.move(still.x + still.width * 0.85, still.y + still.height * 0.18)
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

test('the drawing credits its artist, and the signature answers a hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const credit = page.locator('.plate-credit')
  // the attribution is readable without hovering: hiding it would not be credit
  await expect(credit).toBeVisible()
  await expect(credit).toContainText('Sugarplum')

  const read = () =>
    page.evaluate(() => {
      const letters = [...document.querySelectorAll('.plate-credit__letter')]
      const axis = (el, name) =>
        Number(new RegExp(`"${name}" ([\\d.]+)`).exec(getComputedStyle(el).fontVariationSettings)?.[1])
      return {
        weight: axis(letters[0], 'wght'),
        casual: axis(letters[0], 'CASL'),
        underline: getComputedStyle(document.querySelector('.plate-credit__name')).backgroundSize,
        stagger: [letters[0], letters.at(-1)].map(
          (el) => Number.parseFloat(getComputedStyle(el).transitionDelay),
        ),
      }
    })

  const rest = await read()
  expect(rest.weight).toBe(520)
  expect(rest.casual).toBe(0)
  expect(rest.underline).toBe('0px 1px')
  // each letter answers a beat later than the one before it
  expect(rest.stagger[1]).toBeGreaterThan(rest.stagger[0])

  const plate = await page.locator('.experience__frontispiece').boundingBox()
  await page.mouse.move(plate.x + plate.width / 2, plate.y + plate.height / 2)
  await expect.poll(async () => (await read()).weight, { timeout: 3000 }).toBe(780)
  // polled separately: the rule takes 460ms against the letters' 300ms, so
  // waiting only for the weight caught it mid-draw at 99.85%
  await expect.poll(async () => (await read()).underline, { timeout: 3000 }).toBe('100% 1px')

  expect((await read()).casual).toBe(1)

  // reduced motion still reaches the same state, it just does not travel there
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()
  const still = await page.locator('.plate-credit__letter').first().evaluate((el) => ({
    transition: getComputedStyle(el).transitionDuration,
  }))
  expect(still.transition).toBe('0s')
  const box = await page.locator('.experience__frontispiece').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(200)
  expect((await read()).weight).toBe(780)
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

  const shove = () =>
    rail.evaluate((el) =>
      el.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 100, shiftKey: true, bubbles: true, cancelable: true }),
      ),
    )

  await shove()
  await page.waitForTimeout(60)
  const early = await rail.evaluate((el) => el.scrollLeft)
  await page.waitForTimeout(700)
  const settled = await rail.evaluate((el) => el.scrollLeft)

  expect(early).toBeGreaterThan(0)
  expect(settled).toBeGreaterThan(early)
  expect(settled).toBeGreaterThan(140)
  // heavy: only a small share of the journey happens in the first moments
  expect(early / settled).toBeLessThan(0.3)
})

test('the rail can be moved by its own controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.experience').scrollIntoViewIfNeeded()

  const rail = page.locator('.experience__rail')
  const back = page.getByRole('button', { name: 'Previous roles' })
  const on = page.getByRole('button', { name: 'Later roles' })

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
  await expect(rail).toHaveAttribute('aria-label', /career/i)
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
  const y = box.y + box.height / 2
  let x = box.x + box.width - 140

  await page.mouse.move(x, y)
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
  await expect(back).toHaveAttribute('aria-hidden', 'false')
  await expect(back).toContainText('Could not have done it without both of you')

  await note.locator('.sticky-note__reply').click()
  await expect(note).not.toHaveClass(/sticky-note--flipped/)
  await expect(back).toHaveAttribute('aria-hidden', 'true')
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
  expect(await note.locator('.sticky-note__face--front').getAttribute('tabindex')).toBe('-1')
  expect(await note.locator('.sticky-note__reply').getAttribute('tabindex')).toBe('0')

  await note.locator('.sticky-note__reply').focus()
  await page.keyboard.press('Enter')
  await expect(note).not.toHaveClass(/sticky-note--flipped/)
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

test('achievement cards present four verified outcomes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const deck = page.getByRole('region', { name: 'Selected outcomes' })
  const cards = deck.locator('.achievement-card')
  await expect(cards).toHaveCount(4)
  await expect(deck).toHaveCSS('background-image', 'none')
  await expect(deck).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(deck).toHaveCSS('border-top-width', '0px')
  await expect(deck.locator('h3')).toHaveText([
    'Incidents & CVEs triaged',
    'Shipped Security Config',
    'Ingestion specs authored',
    'STORM-2230 hunt report',
  ])
  await expect(deck.locator('.achievement-card__copy > b')).toHaveText(['100+', 'GA', '9/10', '05D'])
  await expect(deck.locator('.achievement-card__topline > span')).toHaveCount(0)
  await expect(deck.locator('.achievement-card__topline > strong')).toHaveText(['◇', '⌗', '△', '⌁'])
  await expect(deck.getByRole('tab')).toHaveCount(0)
  await deck.scrollIntoViewIfNeeded()
  const stage = deck.locator('.achievement-stage')
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(4)
  await expect(stage.locator('.achievement-stage__canvas')).toHaveAttribute('data-render-state', 'ready')
  await expect(deck.locator('.achievement-card__visual .achievement-art')).toHaveCount(0)

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
  expect(presentation.columns).toBe(4)
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

test('reload settles the living border before initializing 3D instruments', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const window = page.locator('.achievement-window')
  await window.scrollIntoViewIfNeeded()
  await expect(window.locator('[data-model-state="ready"]')).toHaveCount(4)
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
  await expect(window.locator('.achievement-stage')).toHaveCount(0)
  await page.waitForTimeout(100)
  await expect(window.locator('.achievement-stage')).toHaveCount(0)

  await window.evaluate((element) => {
    element.getAnimations({ subtree: true })
      .filter((animation) => Number.isFinite(animation.effect.getComputedTiming().endTime))
      .forEach((animation) => animation.finish())
  })
  await expect(window.locator('[data-model-state="ready"]')).toHaveCount(4)
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

test('achievement instruments render four nonblank regions in one canvas', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const stage = page.locator('.achievement-stage')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(4)
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

  expect(opaquePixels).toHaveLength(4)
  expect(opaquePixels.every((count) => count > 100)).toBe(true)
  expect(pageErrors).toEqual([])
})

test('achievement instruments keep a static reduced-motion render', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const stage = page.locator('.achievement-stage')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(4)
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
    if (/AchievementInstrument.*\.js$|\.glb$/.test(request.url())) requested.push(request.url())
  })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const deck = page.locator('.achievement-deck')
  await deck.scrollIntoViewIfNeeded()
  await expect(deck.locator('.achievement-card')).toHaveCount(4)
  await expect(deck.locator('.achievement-card__visual .achievement-art')).toHaveCount(4)
  await page.waitForTimeout(1_500)
  await expect(deck.locator('.achievement-stage')).toHaveCount(0)
  expect(requested).toEqual([])
})

test('achievement instruments remain still while idle', async ({ page }) => {
  await page.goto('/')

  const stage = page.locator('.achievement-stage')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(4)
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

  const stage = page.locator('.achievement-stage')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="failed"]')).toHaveCount(4)
  await expect(stage.locator('canvas')).toHaveAttribute('data-render-state', 'failed')
  await expect(stage.locator('.achievement-art')).toHaveCount(4)
  expect(await stage.locator('.achievement-art').evaluateAll((elements) => (
    elements.every((element) => Number(getComputedStyle(element).opacity) > 0)
  ))).toBe(true)
  expect(pageErrors).toEqual([])
})

test('achievement instruments react across every full card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const stage = page.locator('.achievement-stage')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(4)
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

  const stage = page.locator('.achievement-stage')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(4)
  const cards = stage.locator('.achievement-card')
  await expect(cards.locator('.achievement-card__effects')).toHaveCount(4)
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

  const stage = page.locator('.achievement-stage')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage.locator('[data-model-state="ready"]')).toHaveCount(4)
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
      const credit = bounds('.font-credit')
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
  { width: 1440, height: 900, columns: 4, rows: 1, minimumVisualHeight: 200 },
  { width: 390, height: 844, columns: 2, rows: 2, minimumVisualHeight: 140 },
  { width: 320, height: 568, columns: 2, rows: 2, minimumVisualHeight: 140 },
]) {
  test(`${viewport.width}x${viewport.height} keeps four achievement cards contained`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const deck = page.locator('.achievement-deck')
    await deck.scrollIntoViewIfNeeded()
    await expect(deck.locator('[data-model-state="ready"]')).toHaveCount(4)
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
    expect(layout.cards).toHaveLength(4)
    expect(layout.cards.every(({ copy }) => Math.abs(copy.height - layout.cards[0].copy.height) < 0.5)).toBe(true)
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

for (const viewport of [
  { width: 1280, height: 700 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}x${viewport.height} keeps kanji outside interface surfaces`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const layout = await page.evaluate(async () => {
      const bounds = (element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
      }
      const expand = (rect, amount) => ({
        left: rect.left - amount,
        top: rect.top - amount,
        right: rect.right + amount,
        bottom: rect.bottom + amount,
      })
      const intersects = (first, second) => (
        first.left < second.right
        && first.right > second.left
        && first.top < second.bottom
        && first.bottom > second.top
      )
      const kanjiElements = [...document.querySelectorAll('.scene__kanji')]
      const worstCases = {
        'scene__kanji--left': { text: '魂', rotation: '10deg' },
        'scene__kanji--right': { text: '魂', rotation: '-10deg' },
        'scene__kanji--bottom': { text: '鳥影', rotation: '10deg' },
      }
      kanjiElements.forEach((element) => {
        const slot = [...element.classList].find((className) => className.startsWith('scene__kanji--'))
        element.textContent = worstCases[slot].text
        element.style.setProperty('--kanji-rotation', worstCases[slot].rotation)
      })
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const exclusions = [
        expand(bounds(document.querySelector('.scene__window')), 16),
        expand(bounds(document.querySelector('.identity-card')), 16),
      ]

      return {
        kanji: kanjiElements.map((element) => ({
          bounds: bounds(element),
          collision: exclusions.some((exclusion) => intersects(bounds(element), exclusion)),
          size: getComputedStyle(element).fontSize,
          slot: [...element.classList].find((className) => className.startsWith('scene__kanji--')),
          text: element.textContent.trim(),
        })),
        layerInsideMedia: Boolean(document.querySelector('.scene__window .scene__kanji-layer')),
        viewport: { width: innerWidth, height: innerHeight },
      }
    })

    expect(layout.layerInsideMedia).toBe(false)
    expect(layout.kanji).toHaveLength(3)
    expect(layout.kanji.every(({ collision }) => !collision)).toBe(true)
    expect(layout.kanji.every(({ bounds }) => (
      bounds.left >= 0
      && bounds.top >= 0
      && bounds.right <= layout.viewport.width
      && bounds.bottom <= layout.viewport.height
    ))).toBe(true)
    expect(layout.kanji.filter(({ slot }) => slot !== 'scene__kanji--bottom').every(({ text }) => text.length === 1)).toBe(true)
    // one size for every slot, and the same size either side of the 1400px step
    expect([...new Set(layout.kanji.map(({ size }) => size))]).toEqual(['64px'])
  })
}

test('compact layouts hide the kanji layer', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/')

  await expect(page.locator('.scene__kanji-layer')).toBeHidden()
})

test('every rotating kanji is drawn by the brush subset', async ({ page }) => {
  const source = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const pools = [...source.matchAll(/const (?:single)?[kK]anjiOptions = \[([^\]]+)\]/g)]
  expect(pools).toHaveLength(2)

  const characters = [...new Set(
    pools.flatMap(([, body]) => [...body.matchAll(/'([^']+)'/g)].map(([, entry]) => entry)).join(''),
  )]
  expect(characters.length).toBeGreaterThan(0)

  await page.goto('/')

  // document.fonts.check() only consults unicode-range and reports true for
  // glyphs the file does not contain, so paint each one against the brush face
  // and against plain serif - identical pixels mean it quietly fell back
  const uncovered = await page.evaluate(async (chars) => {
    await document.fonts.load('64px "Kouzan Mouhitsu"', chars.join(''))
    const draw = (character, family) => {
      const canvas = document.createElement('canvas')
      canvas.width = 80
      canvas.height = 80
      const context = canvas.getContext('2d')
      context.font = `64px ${family}`
      context.textBaseline = 'top'
      context.fillText(character, 4, 4)
      return canvas.toDataURL()
    }

    return chars.filter((character) => (
      draw(character, '"Kouzan Mouhitsu", serif') === draw(character, 'serif')
    ))
  }, characters)

  expect(uncovered).toEqual([])
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
    name: 'Disciplines: Threat intelligence - Hunt reporting · OSINT · ATT&CK.'
      + ' Governance, risk & compliance - ISO 27001/42001 LA · CIS controls.'
      + ' Vulnerability management - CVE triage · exploitability.',
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
    abbrColors: Array(3).fill('rgb(0, 0, 0)'),
    ruleBackgrounds: Array(3).fill('rgb(0, 0, 0)'),
    detailColors: Array(3).fill('rgb(0, 0, 0)'),
    names: ['Threat intelligence', 'Governance, risk & compliance', 'Vulnerability management'],
  })

  const dossierToggle = page.locator('.credential-card__turn')
  await dossierToggle.focus()
  await page.keyboard.press('Enter')
  await expectDossierDrawer(page)
  await expect(page.locator('.identity-card')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Résumé' })).toBeFocused()
  await expect(page.locator('.credential-card__drawer')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  expect(await page.getByRole('link', { name: 'Résumé' }).evaluate((link) => ({
    style: getComputedStyle(link).outlineStyle,
    width: getComputedStyle(link).outlineWidth,
  }))).toEqual({ style: 'solid', width: '2px' })

  const deck = page.getByRole('region', { name: 'Selected outcomes' })
  await deck.scrollIntoViewIfNeeded()
  await expect(deck.locator('.achievement-card')).toHaveCount(4)
  await expect(deck.locator('.achievement-card h3')).toHaveCount(4)
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