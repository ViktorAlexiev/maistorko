---
name: Майсторко
description: A catalog of craftsmen measured like a job. Every craftsman carries a folding rule of the next 14 days.
colors:
  rule-yellow: "#f2c200"
  rule-yellow-deep: "#dcae00"
  rule-yellow-soft: "#fbeaa6"
  ink: "#16140f"
  ink-secondary: "#47433a"
  ink-tertiary: "#686356"
  free-ink-green: "#2f6b4f"
  free-green-soft: "#d9eadf"
  today-red: "#c8221a"
  hinge-brass: "#a8843a"
  concrete-paper: "#f3f2ed"
  card-surface: "#fffdf8"
  panel-surface: "#e9e7e0"
  hairline: "#d8d5cb"
  hairline-strong: "#b4afa1"
  graphite: "#1d1b17"
  danger: "#b42318"
  danger-soft: "#fbe4e1"
typography:
  display:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, sans-serif"
    fontSize: "clamp(3.4rem, 11vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 0.92
  numerals:
    fontFamily: "Sofia Sans Extra Condensed, Sofia Sans, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "\"tnum\" 1, \"lnum\" 1"
  title:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 700
    lineHeight: 1.3
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  sheet: "14px"
  pill: "999px"
spacing:
  gutter: "16px"
  gutter-sm: "24px"
  stack: "12px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#34302a"
  button-rule:
    backgroundColor: "{colors.rule-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "44px"
  button-rule-hover:
    backgroundColor: "{colors.rule-yellow-deep}"
  button-outline:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "46px"
  chip:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
  card:
    backgroundColor: "{colors.card-surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Майсторко

## Overview

**Creative North Star: "The Folding Rule"**

Майсторко is drawn from the yellow wooden folding carpenter's rule (сгъваем метър) that lives in every Bulgarian craftsman's back pocket. The product answers three questions, *who can, how much, when free*, and the rule answers the third one visually: every craftsman carries a graduated strip of the next 14 days, hinged at seven, with free days inked green and busy days left bare yellow. Time is measured like a job.

The world is enamel yellow and printed ink on a neutral concrete-paper ground. Yellow is not an accent sprinkled on buttons. It owns whole fields: the search band, every availability rule, and the "Майстор ли си?" band. Everything else stays quiet (ink type, hairline dividers, warm off-white cards), so the rule is always the loudest object on the page. Type is Bulgarian-designed Sofia Sans. Its extra-condensed cut carries headlines and every number (dates, prices, counts), the way numerals are printed on a rule.

The interface is practical, legible for older and less tech-savvy craftsmen, and phone-first, with 44px or larger tap targets and one-thumb calendar actions. It refuses the category default of a white marketplace with a blue search hero and photo-card carousels.

**Key Characteristics:**
- A 14-day folding rule on every craftsman (catalog rows, profile, dashboard, calendar editor).
- Yellow is a field, not an accent. Red is reserved for "today" and the date marker.
- Extra-condensed numerals for dates and prices; Sofia Sans for everything else.
- Hairline-ruled lists and indexes instead of card grids.
- Flat surfaces with ambient shadows only on hover and overlays.

## Colors

A two-material palette, enamel yellow and printed ink, with one functional green for availability and red used as a measuring mark.

### Primary
- **Enamel Rule Yellow** (#f2c200): the rule strips, the search band, the craftsman band, the secondary "rule" button and text selection. Always paired with ink text (contrast about 12:1). Deep Rule Yellow (#dcae00) is its hover state. Pale Rule Yellow (#fbeaa6) marks soft notices and hover rows.

### Secondary
- **Free-Day Ink Green** (#2f6b4f): availability only. Inked bars on free days, hatched on partial days, "Свободен днес" labels and success messages. Soft Free Green (#d9eadf) is the success-message ground.

### Tertiary
- **Today Red** (#c8221a): the numeral of today on every rule, the sliding date marker in search, the active-tab tick and the unread badge. Nothing else.
- **Hinge Brass** (#a8843a): the rivet dot at each seven-day fold of the rule, and one monogram colour.

### Neutral
- **Concrete Paper** (#f3f2ed): the page ground. A neutral, very slightly warm grey. Cream is deliberately refused.
- **Card Surface** (#fffdf8): rows, panels, inputs and the category index band.
- **Panel Surface** (#e9e7e0): skeletons, quiet info rows and past or disabled calendar days.
- **Ink** (#16140f): all primary text, graduations, primary buttons and chat bubbles you sent. Ink Secondary (#47433a) for body copy. Ink Tertiary (#686356) for hints and meta (at least 4.5:1 on paper).
- **Hairline** (#d8d5cb) and **Hairline Strong** (#b4afa1): dividers, card borders and field strokes.
- **Graphite** (#1d1b17): the footer and the chat composer panel; the only dark fields.
- **Danger** (#b42318) and **Danger Soft** (#fbe4e1): errors, destructive actions and ban notices.

### Named Rules
**The Yellow Field Rule.** Yellow owns whole regions (a band, a strip, a rule), never a scatter of small accents. If yellow appears as a thin decoration, it should be ink instead.

**The Measuring Mark Rule.** Red marks position in time ("today", the chosen date, the active tab), never emphasis or error. Errors use Danger, which is a separate token.

**The Green Means Free Rule.** Green appears only when it says someone is available, or when an action succeeded.

## Typography

**Display Font:** Sofia Sans Extra Condensed (with Sofia Sans, sans-serif)
**Body Font:** Sofia Sans (with system-ui, sans-serif)

**Character:** A Bulgarian foundry's family with native Bulgarian Cyrillic forms (`lang="bg"`). The extra-condensed cut reads like numbers printed on a rule, and the regular cut is a sturdy, friendly workhorse.

### Hierarchy
- **Display** (900, clamp(3.4rem, 11vw, 6rem), 0.92): the home headline only ("Кой майстор е свободен в сряда?").
- **Headline** (800, 3–3.75rem, 0.92): page and section titles.
- **Numerals** (800, 1.05rem on small rules up to 5.5rem for the profile price, tabular lining figures): every price, date on a rule and count.
- **Title** (800, 1.125rem): craftsman names, list item titles and card headings.
- **Body** (400, 1rem/1.5): copy. Long text is capped at 68ch.
- **Label** (700, 0.9rem): form labels and filter legends. Hints are 0.85rem in Ink Tertiary.

### Named Rules
**The Printed Numeral Rule.** Any number a client compares (price, date, rating, count) is set in the condensed numerals style, never in body weight.

**The No Kicker Rule.** Headings speak for themselves: no eyebrows or small tracked labels above them.

## Layout

Content sits in a 1280px max-width container with 16px side gutters (24px from 640px up). The page rhythm alternates a dense band with a quiet one: hero, then a hairline category index on the card surface, then a sparse "how it works" row on a rule line, then the yellow craftsman band.

The catalog is a 288px sticky filter column beside a single column of full-width rows. It is not a card grid. Below 1024px the filters move into a bottom sheet behind a "Филтри" button. Dashboards use a 224px left navigation rail that turns into a horizontally scrolling tab row on phones.

Grid children may shrink below their content (`min-width: 0`). Wide rules scroll inside their own container and never widen the page. On phones the craftsman row stacks price under name, so the name never truncates.

**The One Graduation Rule.** One day is the same visual unit everywhere: one rule cell with a long tick at its left, a half tick in the middle, the numeral, then an ink bar for free or a hatched bar for partial.

## Elevation & Depth

The system is flat and tonal. Depth comes from paper, card surface and hairlines. Shadows are ambient and appear only as a response: rows lift on hover, and menus, dialogs and the sticky save bar float.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgb(22 20 15 / 0.08), 0 1px 1px rgb(22 20 15 / 0.04)`): barely there; rarely used.
- **Lift** (`box-shadow: 0 6px 16px -6px rgb(22 20 15 / 0.18), 0 2px 4px rgb(22 20 15 / 0.06)`): hovered catalog rows and the search band.
- **Float** (`box-shadow: 0 24px 48px -16px rgb(22 20 15 / 0.28), 0 4px 10px rgb(22 20 15 / 0.08)`): menus, sheets and sticky action bars.

**The No Block Shadow Rule.** Shadows always have blur and offset. Hard offset shadows are not part of this world.

## Shapes

Corners are square-ish, like cut timber: 6px (md) on buttons, fields and rule ends, and 10px (lg) on rows, panels and cards. Chips are the only fully round shape. Sheets use 14px top corners on phones. Rules have a 1px inset ink outline, and each seven-day segment is joined by a brass rivet at the fold. Dividers are 1px hairlines; a 1.5px ink rule opens important lists and tables.

## Components

### Folding Rule (signature)
- **Anatomy:** a yellow strip of 14 day cells, split into two seven-day segments hinged by a brass rivet. Each cell has graduation ticks, a condensed day numeral (today in red), an optional weekday letter, and a bottom bar: solid green for free, green hatching for partial, nothing for busy.
- **Sizes:** sm (44px, catalog), md (56px, calendar editor) and lg (76px, profile).
- **Motion:** on the profile it unfolds on first paint. The first segment slides in (520ms), then the second swings open on its hinge from rotateY(-72deg) (640ms, hinge ease). It is pure CSS, so content is never hidden without it. With reduced motion it is flat.
- **Interactive variant:** each day is a button. Selecting one draws a red inset ring and attaches the date to the chat composer.

### Search Band
The yellow field with fields for "what", "city" and "Търси", and a 14-day rule along its lower edge used as the date picker. A red marker (a triangle plus a bottom bar) slides to the chosen day (480ms, ease-out).

### Buttons
- **Shape:** 6px corners, at least 44px tall (36px for small, 52px for large).
- **Primary:** ink with white text; hover #34302a; presses down 1px.
- **Rule:** yellow with ink text and a 2px inner bottom shade. Used on dark fields and the chat composer.
- **Outline:** card surface with a strong hairline that turns to ink on hover. **Ghost:** transparent with a 6% ink wash on hover.
- **Danger:** card surface, danger text, danger-soft on hover.

### Chips
- **Style:** pill, card surface, strong hairline, 40px tall, semibold.
- **State:** selected chips turn solid ink with white text (`aria-pressed`). Used for filters, time-of-day slots and schedule blocks.

### Cards / Rows
- **Corner Style:** 10px.
- **Background:** card surface with a hairline border. Hover moves the border toward ink and adds the Lift shadow.
- **Internal Padding:** 16px (20px from 640px).

### Inputs / Fields
- **Style:** 46px, card surface, strong hairline, 6px corners, 16px or larger text (so iOS never zooms).
- **Focus:** the border turns ink with a 3px yellow glow (`rgb(242 194 0 / 0.6)`).
- **Error / Disabled:** a danger border with a message below; disabled fields use the panel surface.

### Navigation
A sticky translucent paper header with the rule-mark logo and ghost links. On phones the menu is a bottom sheet. Dashboard navigation is a left ink rail with a red active tick.

### Chat
Your own bubbles are ink with white text and a 4px tail corner. The other side's bubbles are card surface with a hairline. An attached date renders as a yellow chip inside the bubble. The composer bar sits in a card-surface footer.

## Do's and Don'ts

### Do:
- **Do** show the 14-day rule wherever a craftsman appears in a list.
- **Do** set prices and dates in the condensed numerals style (tabular).
- **Do** give yellow whole regions: bands, strips and fields.
- **Do** keep tap targets at 44px or more and calendar actions reachable with one thumb.
- **Do** label demo imagery "Демо изображение" until real photos exist.

### Don't:
- **Don't** use red for emphasis or errors. Red marks time only.
- **Don't** build card grids of icon, heading and text. Use ruled lists and indexes.
- **Don't** put eyebrows or kickers above headings.
- **Don't** use a cream ground or a serif display. The ground is concrete paper, and the voice is Sofia Sans.
- **Don't** use hard offset shadows, gradients as decoration, or glassmorphism.
