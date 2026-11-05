---
name: Monochrome Minimalist
colors:
  surface: '#fcf9f5'
  surface-dim: '#dcdad6'
  surface-bright: '#fcf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ef'
  surface-container: '#f0ede9'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e5e2de'
  on-surface: '#1c1c1a'
  on-surface-variant: '#444748'
  inverse-surface: '#31302e'
  inverse-on-surface: '#f3f0ec'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c9c6c5'
  secondary: '#5e5e5c'
  on-secondary: '#ffffff'
  secondary-container: '#e1dfdc'
  on-secondary-container: '#636360'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a1c1b'
  on-tertiary-container: '#838482'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e4e2df'
  secondary-fixed-dim: '#c8c6c3'
  on-secondary-fixed: '#1b1c1a'
  on-secondary-fixed-variant: '#474745'
  tertiary-fixed: '#e2e2e0'
  tertiary-fixed-dim: '#c6c7c5'
  on-tertiary-fixed: '#1a1c1b'
  on-tertiary-fixed-variant: '#454746'
  background: '#fcf9f5'
  on-background: '#1c1c1a'
  surface-variant: '#e5e2de'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 3.25rem
    fontWeight: '600'
    lineHeight: 3.75rem
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.625rem
    fontWeight: '600'
    lineHeight: 2.125rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.375rem
    fontWeight: '600'
    lineHeight: 1.875rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.625rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1.0625rem
    fontWeight: '400'
    lineHeight: 1.75rem
    letterSpacing: -0.011em
  body-md:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: -0.008em
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.01em
  code-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: -0.005em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.5rem
  space-xl: 2.25rem
  space-2xl: 3.5rem
---

## Brand & Style

This design system delivers an editorial, whisper-quiet interface inspired by cutting-edge conversational AI platforms and contemporary typographic minimalism. The visual thesis rests on stark contrast, extreme clarity, and zero ornamental noise.

- **Brand Personality**: Intellectual, focused, razor-sharp, and distraction-free. The interface recedes entirely to let user thought, generated output, and code take absolute precedence.
- **Target Audience**: Researchers, engineers, designers, and knowledge workers demanding speed, legibility, and high-density visual comfort during extended deep-work sessions.
- **Design Style**: High-end Monochromatic Editorial Minimalism. It balances stark #ffffff canvases, tactile bone-white surface layers, hairline boundaries, and deep carbon accents with pill-shaped control ergonomics.

## Colors

The palette operates on a rigorous monochrome spectrum inflected with faint warm stone/bone undertones, eliminating sterile digital blue-gray cast:

- **Primary Canvas**: Pure Stark White (`#ffffff`) serves as the base layer for conversational streams, reading views, and primary inputs.
- **Secondary Surfaces & Containers**: Bone Chalk (`#f9f9f8`) and Soft Paper (`#f4f4f2`) provide tonal separation for sidebars, persistent panels, message bubbles, and hover states without introducing hue distraction.
- **Borders & Dividers**: Crisp hairlines (`#ecece9` and `#e5e5e3`) delineate boundaries with surgical precision.
- **Text & Foreground Hierarchy**:
  - Primary text: Deep Obsidian (`#0d0d0d`) for maximum typographic sharpness.
  - Secondary text: Soft Charcoal (`#565654`) for secondary metadata, timestamps, and active state indicators.
  - Tertiary/Muted text: Warm Stone (`#8c8b88`) for placeholders, keyboard hints, and disabled labels.
- **Accents**: Interactive primary controls utilize inverse Obsidian (`#0d0d0d`) with white text, or pure outline treatments.

## Typography

Typography pairs geometric structure with high-legibility utilitarian prose:

- **Plus Jakarta Sans** guides headings, titles, and section anchors. It provides human warmth through gentle round terminals while maintaining architectural precision via tight negative letter spacing.
- **Inter** renders all running text, chat sequences, interface states, and data lists. It eliminates rendering quirks across dense copy with optical balance and uniform vertical metrics.
- Keep headlines tight with optical negative tracking (`-0.015em` to `-0.03em`). Body text maintains deliberate line height ratios (`1.6` to `1.65`) to enable fatigue-free reading across sprawling message threads.

## Layout & Spacing

The layout model pairs a structured single-column narrative thread with collapsible sidebars and floating command decks:

- **Grid Model**: A centered, maximum-width content stream (`48rem` to `52rem`) ensures reading cadence matches physical printed essays and chat streams. Outer layout regions employ a collapsible 12-column fluid grid for tool trays, project indices, and auxiliary artifacts.
- **Breakpoints**:
  - `Mobile` (< 640px): Full-bleed layout, single primary stack, bottom-pinned chat composer, slide-over navigation drawers, `margin: 1rem`.
  - `Tablet` (640px – 1024px): 8-column canvas, permanent icon rails, centered content thread, `margin: 2rem`.
  - `Desktop` (> 1024px): 12-column canvas, dual structural panels (collapsible historical rail at `16rem`, central thread at `48rem`, auxiliary artifact inspector at `24rem`), `margin: 3rem`.
- **Rhythm**: Spacing follows strict structural scales based on a 4px/8px baseline rhythm. Whitespace is generous between conversational pairs and concise within compact component shells.

## Elevation & Depth

Visual hierarchy uses tonal surface layering and razor-thin outlines rather than heavy dropshadows:

- **Structural Outlines**: Panels, dialogue cards, and popovers rely on high-definition 1px ghost borders (`#ecece9` against `#ffffff`, `#e5e5e3` against `#f9f9f8`).
- **Tonal Stacking**:
  - Base Floor: `#ffffff`
  - Recessed/Grouped Canvas: `#f9f9f8`
  - Floating Panels/Prompts: `#ffffff` resting over `#f9f9f8` separated by a 1px `#ecece9` stroke.
- **Ambient Shadow System**: Used sparingly on floating command palettes, popovers, and sticky prompt inputs:
  - *Resting Card*: No shadow. 1px border only.
  - *Floating Dialog / Popover*: `0 8px 30px rgba(13, 13, 13, 0.04), 0 1px 3px rgba(13, 13, 13, 0.02)` bordered with `rgba(13, 13, 13, 0.08)`.
  - *Active Chat Dock*: `0 12px 36px rgba(13, 13, 13, 0.06), 0 2px 6px rgba(13, 13, 13, 0.03)`.

## Shapes

The design system implements a dynamic hybrid geometry: full-radius pill silhouettes for all human actions, balanced against structured geometric cards for data enclosures:

- **Pill Philosophy (Level 3)**: Interactive triggers, action pills, model toggles, filter chips, prompt prompts, and search inputs utilize roundedness scale 3 (`border-radius: 9999px` / full pill). This introduces immediate tactile affordance and friendliness.
- **Container Radii**: Floating contextual modals, message panels, and code blocks adopt a softened `1.25rem` to `1.5rem` radius to maintain container structure without visual harshness.

## Components

### Buttons
- **Primary Pill**: Pure obsidian background (`#0d0d0d`), stark white text (`#ffffff`), 9999px radius, padding `0.5rem 1.25rem`. Hover triggers subtle opacity drop (`#262626`).
- **Secondary Pill**: Stark white background (`#ffffff`), hairline border `1px solid #e5e5e3`, obsidian text (`#0d0d0d`). Hover shifts background to `#f4f4f2`.
- **Ghost Pill**: Transparent background, text `#565654`, padding `0.5rem 1rem`. Hover activates `#f9f9f8` background and `#0d0d0d` text.
- **Icon Action Buttons**: Circular pill (`36px x 36px`), centered iconography, borderless in rest state, gaining `#f4f4f2` on hover.

### Input Fields & Prompt Composer
- **Dynamic Prompt Dock**: Floating rounded card (`1.5rem` radius), `#ffffff` background with `1px solid #e5e5e3` stroke, elevated ambient drop shadow. Contains auto-expanding textarea, pill-shaped tool selectors, and an obsidian circular submit trigger.
- **Standard Input**: Full pill geometry, `1px solid #e5e5e3`, background `#ffffff`, padded `0.625rem 1rem`. Active focus shifts stroke to `#0d0d0d` without color rings.

### Chips & Filter Tags
- Fully rounded pills (`border-radius: 9999px`), background `#f9f9f8`, border `1px solid #ecece9`, typography `label-sm` (`#565654`).
- Active state transitions background to `#0d0d0d`, text to `#ffffff`, and border to `#0d0d0d`.

### Cards & Thread Containers
- **System/Assistant Bubble**: Neutral borderless bone-tinted container (`#f9f9f8`) or naked canvas (`#ffffff`) with subtle left demarcation.
- **Artifact Preview Card**: Pure white background, `1px solid #e5e5e3`, rounded `1rem`, interior padded with `space-lg`, header isolated via hairline horizontal rule `#f4f4f2`.

### Checkboxes & Radio Controls
- **Radio Buttons**: Dual concentric rings in `#0d0d0d` upon selection; inactive border in `#c7c6c2`.
- **Checkboxes**: Squared with soft `4px` radius, unfilled `1.5px solid #c7c6c2` resting state, fill transitions to `#0d0d0d` with crisp `#ffffff` check icon when checked.

### Lists & Navigation Rails
- Sidebar items render with `border-radius: 9999px` or soft `0.5rem` items, padding `0.5rem 0.75rem`, text `#565654`. Active item displays `#f4f4f2` background with `#0d0d0d` medium weight text.