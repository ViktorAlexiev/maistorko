---
name: Майсторлъка
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
  graphite-deep: "#141210"
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

# Design System: Майсторлъка

## Overview

**Creative North Star: "The Folding Rule"**

Майсторлъка is drawn from the yellow wooden folding carpenter's rule (сгъваем метър) that lives in every Bulgarian craftsman's back pocket. The product answers three questions, *who can, how much, when free*, and the rule answers the third one visually: every craftsman carries a graduated strip of the next 14 days, hinged at seven, with free days inked green and busy days left bare yellow. Time is measured like a job.

The world is enamel yellow and printed ink on a neutral concrete-paper ground. Yellow is not an accent sprinkled on buttons. It owns whole fields: the search band, every availability rule, and the "Майстор ли си?" band. Everything else stays quiet (ink type, warm off-white strips and space instead of dividing lines), so the rule is always the loudest object on the page. Type is Bulgarian-designed Sofia Sans. Its extra-condensed cut carries headlines and every number (dates, prices, counts), the way numerals are printed on a rule.

The interface is practical, legible for older and less tech-savvy craftsmen, and phone-first, with 44px or larger tap targets and one-thumb calendar actions. It refuses the category default of a white marketplace with a blue search hero and photo-card carousels.

**Key Characteristics:**
- A 14-day folding rule on every craftsman (catalog rows, profile, dashboard, calendar editor).
- Yellow is a field, not an accent. Red is reserved for "today", the date marker and unread marks.
- Extra-condensed numerals for dates and prices; Sofia Sans for everything else.
- Lists of separate strips and indexes instead of card grids. Nothing is divided by hairlines.
- Flat surfaces with ambient shadows only on hover and overlays.

## Colors

A two-material palette, enamel yellow and printed ink, with one functional green for availability and red used as a measuring mark.

### Primary
- **Enamel Rule Yellow** (#f2c200): the rule strips, the search band, the craftsman band, the secondary "rule" button and text selection. Always paired with ink text (contrast about 12:1). Deep Rule Yellow (#dcae00) is its hover state. Pale Rule Yellow (#fbeaa6) marks soft notices and hover rows.

### Secondary
- **Free-Day Ink Green** (#2f6b4f): availability only. Inked bars on free days, hatched on partial days, "Свободен днес" labels and success messages. Soft Free Green (#d9eadf) is the success-message ground.

### Tertiary
- **Today Red** (#c8221a): the numeral of today on every rule, the sliding date marker in search and the unread badge. Nothing else.
- **Hinge Brass** (#a8843a): the rivet dot at each seven-day fold of the rule, and one monogram colour.

### Neutral
- **Concrete Paper** (#f3f2ed): the page ground. A neutral, very slightly warm grey. Cream is deliberately refused.
- **Card Surface** (#fffdf8): rows, panels, inputs and the category index band.
- **Panel Surface** (#e9e7e0): skeletons, quiet info rows and past or disabled calendar days.
- **Ink** (#16140f): all primary text, graduations, primary buttons and chat bubbles you sent. Ink Secondary (#47433a) for body copy. Ink Tertiary (#686356) for hints and meta (at least 4.5:1 on paper).
- **Hairline** (#d8d5cb) and **Hairline Strong** (#b4afa1): strokes of fields, chips and outline buttons only. They never divide content (see The No Hairline Rule).
- **Graphite** (#1d1b17): the footer and the photo viewer; the only dark fields.
- **Graphite Deep** (#141210): the copyright strip at the foot of the footer, across the full width.
- **Danger** (#b42318) and **Danger Soft** (#fbe4e1): errors, destructive actions and ban notices.

### Named Rules
**The Yellow Field Rule.** Yellow owns whole regions (a band, a strip, a rule), never a scatter of small accents. If yellow appears as a thin decoration, it should be ink instead.

**The Measuring Mark Rule.** Red marks position in time ("today", the chosen date), never emphasis or error. The one other use is unread: the red rivet and the red count on the site header bell (The Tab and Rivet Rule). Errors use Danger, which is a separate token.

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

The catalog is a 288px sticky filter column beside a single column of full-width rows. It is not a card grid. Below 1024px the filters move into a bottom sheet behind a "Филтри" button. Dashboards use a 224px left index (see Navigation) that turns into a bottom bar on phones.

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

Corners are square-ish, like cut timber: 6px (md) on buttons, fields, rule ends and list rows, and 10px (lg) on panels and boxes. Chips are the only fully round shape. Sheets use 14px top corners on phones. Rules have a 1px inset ink outline, and each seven-day segment is joined by a brass rivet at the fold. Nothing is divided by lines: rows are strips with 6px corners and 4px between them, and boxes are 10px fields (see Separation).

## Components

### Folding Rule (signature)
- **Anatomy:** a yellow strip of 14 day cells, split into two seven-day segments hinged by a brass rivet. Each cell has graduation ticks, a condensed day numeral (today in red), an optional two-letter weekday (ПН to НД), and a bottom bar: solid green for free, green hatching for partial, nothing for busy. The very first cell, where the strip's corner is rounded, has no long tick.
- **Sizes:** sm (44px, catalog), md (56px, calendar editor) and lg (76px, profile).
- **Motion:** on the profile it unfolds on first paint. The first segment slides in (520ms), then the second swings open on its hinge from rotateY(-72deg) (640ms, hinge ease). It is pure CSS, so content is never hidden without it. With reduced motion it is flat.
- **Interactive variant:** each day is a button. Selecting one draws a red inset ring and attaches the date to the chat composer.
- **Month form:** on „Календар“ the month is the rule folded into five seven-day segments stacked on top of each other, with brass rivets at alternating ends. Busy and rest days stay bare yellow with a dimmed numeral. A busy period is an ink tape with yellow letters across its days. Today has the red marker triangle and a red numeral.

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
- **Corner Style:** 6px for rows, 10px for boxes.
- **Background:** rows are strips (card surface, 6px corners, 4px apart, no border); boxes follow The Yellow Band Rule. Hover adds the Lift shadow.
- **Internal Padding:** 16px (20px from 640px).

### Inputs / Fields
- **Style:** 46px, card surface, strong hairline, 6px corners, 16px or larger text (so iOS never zooms).
- **Focus:** the border turns ink with a 3px yellow glow (`rgb(242 194 0 / 0.6)`).
- **Error / Disabled:** a danger border with a message below; disabled fields use the panel surface.

### Navigation
A sticky solid card-surface header (#fffdf8) with the rule-mark logo and ghost links: no bottom line, no translucency, no blur. Its dropdowns have no border, only the large shadow, and their rows are strips. On phones the menu is a bottom sheet. Dashboard navigation is the Index: a list in the condensed display face (1.7rem), other pages in Ink Tertiary and the current one on a yellow field with 4px corners, groups split by space only; unread messages are an ink tab with yellow numerals beside „Съобщения“. On phones it becomes a bottom bar of words (the current one on a yellow field), and „Още“ opens a bottom sheet with the rest.

### Chat
Your own bubbles are ink with white text and a 4px tail corner. On the „Съобщения“ page the conversation lies on Panel Surface (`bg-surface`) and the other side's bubbles and the cards are Paper (`bg-paper`); in the profile chat window the messages lie on Paper and the other side's bubbles and cards are Panel Surface; no hairline. An attached date renders as a yellow chip inside the bubble. The composer bar sits in a card-surface footer.

### Separation (no lines)
**The No Hairline Rule.** Nothing on a page is divided by a line: no hairline between rows, no ink rule above a list or under a heading, no border around a box. Space, a strip or a field does that job. Fields, chips, buttons and the role cards of the sign-up form keep their strokes, because they are controls, not dividers.

**The Strip Rule.** Each row of a list is its own strip: Card Surface, 6px corners, 4px between strips. A checked row is Pale Rule Yellow, a row disabled by a limit is Panel Surface with Ink Tertiary text, and a cancelled job is Panel Surface. Inside a dialog or a bottom sheet the strips are Concrete Paper. A row that opens shows its content inside the same strip.

**The Group Name Rule.** The name of a group above a list is set in the condensed display face at 1.7rem, 0.5rem above its strips, with 1.75rem between groups. Inside a part that has its own heading, the group name is 1.45rem. Headings of the parts of a page are display text-3xl or text-4xl, with no line under them and 2.5rem between parts.

**The Yellow Band Rule.** A box is a Card Surface field with 10px corners and a yellow band across its top (Enamel Rule Yellow, 20px by 10px padding) that holds the box title in the display face (text-3xl) and its close button. The quiet part inside the box is one step back (Concrete Paper, 8px corners), and a total row inside it is Card Surface again (6px). A box without a title is only the quiet field. A field that asks for attention is Pale Rule Yellow with 10px corners, and its rows are Card Surface strips.

**The Light Bar Rule.** The site header is a solid Card Surface bar over the paper ground: no bottom line, no translucency, no blur, no shadow. The footer has no line above the copyright; the copyright row sits on a full-width Graphite Deep strip. Dropdowns from the header have no border, only the large shadow.

**The Tab and Rivet Rule.** A count beside a word (unread messages, new items) is an ink tab with yellow numerals: Ink background, Enamel Rule Yellow numerals in the condensed numerals style, 4px corners, about 24px high, set inline after the word. On the phone bottom bar the tab is smaller and sits at the word's top-right corner with a Card Surface ring. Above 99 it reads „99+“. Red counts appear only on the site header bell (see below). A status mark without a number is a rivet, like the hinge rivet of the folding rule: a round mark with an inset ink ring. The visit marks on „Календар“ are three: „потвърдено“ is a filled ink rivet, „чака отговор“ an open ink ring, and „поръчка“ an ink square. Unsaved changes are a 10px Hinge Brass rivet at the top-right corner of the word, positioned out of the layout so nothing moves when it appears. An unread row (a list, „Преглед“, the bell's list) is marked by a 10px red rivet with a 1.5px dark inner ring, at the right of the row and without a number. „Съобщения“ in the site header carries the same red rivet, out of the layout at the top-right corner of the word (on phones, where the word is hidden, of the icon). The site header bell shows its count as a red number in a rectangular tab with 4px corners. The dashboard's left menu and bottom bar keep the ink tab with yellow numerals.

## Do's and Don'ts

### Do:
- **Do** show the 14-day rule wherever a craftsman appears in a list.
- **Do** set prices and dates in the condensed numerals style (tabular).
- **Do** give yellow whole regions: bands, strips and fields.
- **Do** keep tap targets at 44px or more and calendar actions reachable with one thumb.
- **Do** label demo imagery "Демо изображение" until real photos exist.
- **Do** mark counts with an ink tab (only the site header bell uses a red tab) and unsaved or unread states with a rivet (The Tab and Rivet Rule).

### Don't:
- **Don't** use red for emphasis or errors. Red marks time and unread only.
- **Don't** build card grids of icon, heading and text. Use strip lists and indexes.
- **Don't** divide content with hairlines, ink rules or box borders (The No Hairline Rule).
- **Don't** put eyebrows or kickers above headings.
- **Don't** use a cream ground or a serif display. The ground is concrete paper, and the voice is Sofia Sans.
- **Don't** use hard offset shadows, gradients as decoration, or glassmorphism.
