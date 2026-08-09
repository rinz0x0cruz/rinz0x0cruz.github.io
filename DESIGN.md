---
name: Rinzler Portfolio
description: "The Gilded Research Instrument: a tactile, precise, personal Experience-mode portfolio."
colors:
  burnished-brass: "#d1a35f"
  soot-black: "#000000"
  iron-border: "#31302d"
  smoked-surface: "rgba(8, 8, 8, 0.88)"
  warm-ivory: "#f0ede7"
  quiet-stone: "#a7a39b"
typography:
  display:
    fontFamily: "Danviska, serif"
    fontSize: "3.5rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "Danviska, serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0"
  title:
    fontFamily: "Danviska, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0"
  body:
    fontFamily: "Recursive Variable, Segoe UI, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Kiona, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.08em"
  data:
    fontFamily: "Recursive Variable, ui-monospace, monospace"
    fontSize: "0.68rem"
    fontWeight: 520
    lineHeight: 1.5
    letterSpacing: "0"
  pixel:
    fontFamily: "Mackie Pixel, Pixelify Sans, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0"
  pixel-highlight:
    fontFamily: "Mackie Pixel Shine, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0"
  handwritten:
    fontFamily: "Caveat Note, cursive"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.24
    letterSpacing: "0"
rounded:
  control: "4px"
  evidence: "6px"
  chapter: "9px"
  window: "10px"
  round: "50%"
spacing:
  compact: "0.5rem"
  control: "0.75rem"
  base: "1rem"
  object: "1.5rem"
  wide: "2rem"
  section: "4rem"
components:
  fixed-recruiter-nav:
    backgroundColor: "#050505"
    textColor: "#cbc6bd"
    typography: "{typography.label}"
    height: "3.25rem"
    padding: "0.4rem 1rem"
  fixed-recruiter-nav-active:
    backgroundColor: "#15130f"
    textColor: "{colors.burnished-brass}"
    typography: "{typography.label}"
    height: "3.25rem"
    padding: "0.4rem 1rem"
  profile-links-control:
    backgroundColor: "#0d0d0c"
    textColor: "{colors.warm-ivory}"
    typography: "{typography.pixel}"
    rounded: "{rounded.control}"
    padding: "0.55rem 0.8rem 0.48rem"
    height: "2.75rem"
  profile-links-control-hover:
    backgroundColor: "#17140f"
    textColor: "{colors.warm-ivory}"
    typography: "{typography.pixel}"
    rounded: "{rounded.control}"
    padding: "0.55rem 0.8rem 0.48rem"
    height: "2.75rem"
  identity-evidence-card:
    backgroundColor: "#080808"
    textColor: "{colors.warm-ivory}"
    rounded: "{rounded.evidence}"
    padding: "2rem 2.5rem 1.75rem"
  chapter-card:
    backgroundColor: "#0a0a09"
    textColor: "{colors.warm-ivory}"
    rounded: "{rounded.chapter}"
    padding: "1.15rem"
    width: "19.5rem"
  chapter-turn-control:
    backgroundColor: "transparent"
    textColor: "#bab5ac"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.6rem"
  achievement-card:
    backgroundColor: "#080808"
    textColor: "{colors.warm-ivory}"
    rounded: "{rounded.evidence}"
    padding: "1.05rem 1rem 1.1rem"
  project-stamp:
    backgroundColor: "#ece7dc"
    textColor: "#1d1c19"
    typography: "{typography.label}"
    padding: "0.75rem 0.65rem 0.65rem"
  language-switch:
    backgroundColor: "#0d0d0c"
    textColor: "#89847b"
    rounded: "{rounded.control}"
    padding: "3px"
    height: "2.75rem"
  certification-seal:
    backgroundColor: "#11100e"
    textColor: "#c8c2b7"
    typography: "{typography.data}"
    rounded: "{rounded.round}"
    width: "4.65rem"
  review-path:
    backgroundColor: "transparent"
    textColor: "{colors.warm-ivory}"
    typography: "{typography.body}"
    padding: "4.5rem 0 5rem"
    width: "72rem"
  sticky-note:
    backgroundColor: "#d8bd6a"
    textColor: "#22190a"
    typography: "{typography.handwritten}"
    rounded: "2px"
    padding: "1.4rem 1.3rem"
---

# Design System: Rinzler Portfolio

## Overview

**Creative North Star: "The Gilded Research Instrument"**

Rinzler Portfolio is an Experience-mode surface built around The Gilded Research Instrument. A Soot Black field carries handled evidence objects with Burnished Brass calibrations, dark metal edges, deliberate typography, and personal material details. The interface is tactile, precise, and personal: it feels operated and inspected rather than merely viewed.

Atmosphere stays behind proof. Full-bleed media, quiet texture, pixel details, filigree, paper, and handwriting create presence, while fixed navigation, measured labels, explicit focus, and complete static fallbacks keep the work legible. Components are treated as handled evidence objects: structural at rest, lifted in response, and never detached from their purpose.

**Key Characteristics:**

- Experience mode with artifact-led first viewport composition and one verified proof line.
- Tactile, precise, personal surfaces built as handled evidence objects.
- Burnished Brass calibration on a Soot Black field.
- Complete keyboard, reduced-motion, reduced-data, and forced-colors states.

## Colors

The palette is nearly monochrome and material-led, with Burnished Brass as the single global accent.

### Primary

- **Burnished Brass** (#d1a35f): Marks focus, selected states, measured rules, evidence emphasis, and small counterchanged surfaces.

### Neutral

- **Soot Black** (#000000): Forms the continuous page field behind every object.
- **Iron Border** (#31302d): Separates dark objects without introducing bright outlines.
- **Smoked Surface** (rgba(8, 8, 8, 0.88)): Provides translucent dark control and overlay surfaces.
- **Warm Ivory** (#f0ede7): Carries primary text and high-value labels.
- **Quiet Stone** (#a7a39b): Carries supporting copy and secondary metadata.

Cool Instrument Steel, Project Paper, Note Gold, and Vine Green are observed component-local materials. They stay attached to instruments, stamps, notes, and botanical ornament rather than becoming global page roles.

### Named Rules

**The Brass Rarity Rule.** Burnished Brass is the only global accent; reserve it for focus, selection, evidence, short rules, and small measured inversions.

**The Material Color Rule.** Cool Instrument Steel, Project Paper, Note Gold, and Vine Green stay inside the components whose materials they describe; they do not become page themes.

## Typography

**Display Font:** Danviska (with serif fallback)

**Body Font:** Recursive Variable (with Segoe UI and sans-serif fallbacks)

**Label Font:** Kiona (with sans-serif fallback)

**Data Font:** Recursive Variable mono axis (with ui-monospace and monospace fallbacks)

**Pixel Fonts:** Mackie Pixel with Mackie Pixel Shine and Pixelify Sans

**Handwritten Font:** Caveat Note (with cursive fallback)

**Character:** Danviska gives names and section headings a quiet engraved presence. Kiona handles controls and labels; Recursive carries explanation and technical data; Mackie Pixel stamps machine-authored details; Caveat Note is reserved for personal remarks.

### Hierarchy

- **Display** (400, 3.5rem, 1): Identity names and the largest typographic moments; it contracts to 2rem at the primary responsive breakpoint.
- **Headline** (400, 2.75rem, 1): Section names and major instrument headings.
- **Title** (400, 1.25rem, 1.05): Evidence titles and object names inside bounded surfaces.
- **Body** (400, 0.78rem, 1.5): Explanatory copy, details, and supporting evidence.
- **Label** (400, 0.68rem, 0.08em): Navigation, actions, and categorical labels, usually uppercase.
- **Data** (520, 0.68rem, 1.5): Dates, counts, measurements, and technical readouts with the Recursive mono axis.
- **Pixel** (400, 0.75rem, 1.25): Quotes, stamps, and machine-authored marks; the Shine face is an aligned highlight overlay, never a standalone text voice.
- **Handwritten** (600, 1.15rem, 1.24): Personal notes and reflections only.

Script-specific language controls keep their observed Nirmala UI and Yu Mincho fallbacks so native letterforms remain legible.

### Named Rules

**The Voice by Function Rule.** Danviska names, Kiona labels and acts, Recursive explains and measures, Mackie Pixel stamps, and Caveat Note speaks personally.

**The Pixel Integrity Rule.** Keep Mackie Pixel on whole-pixel render sizes, pair Mackie Pixel Shine only as its aligned highlight layer, and never smooth its edges with blur.

## Layout

The page uses a 72rem primary measure with responsive side gutters. The first viewport caps full-bleed ambient media at 42svh so it can dissolve into Soot Black without delaying the centered identity object and its first résumé-backed proof. The complete Outcomes instrument follows on a tighter handoff; later sections align headings and instruments to the same measure. Horizontal career chapters use an intentionally wider framed rail, while project, language, and credential instruments reflow within the measure.

The primary responsive breakpoint is 700px. At and below it, navigation compacts, the identity object becomes a smaller two-column arrangement, achievement spacing tightens, and multi-image chapters preserve their evidence in a shorter shared band. Additional width and height queries handle two-column achievements, paired project stamps, stacked instrument benches, short viewports, and large-screen ambient ornament without changing content order.

Movement is progressive enhancement. Keyboard navigation covers fixed links, rail steps, arrow keys, Home and End, turn controls, switches, stamps, seals, and the note. Reduced motion resolves every object to its finished state; reduced data skips heavy instruments; forced colors removes decorative media and restores system colors and borders.

### Named Rules

**The One Measure Rule.** Headings and primary instruments share the 72rem measure; only an interaction that needs travel may run wider.

**The Reflow, Don't Remove Rule.** Responsive layouts may stack, compress, or scroll, but they preserve every evidence object and its reading order.

## Elevation & Depth

Elevation is structural at rest, lifted in response. Dark surfaces use broad ambient shadows for separation and inset one-pixel highlights for metal thickness; hover and focus increase lift, edge light, or material sheen rather than adding unrelated decoration.

### Shadow Vocabulary

- **Identity Ambient** (`0 2rem 6rem rgba(0, 0, 0, 0.58), inset 0 1px rgba(255, 255, 255, 0.04)`): Holds the primary identity object above the ambient scene.
- **Chapter Rest** (`0 16px 34px rgba(0, 0, 0, 0.55), inset 0 1px rgba(255, 255, 255, 0.06)`): Gives career chapters a handled plate thickness.
- **Chapter Response** (`0 24px 48px rgba(0, 0, 0, 0.62), inset 0 1px rgba(255, 255, 255, 0.09)`): Lifts the chapter being inspected.
- **Window Structure** (`inset 0 1px rgba(255, 255, 255, 0.05), 0 18px 40px rgba(0, 0, 0, 0.45)`): Frames bounded instruments without making them float independently.

### Named Rules

**The Structural at Rest Rule.** Establish thickness with border, tonal layering, and inset light before using lift; response may deepen the ambient shadow but must preserve the object's material.

**The Finished Fallback Rule.** Motion may reveal, turn, drift, or settle an object, but the no-motion state always shows the complete final composition.

## Shapes

Corners encode object scale. Controls and inner frames use a tight 4px radius; identity and achievement objects use 6px; career chapters use 9px; enclosing instrument windows use 10px. Circular geometry is reserved for directional rail controls, status indicators, and certification seals. Borders are usually one dark pixel with an inset light edge; perforation, paper rotation, and filigree belong only to the materials that require them.

### Named Rules

**The Radius by Object Rule.** Use 4px for controls, 6px for identity and achievement objects, 9px for chapters, and 10px for enclosing windows; do not round every layer alike.

**The Edge Carries Meaning Rule.** A border describes construction, selection, or clipping; ornamental edges stay local to the object whose material they explain.

## Components

The component philosophy is handled evidence objects: each recurring component has a visible construction, a clear state change, and an accessible way to operate it.

### Fixed Recruiter Navigation

A 3.25rem fixed dark bar uses Kiona labels, hairline dividers, one short brass calibration, horizontally scrollable section links, and compact identity and profile-links controls. Hover and expanded states warm the background; focus uses a high-contrast inset outline.

### Profile Links Control

The compact pixel-labeled control sits above the identity object and opens a 6px-radius record drawer. Link records use dark metal cells, numeric data labels, a short brass edge mark, lift on hover, and an explicit focus outline; Escape closes the panel and returns focus.

### Identity Evidence Card

The 6px-radius identity object combines a framed interactive portrait, name, role, availability readout, one compact résumé-proof link, discipline data, and pixel statement on a solid near-black surface. On narrow screens the proof rule spans the inner card width so the current role and one verified outcome remain readable together. Its broad ambient shadow and inset highlight establish the reference depth for other evidence objects.

### Career Chapter

Each 9px-radius chapter is a fixed-width handled plate with aligned media, period stamp, role information, and a 4px-radius turn control. Turning reveals outcomes, notable work, and a handwritten reflection; the hidden face leaves the tab order, and pointer tilt never replaces keyboard operation.

### Achievement Card and Window

The achievement window carries metal rails and localized filigree around equal evidence tiles. Each 6px-radius tile uses a framed topline, an instrument or static artwork, metric-first copy, inset metal edges, and a restrained foil response; reduced data and render failure keep the static artwork.

### Project Stamp

Projects appear as light paper stamps inside one 10px-radius instrument. Perforated edges, issuer label, central mark, project name, field, language, and year make each stamp self-contained; hover lifts the paper, while selection returns it to the page with a brass inset.

### Language Switch

The 4px-radius segmented switch uses native-script labels and a subtle tinted active cell. It remains horizontally scrollable when needed, exposes focus visibly, and updates a single adjacent language state rather than duplicating panels.

### Certification Seal and Press

Round seals sit in a bounded press beside one detail surface. Hover and focus raise a seal; the active seal gains an accent trace and updates the adjacent credential details. On narrow screens the seals become a horizontal strip above the details.

### Closing Review Path

The unframed closing band bridges credentials directly to the footer at the 72rem measure. A Danviska heading introduces four existing factual destinations—Résumé, Field notes, LinkedIn, and Email—in a two-column ruled navigation that becomes one column below 700px. Links use Kiona labels, Recursive supporting copy, Burnished Brass arrows, and explicit inset focus; the Email route uses the universal mail client without implying availability.

### Sticky Note

The Note Gold square is intentionally personal: Caveat Note handwriting, a slight rotation, paper shadow, and a two-sided turn interaction distinguish it from formal evidence. Drag and throw are optional pointer enhancements; click, Enter, and Space always turn it.

### Named Rules

**The Handled Evidence Rule.** Interaction should feel like inspecting, turning, selecting, or lifting a specific object; never substitute generic floating containers for the implemented material behavior.

## Do's and Don'ts

### Do:

- Do keep Burnished Brass scarce and attach it to focus, selection, evidence, or calibrated emphasis.
- Do preserve the 72rem measure and let signature objects break it only when their interaction requires room.
- Do give every hover or motion behavior an equivalent keyboard state and a complete static fallback.
- Do keep photographs, drawings, fonts, and other identity assets credited according to their provenance.
- Do treat controls, chapters, stamps, seals, and notes as handled evidence objects with material-specific behavior.

### Don't:

- Don't turn component-local steel, paper, note, or vine colors into competing global themes.
- Don't replace fixed utilitarian navigation with decorative portfolio chrome.
- Don't flatten materially distinct surfaces into one generic container treatment.
- Don't import a separate content-world metaphor; keep the visual language grounded in instruments and handled evidence objects.
- Don't make ambient video, 3D instruments, pointer tilt, or scroll effects prerequisites for understanding or operation.
