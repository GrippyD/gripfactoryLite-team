# BRIEF L5: ANCHORS ON THE SHAPE, AND ANCHOR SNAP (canon 0.30.397)

For the build session (Claude Code or Cursor) opened in the worktree `branches/GFLiteOpsDashboard` (its `app/` is the app), under THE DISPATCH RULE (canon 0.30.155). Every label object gets an anchor at each of its corners, on the object as drawn (rotation included), not on a bounding box; and an anchor being dragged soft snaps to the anchors around it. Built on the worktree exactly as it stands LIVE after BRIEF L4, LABEL FORMULAS, AND INK AND FILL (the Scribe writes the tree hash into this line at the paste; if the hash on the disk differs, stop and say so). No migration expected; the layout stays `v: 1` with optional keys.

## The sources (verbatim)

The owner, 2026-10-04: "label objects should have as many anchors as corners and they should apply to the shape (ie, not their bounding box), anchors should be able to soft snap to other anchors."

L1's law 5 (canon 0.30.386), which this replaces in part: "Every object has at least one resize anchor (a corner anchor on boxes, codes, pictures and shapes; end anchors on a line)".

What the code holds today (the live tree before L4): boxes are `{ x, y, w, h, rotate }` (`src/labeleditor.ts`, `Box`), drawn with a CSS `rotate()`; one anchor at the box's bottom right corner (`.le-anchor`), so a rotated object's anchor sits off its corner; lines have two end anchors; moves and drags snap to the eighth inch (`snap()`), Shift moves freely. The triangle is drawn inside its box as `50,4 96,96 4,96`.

## The law

1. AS MANY ANCHORS AS CORNERS, ON THE SHAPE. A selected object shows an anchor at each of its corners where the corner is drawn, rotation applied:
   - Text Box, Memo, Barcode, QR, Picture, Rectangle and Rounded rectangle: four, at the four corners (the rounded rectangle's at the corners of its straight sides' extension, the point the rounding would meet).
   - Triangle: three, at its three points.
   - Line: two, at its ends (as today).
   - Ellipse: it has no corners, so four anchors sit ON its curve at its top, right, bottom and left points (rotation applied), never on the box around it.
2. WHAT A DRAG DOES.
   - A corner anchor of a text box, memo, code, picture, rectangle or rounded rectangle resizes the object with the OPPOSITE corner held still, in the object's own rotated frame (the object stays a rectangle; codes keep their content legible). Rotation is unchanged.
   - A triangle's anchor moves that one point freely; the triangle may become any triangle. Its points are saved as three `[x, y]` pairs in inches (`points`) on the label; a layout saved before L5 reads its triangle as today's three points within its box, so nothing printed changes until it is edited.
   - An ellipse's top or bottom anchor sets its height and its left or right anchor its width, the opposite point held still, in its rotated frame.
   - A line's ends as today.
3. SOFT SNAP. While an anchor is dragged, or a whole object is moved, any of its anchors that comes within 0.06 inch of another object's anchor, or of the label's four corners, four edge midpoints and center, snaps onto it; a small marker shows the anchor it took. The snap is soft: keep dragging past 0.06 inch and it lets go. Anchor snap wins over the eighth inch grid; with no anchor in reach the grid holds as today; Shift turns every snap off (free, as today).
4. EVERYWHERE THE SAME. The editor, the print page (L1's print, L3's Quick Print) and the editor's preview draw the same geometry: a triangle's free points and a rotated object's corners print where the editor showed them. L4's ink, fill and front and back order apply unchanged.
5. NUDGE AND DELETE as today (arrow keys move the whole object an eighth inch; Delete removes it).
6. WORDS: EN and ES for any new words (the snap marker's title, a triangle point's name in the options pane if shown).

## The tests and the smoke

- Unit: each object type reports its anchors at the right points, at 0, 30 and 90 degrees (a 2 by 1 inch box at 30 degrees: four anchors on its rotated corners, none on the axis aligned box); the ellipse's four on its curve; a corner drag holds the opposite corner fixed in the rotated frame; a triangle point moves alone and the layout round-trips `points`; an old triangle reads as today's shape; snap takes an anchor within 0.06 inch, lets go past it, prefers an anchor over the grid, and Shift turns it off; the label's corners, edge midpoints and center are snap targets.
- Smoke: drop a rectangle and a triangle, drag a triangle point onto the rectangle's corner (it snaps), save, reopen (the point is there), print (the point prints there).
- Render check (Playwright, by the build and again by the Scribe): a rotated text box, a rotated code, an ellipse and a reshaped triangle selected, each showing its anchors on the shape, and the snap marker mid drag, in Lite, CO and Cerberus at 1920 wide; one print page.
- Gates as always: typecheck 0; vitest under `TZ=UTC` and `TZ=America/New_York`; `node --check scripts/smoke.mjs`; the from-zero smoke (no new migration; the pin as L4 left it), SMOKE PASS, no ` 500 `. Dash and CR audits by character; no personnel name in a tracked file. No git; nothing committed, pushed or deployed. Report to `SESSION_REPORTS/` with the tree hash and every file touched.
