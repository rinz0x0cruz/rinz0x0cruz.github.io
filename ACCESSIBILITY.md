# Accessibility review

Automated checks run in Playwright on desktop and mobile Chromium with reduced
motion enabled. They cover initial routes plus revealed navigation, terminal,
project-hotspot, case-carousel, focused-contact, light-theme, and dark-theme
states. Axe catches only machine-detectable issues; it is not a conformance
claim.

## Manual release checklist

Run this checklist for changes to navigation, interaction, typography, content
structure, motion, or color.

### Keyboard

- Start at the address bar and traverse every route using `Tab` and `Shift+Tab`.
- Confirm the skip link is first, visible on focus, and moves focus to `main`.
- Open and close the mobile menu and terminal without a pointer.
- Traverse every Project Cinema tab, hotspot, carousel command, detail action,
  article source ledger, and contact command.
- Confirm no hidden slide receives focus and `Escape` returns terminal focus to
  its opener.

### Screen reader

- Test one desktop route with NVDA + Firefox and one mobile route with TalkBack
  + Chrome.
- Verify page title, landmarks, heading order, link purpose, image alternatives,
  current carousel state, expanded hotspot state, and terminal dialog name.
- Confirm the redacted case visual description communicates its evidence path
  without depending on color or the image's embedded text.

### Zoom and reflow

- Check 200% and 400% browser zoom at 1280 CSS pixels.
- Check a 320 CSS-pixel viewport without horizontal page scrolling.
- Expand the longest source ledger, project title, case title, and navigation
  menu; confirm text remains visible and commands do not overlap.

### Color and platform modes

- Check light and dark themes, Windows High Contrast, and forced-colors mode.
- Verify text, focus rings, borders, status indicators, and disabled/hidden
  states remain distinguishable without relying on color alone.

### Motion

- Enable reduced motion before loading the page.
- Confirm content remains visible, carousel autoplay stops, focus does not cause
  internal panel scrolling, and no non-essential scan/orbit animation persists.

Record the OS, browser/assistive-technology version, route, result, and any
follow-up issue in the release notes or pull request.