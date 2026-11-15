# Lessons from executed plans

## 2026-11-14 · Основа на таблото (2026-11-12-osnova-na-tabloto)

- Small status marks (unread counts, unsaved and unread dots) were never put through the variant round, and the owner rejected them at acceptance: include every indicator a piece shows in its approved design.
- Acceptance criteria named demo accounts by a property ("free plan") that had changed by execution time: give each such account a query that proves the property, and re-run it at intake.
- An approved element moved when the page was split across a server and a client component (the „Нова поръчка“ button left the header row): task notes should say where each approved element lands when the prototype's single tree is split.

## 2026-11-15 · Цени (2026-11-14-tseni)

- The query that proved the free-plan account read only `craftsman_subscriptions`, but the app decides the plan with `craftsman_plan()` (company membership counts), so `ivan-dimitrov` was on the company plan: proof queries must call the same function the app uses.
- A task made every box save also write the craftsman's terms, which exposed a bug already on `main` (an ambiguous `cities` embed loaded the terms empty and the save wiped them); it only surfaced at browser evidence: when a save starts writing fields it did not write before, add a criterion that their existing values survive a save and a reload.
- The plan dropped a database function another developer had added, without saying why, and the owner had to ask: list every object a plan drops, with who added it and why nothing needs it.

## 2026-11-15 · Сетъп след регистрация (2026-11-14-setap)

- An acceptance criterion had the new craftsman save a bio on „Профил“ before choosing categories, but that form already refused to save without a category, so the criterion could not run as written: before writing a criterion that goes through an existing form, check that form's validation rules.
- The same rule meant the whole profile form, not only its categories part, was blocked for craftsmen who skipped „Какво работиш“, and the owner found it at acceptance: when a new flow lets people skip a step, check every existing form that validates the skipped data.
- The plan's sentence for 3 of 3 required steps ("Профилът ти се вижда в търсенето") ignored profiles an admin had hidden, which goes against Part 1's rule to say whether the profile is listed: base every "you are visible" message on the same check search uses (`craftsman_is_listed`), not on counting steps.
