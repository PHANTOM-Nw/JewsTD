# Design QA

## Evidence

- Source visual truth: `/home/calvin/.codex/generated_images/019f5f7c-1bc9-7fc0-ba2d-8b5238223c4e/exec-4c7cd036-7842-4b8c-9363-91ba95add6d0.png`
- Supporting visual states:
  - `/home/calvin/.codex/generated_images/019f5f7c-1bc9-7fc0-ba2d-8b5238223c4e/exec-35d6c9d2-c990-4428-8d6d-bd862ab62844.png`
  - `/home/calvin/.codex/generated_images/019f5f7c-1bc9-7fc0-ba2d-8b5238223c4e/exec-8817c7a2-b849-4a20-8b3f-eeaffe579a6a.png`
- Browser-rendered implementation: `docs/records/assets/2026-07-14-mobile-q-style/implementation-opening-390x844.png`
- Same-input comparison: `docs/records/assets/2026-07-14-mobile-q-style/comparison-opening.png`
- Additional states:
  - `docs/records/assets/2026-07-14-mobile-q-style/implementation-decision-390x844.png`
  - `docs/records/assets/2026-07-14-mobile-q-style/implementation-ready-390x844.png`
  - `docs/records/assets/2026-07-14-mobile-q-style/implementation-playing-390x844.png`
  - `docs/records/assets/2026-07-14-mobile-q-style/implementation-synthesis-390x844.png`
- Responsive evidence:
  - `docs/records/assets/2026-07-14-mobile-q-style/implementation-opening-360x800.png`
  - `docs/records/assets/2026-07-14-mobile-q-style/implementation-opening-390x693-bottom.png`
- Browser metrics and interaction result: `docs/records/assets/2026-07-14-mobile-q-style/browser-report.json`
- Primary viewport: 390×844 CSS pixels, Chromium 150.0.7871.46, light theme, reduced motion
- Primary states: opening `building`, three-build `deciding`, `ready`, first-wave `playing`, and synthesis list

## Full-view comparison evidence

`comparison-opening.png` places the approved concept and the browser capture in one 820×900 image, with both game screens displayed at the same 390-pixel content width. The implementation preserves the intended sunny garden scene, cream stone 8×10 board, gold-and-cream touch UI, five resource cards, cyan route, green entrance, red exit, and large bottom action control.

The implementation intentionally shows 3 wood and `建造 0/3` instead of the concept's 5 because the 8×10 gameplay rebalance was explicitly approved after the concept was produced. It also omits exterior row/column labels so a 360-pixel phone can retain 44-pixel cells, and retains the compact game title plus sound/reset controls as working product controls.

## Focused region comparison evidence

A separate crop was not needed: the full comparison keeps both screens at 390 CSS pixels and the resource labels, board cells, route nodes and primary action copy remain readable. Important interaction regions were inspected at native resolution in the decision, playing and synthesis screenshots listed above.

## Findings

No actionable P0, P1 or P2 findings remain.

Resolved during comparison:

- [P2] Utility and upgrade touch targets were undersized in the first render.
  - Initial evidence: sound/reset controls measured 34×34 pixels and the level upgrade control used a 20-pixel circle.
  - Impact: these targets conflicted with the user's goal of reducing mobile mis-taps.
  - Fix: sound/reset controls now measure 44×44 pixels; the entire 59.8×51 level card is the upgrade target.
  - Post-fix evidence: `browser-report.json` and the recaptured opening screenshot.
- [P2] Compact and short phone layouts needed explicit reachability protection.
  - Fix: the 360-pixel breakpoint reduces only decorative board padding and preserves a 352-pixel Canvas, giving exactly 44×44 pixels per cell. Short 390×693 screens may scroll 62 pixels, after which the complete action deck is visible; horizontal overflow remains absent.
  - Post-fix evidence: the responsive metrics and screenshots in `browser-report.json`.
- [P2] Synthesis recipe descriptions were too small and light.
  - Fix: recipe copy increased from 9 to 10 pixels, line height increased, and the text color was darkened.
  - Post-fix evidence: `implementation-synthesis-390x844.png`.

## Required fidelity surfaces

- Fonts and typography: the rounded system-font stack preserves the concept's friendly heavy headings and compact labels. Headings, resource values and primary actions form a clear hierarchy; no broken wrapping or truncation is visible in the tested states.
- Spacing and layout rhythm: the board remains the dominant region, five resources stay in one row, the action deck is fully visible at 390×844 and 360×800, and short screens retain access through vertical scrolling.
- Colors and visual tokens: sky blue, garden green, cream stone, warm gold, dark brown and cyan path tokens align with the approved direction and maintain readable foreground contrast.
- Image quality and asset fidelity: generated raster assets are used for the background, tile, entrance, exit, 8 base towers, 6 special towers, 4 enemy classes and 5 obstacle variants. Sprites remain sharp at gameplay scale without visible transparency halos in the captured states.
- Copy and content: all visible build counts and obstacle consequences are configuration-driven and correctly reflect the 3-build/keep-1 rules.
- Icons and accessibility: controls use the Phosphor icon family, labeled buttons and visible focus styles. All measured interactive targets in the opening, decision and synthesis states are at least 44 pixels in both dimensions.

## Primary interactions tested

- Placed three towers on valid cells and entered the three-choice state.
- Selected one tower and confirmed that the other two became visually distinct obstacles.
- Entered the ready state and opened/closed the synthesis list from the retained tower.
- Started the first wave, observed an enemy and tower combat state, paused, and resumed.
- Checked responsive opening states at 360×800 and 390×693.
- Checked browser console and page errors: none recorded.

## Comparison history

- Pass 1: opening comparison found undersized 34-pixel utility controls and a 20-pixel upgrade control.
- Pass 2: expanded touch targets, added compact-board and short-viewport protection, then recaptured. Metrics showed 44.25-pixel cells at 390×844, 44-pixel cells at 360×800, and no horizontal overflow.
- Pass 3: increased synthesis recipe text size and contrast, recaptured all states, repeated the complete interaction flow, and reopened the final comparison. No remaining P0/P1/P2 difference was found.

## Implementation checklist

- [x] Same-input concept/implementation comparison captured.
- [x] Opening, decision, ready, playing and synthesis states captured.
- [x] 390×844, 360×800 and short 390×693 layouts checked.
- [x] Primary touch targets and Canvas cells measured.
- [x] Build, choose, start, pause, resume and synthesis-list interactions exercised.
- [x] Console and page errors checked.

## Follow-up polish

- [P3] Convert the 2 MB garden background to a mobile WebP variant when the repository adds an image optimization pipeline.

final result: passed
