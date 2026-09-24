/**
 * THE CHANGE LOCATION SETUP page (canon 0.30.40): the plants/packages toggle,
 * a farm, a license, the package or plant to move, from and to, the warning,
 * Execute. Two steps on one server-rendered page: pick (a GET that resolves the
 * record and shows where it stands), then Execute (a POST behind a confirm).
 * Behind the Inventory node's PIN like the rest of /inventory.
 */

import { FLOOR_SITE_ORDER, formatGrams, type FloorSite } from "./config";
import type { LookupOption } from "./db";
import { t, type Locale } from "./i18n";
import {
  licensesForChange,
  type LedgerPackageRow,
  type LocationKind,
  type PackagePick,
  type PendingLocationMoveRow,
  type PlantLocationCount,
  type PlantRow,
} from "./locations";
import { esc, tabBar } from "./ui";

export type ChangeLocationData = {
  kind: LocationKind;
  farm: FloorSite | null;
  license: string;
  licenseLabels: Map<string, string>;
  destinations: LookupOption[];
  /** Packages: the ledger's packages under the license for the select. */
  ledger: LedgerPackageRow[];
  /** Packages: the typed pick and what it resolved to. */
  pick: string;
  found: PackagePick | null;
  /** Plants: the mirror's locations with counts, and the chosen from. */
  plantLocations: PlantLocationCount[];
  fromLocation: string;
  plants: PlantRow[];
  plant: PlantRow | null;
  recent: PendingLocationMoveRow[];
  today: string;
  ok?: string;
  moved?: { n: number; to: string; group: string };
};

function query(parts: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(parts)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function toggle(data: ChangeLocationData, locale: Locale): string {
  // The license is kept only when it belongs to the other kind too (plants
  // never sit under the processor).
  const keep = (kind: LocationKind) =>
    data.farm && data.license && licensesForChange(data.farm, kind).includes(data.license) ? data.license : "";
  return tabBar(
    locale,
    [
      { key: "plants", href: `/inventory/change-locations${query({ kind: "plants", farm: data.farm ?? "", license: keep("plants") })}`, label: "Plants" },
      { key: "packages", href: `/inventory/change-locations${query({ kind: "packages", farm: data.farm ?? "", license: keep("packages") })}`, label: "Packages" },
    ],
    data.kind
  );
}

function scopeForm(data: ChangeLocationData, locale: Locale): string {
  const farmOpts = FLOOR_SITE_ORDER.map(
    (f) => `<option value="${esc(f)}"${data.farm === f ? " selected" : ""}>${esc(f)}</option>`
  ).join("");
  const licenses = data.farm ? licensesForChange(data.farm, data.kind) : [];
  const licOpts = licenses
    .map((l) => `<option value="${esc(l)}"${data.license === l ? " selected" : ""}>${esc(data.licenseLabels.get(l) ?? l)} ${esc(l)}</option>`)
    .join("");
  return `<form method="get" action="/inventory/change-locations" class="row-actions change-scope" data-change-scope>
    <input type="hidden" name="kind" value="${esc(data.kind)}">
    <label class="field">${esc(t(locale, "Farm"))}
      <select name="farm" data-farm-select><option value="">${esc(t(locale, "Pick a farm"))}</option>${farmOpts}</select>
    </label>
    <label class="field">${esc(t(locale, "License"))}
      <select name="license" data-license-select${licenses.length ? "" : " disabled"}><option value="">${esc(t(locale, data.farm ? "Pick a license" : "Pick a farm first"))}</option>${licOpts}</select>
    </label>
    <button type="submit" class="secondary">${esc(t(locale, "Set"))}</button>
    <script>
      (function () {
        var form = document.querySelector("[data-change-scope]");
        if (!form) return;
        var farm = form.querySelector("[data-farm-select]");
        var lic = form.querySelector("[data-license-select]");
        if (farm) farm.addEventListener("change", function () { if (lic) lic.value = ""; form.submit(); });
        if (lic) lic.addEventListener("change", function () { form.submit(); });
      })();
    </script>
  </form>`;
}

function packagePickForm(data: ChangeLocationData, locale: Locale): string {
  const opts = data.ledger
    .map((r) => {
      const label = `${r.metrc_tag ?? r.package_code} / ${r.strain_name ?? r.item_kind} / ${formatGrams(r.qty)} ${r.uom} / ${r.location}`;
      const value = r.metrc_tag ?? r.package_code;
      return `<option value="${esc(value)}"${data.pick === value ? " selected" : ""}>${esc(label)}</option>`;
    })
    .join("");
  return `<form method="get" action="/inventory/change-locations" class="row-actions change-pick" data-change-pick>
    <input type="hidden" name="kind" value="packages">
    <input type="hidden" name="farm" value="${esc(data.farm ?? "")}">
    <input type="hidden" name="license" value="${esc(data.license)}">
    <label class="field">${esc(t(locale, "Package tag or code"))}
      <input type="text" name="pick" value="${esc(data.pick)}" class="metrc-tag-input" placeholder="1A..." autocomplete="off" spellcheck="false" data-pick-input>
    </label>
    ${
      data.ledger.length
        ? `<label class="field">${esc(t(locale, "Or pick from the ledger"))}
      <select name="pick_ledger" data-pick-ledger><option value="">${esc(t(locale, "Ledger packages under this license"))}</option>${opts}</select>
    </label>`
        : ""
    }
    <button type="submit" class="secondary">${esc(t(locale, "Find"))}</button>
    <script>
      (function () {
        var form = document.querySelector("[data-change-pick]");
        if (!form) return;
        var sel = form.querySelector("[data-pick-ledger]");
        var input = form.querySelector("[data-pick-input]");
        if (sel && input) sel.addEventListener("change", function () { input.value = sel.value; form.submit(); });
      })();
    </script>
  </form>`;
}

function plantPickForm(data: ChangeLocationData, locale: Locale): string {
  const opts = data.plantLocations
    .map(
      (l) => `<option value="${esc(l.location)}"${data.fromLocation === l.location ? " selected" : ""}>${esc(l.location || t(locale, "(no location)"))} (${esc(String(l.n))})</option>`
    )
    .join("");
  return `<form method="get" action="/inventory/change-locations" class="row-actions change-pick" data-change-pick>
    <input type="hidden" name="kind" value="plants">
    <input type="hidden" name="farm" value="${esc(data.farm ?? "")}">
    <input type="hidden" name="license" value="${esc(data.license)}">
    <label class="field">${esc(t(locale, "Plant tag"))}
      <input type="text" name="pick" value="${esc(data.pick)}" class="metrc-tag-input" placeholder="1A..." autocomplete="off" spellcheck="false">
    </label>
    <label class="field">${esc(t(locale, "Or every plant at"))}
      <select name="from" data-from-select><option value="">${esc(t(locale, data.plantLocations.length ? "Pick the location they leave" : "No plants mounted for this license yet"))}</option>${opts}</select>
    </label>
    <button type="submit" class="secondary">${esc(t(locale, "Find"))}</button>
    <script>
      (function () {
        var form = document.querySelector("[data-change-pick]");
        if (!form) return;
        var sel = form.querySelector("[data-from-select]");
        if (sel) sel.addEventListener("change", function () { form.submit(); });
      })();
    </script>
  </form>`;
}

function destinationSelect(data: ChangeLocationData, locale: Locale, exclude: string | null): string {
  const opts = data.destinations
    .filter((o) => o.value !== exclude && o.label !== exclude)
    .map((o) => `<option value="${esc(o.value)}">${esc(o.label)}${o.tone === "metrc" ? ` (${esc(t(locale, "from METRC"))})` : ""}</option>`)
    .join("");
  return `<select name="to_location" required data-to-select><option value="">${esc(t(locale, "Pick where it goes"))}</option>${opts}</select>`;
}

function warning(locale: Locale, count: number, kind: LocationKind, license: string): string {
  return `<p class="banner warn change-warning" data-change-warning>${esc(
    t(locale, "Execute records the move here, writes the new location onto the record, and pends the METRC Location Change file on Pending Data Uploads. METRC itself changes only when that file is uploaded. Everything stays under")
  )} <code>${esc(license)}</code>: ${esc(String(count))} ${esc(t(locale, kind === "plants" ? (count === 1 ? "plant" : "plants") : count === 1 ? "package" : "packages"))}.</p>`;
}

function executeForm(
  data: ChangeLocationData,
  locale: Locale,
  fields: string,
  count: number,
  exclude: string | null
): string {
  const confirmMsg = t(locale, "Move it? This pends the METRC Location Change file; METRC changes only when that file is uploaded.");
  return `<form method="post" action="/inventory/change-locations" class="stack change-execute" data-change-execute data-confirm="${esc(confirmMsg)}">
    <input type="hidden" name="kind" value="${esc(data.kind)}">
    <input type="hidden" name="farm_code" value="${esc(data.farm ?? "")}">
    <input type="hidden" name="license_value" value="${esc(data.license)}">
    ${fields}
    <label class="field">${esc(t(locale, "To"))} ${destinationSelect(data, locale, exclude)}</label>
    <label class="field">${esc(t(locale, "Move date"))} <input type="date" name="move_date" value="${esc(data.today)}" required></label>
    ${warning(locale, count, data.kind, data.license)}
    <button type="submit" class="danger" data-execute>${esc(t(locale, "Execute"))}</button>
    <script>
      (function () {
        var form = document.querySelector("[data-change-execute]");
        if (!form) return;
        form.addEventListener("submit", function (e) {
          if (!confirm(form.getAttribute("data-confirm") || "")) e.preventDefault();
        });
      })();
    </script>
  </form>`;
}

function packageCard(data: ChangeLocationData, locale: Locale): string {
  if (!data.pick) return "";
  const f = data.found;
  if (!f) {
    return `<p class="muted" data-pick-unknown>${esc(t(locale, "No package by that tag or code under this license."))}</p>`;
  }
  const from = f.location ?? "";
  const meta = [f.item, f.strain, f.qty == null ? null : `${formatGrams(f.qty)} ${f.uom ?? ""}`].filter(Boolean).join(" / ");
  return `<section class="change-card" data-pick-found="${esc(f.source)}">
    <h3><code>${esc(f.label)}</code> <span class="muted">${esc(t(locale, f.source === "ledger" ? "ledger package" : "METRC package"))}</span></h3>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "What"))}</dt><dd>${esc(meta)}</dd>
      <dt>${esc(t(locale, "From"))}</dt><dd data-from-location>${esc(from || "-")}</dd>
      <dt>${esc(t(locale, "METRC tag"))}</dt><dd>${f.tag ? `<code>${esc(f.tag)}</code>` : `<span class="muted tag-missing">${esc(t(locale, "no METRC tag yet"))}</span>`}</dd>
    </dl>
    ${executeForm(data, locale, `<input type="hidden" name="pick" value="${esc(data.pick)}">`, 1, from)}
  </section>`;
}

function plantCard(data: ChangeLocationData, locale: Locale): string {
  if (data.pick) {
    const p = data.plant;
    if (!p) return `<p class="muted" data-pick-unknown>${esc(t(locale, "No plant by that tag under this license; mount the license's plants export first."))}</p>`;
    return `<section class="change-card" data-pick-found="plant">
      <h3><code>${esc(p.tag)}</code> <span class="muted">${esc(t(locale, "METRC plant"))}</span></h3>
      <dl class="lot-meta">
        <dt>${esc(t(locale, "Strain"))}</dt><dd>${esc(p.strain ?? "")}</dd>
        <dt>${esc(t(locale, "Phase"))}</dt><dd>${esc(p.phase)}</dd>
        <dt>${esc(t(locale, "From"))}</dt><dd data-from-location>${esc(p.location ?? "-")}</dd>
      </dl>
      ${executeForm(data, locale, `<input type="hidden" name="pick" value="${esc(data.pick)}">`, 1, p.location ?? null)}
    </section>`;
  }
  if (!data.fromLocation) return "";
  if (data.plants.length === 0) {
    return `<p class="muted" data-pick-unknown>${esc(t(locale, "No plants stand at that location under this license."))}</p>`;
  }
  const strains = new Map<string, number>();
  for (const p of data.plants) strains.set(p.strain ?? "", (strains.get(p.strain ?? "") ?? 0) + 1);
  const strainLine = [...strains.entries()].map(([s, n]) => `${s || "?"} ${n}`).join(", ");
  return `<section class="change-card" data-pick-found="plants" data-plant-count="${esc(String(data.plants.length))}">
    <h3>${esc(String(data.plants.length))} ${esc(t(locale, data.plants.length === 1 ? "plant" : "plants"))} <span class="muted">${esc(t(locale, "at"))} ${esc(data.fromLocation)}</span></h3>
    <dl class="lot-meta">
      <dt>${esc(t(locale, "Strains"))}</dt><dd>${esc(strainLine)}</dd>
      <dt>${esc(t(locale, "From"))}</dt><dd data-from-location>${esc(data.fromLocation)}</dd>
    </dl>
    ${executeForm(data, locale, `<input type="hidden" name="from_location" value="${esc(data.fromLocation)}">`, data.plants.length, data.fromLocation)}
  </section>`;
}

function recentTable(data: ChangeLocationData, locale: Locale): string {
  if (data.recent.length === 0) return "";
  const rows = data.recent
    .map(
      (m) => `<tr data-move-group="${esc(m.group_id)}">
        <td>${esc(m.newest_activity)}</td>
        <td>${esc(t(locale, m.kind === "plants" ? "plants" : "packages"))}</td>
        <td><code>${esc(m.license_value)}</code></td>
        <td>${esc(String(m.moved))}</td>
        <td>${esc(m.from_summary || "-")} &#8594; ${esc(m.to_location)}</td>
        <td><a href="/admin/uploads/location_move/${esc(m.group_id)}.csv">${esc(t(locale, "File"))}</a>${m.untagged ? ` <span class="muted tag-missing">${esc(String(m.untagged))} ${esc(t(locale, "no METRC tag yet"))}</span>` : ""}</td>
      </tr>`
    )
    .join("");
  return `<section class="change-recent">
    <h2>${esc(t(locale, "Recent moves"))}</h2>
    <table class="data" data-recent-moves>
      <thead><tr><th>${esc(t(locale, "When"))}</th><th>${esc(t(locale, "Kind"))}</th><th>${esc(t(locale, "License"))}</th><th>${esc(t(locale, "Moved"))}</th><th>${esc(t(locale, "From / To"))}</th><th>${esc(t(locale, "File"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

export function changeLocationPage(data: ChangeLocationData, locale: Locale): string {
  const flash =
    data.ok === "moved" && data.moved
      ? `<p class="banner ok" data-move-flash>${esc(t(locale, "Moved"))} ${esc(String(data.moved.n))} ${esc(t(locale, data.kind === "plants" ? (data.moved.n === 1 ? "plant" : "plants") : data.moved.n === 1 ? "package" : "packages"))} ${esc(t(locale, "to"))} ${esc(data.moved.to)}. ${esc(t(locale, "The METRC Location Change file is pending on"))} <a href="/admin/uploads">${esc(t(locale, "Pending Data Uploads"))}</a>.</p>`
      : "";
  const scoped = Boolean(data.farm && data.license);
  const pick = scoped ? (data.kind === "packages" ? packagePickForm(data, locale) : plantPickForm(data, locale)) : "";
  const card = scoped ? (data.kind === "packages" ? packageCard(data, locale) : plantCard(data, locale)) : "";
  return `<p class="crumb"><a href="/inventory">${esc(t(locale, "Inventory"))}</a></p>
    <h1 title="${esc(t(locale, "Move a plant or a package within its license and pend the METRC Location Change file; never a transfer manifest."))}">${esc(t(locale, "Change Locations"))}</h1>
    ${flash}
    ${toggle(data, locale)}
    ${scopeForm(data, locale)}
    ${pick}
    ${card}
    ${recentTable(data, locale)}`;
}
