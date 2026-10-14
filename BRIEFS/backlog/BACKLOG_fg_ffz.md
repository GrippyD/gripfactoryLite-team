# Backlog: FFZ "Fresh Frozen" line on FG inventory

Owner, 2026-10-14: add a FFZ line, "Fresh Frozen", in a future slice, as an incidental (not its own push).

- Icon: fg-ffz.svg here, traced by the Scribe from the owner's drawing (bud in an ice block), single color currentColor, same treatment as the nine FG icons. When the slice lands it moves to app/public/icons/fg/ and joins the FG_ICON_FILES allow list in src/index.ts (a public file 404s until a route names it).
- Today FFZ is in FG_NOT_FINISHED, so Zoho FFZ listings count under "Not shown". The slice takes FFZ out of that list for its own row.
- Open when it lands: source (Zoho FFZ listings or METRC Fresh Frozen packages), unit (lb), bar kind (MIX by strain or a CAP), and where the row sits (after Trim/Bio and Shake is the natural place).
