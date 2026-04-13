# dp-ring DESIGN.md

## Product Character

dp-ring is an operator console for orchestrating agent-driven delivery loops.

The UI should feel:

- quiet
- exact
- technical
- audit-friendly
- dense without feeling cramped

This is not a marketing site, a playful SaaS dashboard, or a consumer app.

## Visual Direction

Primary reference blend:

- Vercel: restrained chrome, neutral precision
- Linear: dense operational surfaces, crisp status handling
- Mintlify: readable detail views and calm documentation rhythm

The result should be:

- mostly neutral
- low decoration
- one controlled accent color
- strong hierarchy through spacing and typography

Avoid warm lifestyle gradients and colorful card-by-card styling.

## Color

Use a neutral light theme.

- App background: cool gray
- Panels: near-white
- Borders: visible but quiet
- Text: deep gray
- Muted text: medium gray
- Accent: one cool blue for links, selected states, and primary focus
- Success / warning / danger: functional only

Do not use orange as the leading brand color.

## Typography

Use direct UI typography.

- Headings: sans-serif, medium or semibold
- Body: sans-serif
- Data, ids, paths, and code: monospace

Rules:

- no decorative serif headlines
- no oversized marketing copy
- no explanatory paragraphs unless necessary
- prefer labels over subtitles

## Layout

The product uses a fixed operator shell:

- persistent left rail
- main content pane
- stacked full-width modules in content

Rules:

- prefer vertical flow over side-by-side promo compositions
- reserve split layouts for truly parallel data
- summary comes before detail
- detail comes before related records

## Component Rules

### Navigation

- compact
- text-first
- active state uses contrast and border, not motion tricks
- no descriptive blurbs under every nav item

### Panels

- low radius
- thin border
- subtle shadow
- compact padding

Each panel should answer one question.

### Tables

- tables are primary UI, not fallback UI
- crisp header row
- compact vertical rhythm
- actions stay short

### Buttons

- primary: dark solid
- secondary: outlined
- ghost: minimal
- labels should usually be one word

### Status

- status is visual first
- use pills and tone
- do not repeat status text around a badge unless necessary

### Forms

- operational, not conversational
- short labels
- minimal helper text
- placeholder text should be examples, not instructions

## Content Rules

Bias every page toward:

- labels
- values
- tables
- timelines
- logs
- links

Avoid:

- "what this page does" prose
- repeated section introductions
- tutorial microcopy
- empty-state essays

Empty states should usually be 1-3 words.

## Dashboard

Dashboard is a live summary, not an introduction.

Show:

- counts
- recent sessions
- service health

Do not explain the platform here.

## Dispatcher

Dispatcher is the control plane.

It should feel:

- dense
- structured
- protocol-aware
- state-machine oriented

Favor tables, matrices, compact summaries, and runtime state.

## Detail Pages

Use this order:

1. object name + status + actions
2. compact summary facts
3. execution-specific data
4. related records

Good section titles:

- Summary
- Execution
- Acceptance
- Workflow
- Context
- Links
- Scores

## Motion

Motion should be rare and functional.

- subtle hover feedback
- subtle selected states
- no floating animations
- no celebratory effects

## Hard No

Do not introduce:

- hero-marketing layouts
- warm glossy gradients
- glass-heavy cards
- decorative illustrations
- long explanatory subtitles
- multiple competing accent colors
- whimsical copy
