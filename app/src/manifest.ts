/**
 * THE MANIFEST BUILDER (canon 0.30.125). Owner ruling 2026-09-18, verbatim
 * (his line breaks folded): "New interco logistics layout: Three equal panes
 * Left Pane: Origin License: selecting a license exposes the METRC packages
 * ordered numerically based on the last six digits At the top of the exposed
 * list, a "last six" filter (user types the last six digits and it focuses on
 * all the packages that meet the criterea. Add a package to the far right pane
 * by clicking ">>" next to it Middle Pane: Destination License: Selecting
 * exposes METRC location within that license (we call this "receive into")
 * Right Pane: Header: all the herbs and spices needed for a METRC manifest (use
 * our library of templates--I believe this one is T3 based) Underneath the
 * header, packages added from the left each with its own "<<" proceeding it
 * that "puts the package back in" the origin license list. ... [finish] button
 * [cancel] button". His picks on the forks: finish downloads the T3 file at
 * once and records the move; the receive-into list is the mirror's; a package
 * already on a finished manifest reads dim with no >>; a wholesale price box
 * per added package.
 *
 * The page is one form. The origin pick reloads the page (a license's packages
 * are the mirror's rows, thousands at the big licenses); everything after that
 * happens in the browser: the last-six filter, >> and << moving a row between
 * the two lists, the destination pick filling receive-into and the recipient
 * line and prefilling the header from the newest finished manifest on the same
 * pair. Nothing is written until [finish]; [cancel] is the bare page again.
 *
 * Pure renderers and pure law: input in, HTML or rows out, pinned by the tests
 * without a database.
 */
import { formatGrams } from "./config";
import { lockOnSubmitScript } from "./html";
import { t, type Locale } from "./i18n";
import { licenseOptionLabel, movementIdShort, type T3ManifestHeader } from "./interco";
import { esc } from "./ui";

export const MANIFEST_PATH = "/interco";
export const MANIFEST_FINISH_PATH = "/interco/manifest/finish";
export function manifestCsvPath(movementId: string): string {
  return `/interco/manifest/${encodeURIComponent(movementId)}/csv`;
}

/** The header, in the T3 Licensed Transfers template's own order (the
 * recipient is the destination license, derived, not typed). Field names are
 * the interco_movements columns, so the row writes straight through. */
export const MANIFEST_HEADER_FIELDS = [
  { name: "planned_route", label: "Planned route", kind: "textarea" },
  { name: "transfer_type", label: "Transfer type", kind: "text" },
  { name: "invoice_number", label: "Invoice number", kind: "text" },
  { name: "payment_term_days", label: "Payment term days", kind: "text" },
  { name: "planned_departure", label: "Estimated departure", kind: "text" },
  { name: "planned_arrival", label: "Estimated arrival", kind: "text" },
  { name: "gross_weight", label: "Gross weight", kind: "text" },
  { name: "gross_weight_uom", label: "Gross weight UOM", kind: "text" },
  { name: "transporter_license", label: "Transporter license", kind: "text" },
  { name: "transporter_phone", label: "Transporter phone", kind: "text" },
  { name: "driver", label: "Driver name", kind: "text" },
  { name: "driver_occupational_license", label: "Driver occupational license", kind: "text" },
  { name: "driver_license_number", label: "Driver license number", kind: "text" },
  { name: "vehicle_make", label: "Vehicle make", kind: "text" },
  { name: "vehicle_model", label: "Vehicle model", kind: "text" },
  { name: "vehicle_plate", label: "Vehicle plate", kind: "text" },
] as const;

export type ManifestHeaderField = (typeof MANIFEST_HEADER_FIELDS)[number]["name"];
export type ManifestHeaderValues = Record<ManifestHeaderField, string>;

export const MANIFEST_REFUSAL = {
  origin: "Pick the origin license.",
  originUnknown: "That origin license is not on the license list.",
  destination: "Pick the destination license.",
  destinationUnknown: "That destination license is not on the license list.",
  samePair: "The destination must differ from the origin.",
  noPackages: "Add at least one package with >> before finishing.",
  tagShape: "A package tag must be 1A plus 22 hex characters.",
  duplicateTag: "A package is on the manifest twice.",
  notInMirror: "That package is not in the METRC mirror under the origin license.",
  alreadyManifested: "That package already rides a finished manifest.",
  price: "A wholesale price must be a number.",
} as const;

/** A package as the METRC mirror states it, the fields the pane shows. */
export type MirrorPackage = {
  tag: string;
  item: string | null;
  category: string | null;
  quantity: number | null;
  uom: string | null;
  location: string | null;
};

export type LicenseOption = { value: string; label: string; farm_code?: string | null };

export type ManifestBuilderData = {
  licenses: LicenseOption[];
  /** The picked origin license, or null before the pick. */
  origin: string | null;
  /** The destination to preselect (carried across the origin reload). */
  dest: string | null;
  /** The origin's live mirror rows, any order; the renderer sorts. */
  packages: MirrorPackage[];
  /** tag -> movement id, for packages riding a finished manifest. */
  manifested: ReadonlyMap<string, string>;
  /** license -> the location names the mirror carries for it (receive into). */
  locationsByLicense: Record<string, string[]>;
  /** destination license -> the newest finished manifest's header on the same pair. */
  prefillByDestination: Record<string, Partial<ManifestHeaderValues>>;
  /** After [finish]: the recorded movement, for the flash and the download. */
  finished: { movementId: string; count: number } | null;
};

/* ------------------------------------------------------------ the law */

export function lastSix(tag: string): string {
  return String(tag ?? "").trim().toUpperCase().slice(-6);
}

/** The number in the last six when they are digits; null otherwise. */
export function lastSixNumber(tag: string): number | null {
  const six = lastSix(tag);
  return /^\d{6}$/.test(six) ? Number(six) : null;
}

/** "ordered numerically based on the last six digits": numeric last-six
 * ascending, a non-numeric tail after them by its text, ties by the whole tag. */
export function compareByLastSix(a: string, b: string): number {
  const na = lastSixNumber(a);
  const nb = lastSixNumber(b);
  if (na != null && nb != null && na !== nb) return na - nb;
  if (na != null && nb == null) return -1;
  if (na == null && nb != null) return 1;
  if (na == null && nb == null) {
    const sa = lastSix(a);
    const sb = lastSix(b);
    if (sa !== sb) return sa < sb ? -1 : 1;
  }
  const ta = String(a).toUpperCase();
  const tb = String(b).toUpperCase();
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

export function sortByLastSix<T extends { tag: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((x, y) => compareByLastSix(x.tag, y.tag));
}

/** The "last six" filter: the typed digits anywhere in the last six (a
 * partial read from the label narrows as it grows); more than six characters
 * typed or scanned match against the whole tag. Blank shows everything. */
export function matchesLastSix(tag: string, typed: string): boolean {
  const q = String(typed ?? "").trim().toUpperCase();
  if (!q) return true;
  const full = String(tag ?? "").trim().toUpperCase();
  if (q.length > 6) return full.includes(q);
  return lastSix(full).includes(q);
}

export function isMetrcTagShape(tag: string): boolean {
  return /^1A[0-9A-F]{22}$/.test(String(tag ?? "").trim().toUpperCase());
}

/** The receive-into list: the mirror's location names for a license, blanks
 * dropped, deduped, A to Z. */
export function receiveIntoList(locations: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const raw of locations) {
    const name = String(raw ?? "").trim();
    if (name) seen.add(name);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true }));
}

export type ParsedFinish = {
  originLicense: string;
  destinationLicense: string;
  destinationLocation: string | null;
  header: ManifestHeaderValues;
  packages: Array<{ tag: string; wholesalePrice: string | null }>;
};

/** Reads the finish form into its parts, or names the refusal. The tag and
 * price boxes ride the same list item, so the two arrays line up by order. */
export function parseFinishForm(form: FormData): { ok: true; value: ParsedFinish } | { ok: false; error: string } {
  // A form submission carries CRLF line breaks (the textarea's route); the
  // record and the file keep LF, as the vendored T3 example's quoted route does.
  const text = (name: string) => String(form.get(name) ?? "").replace(/\r\n?/g, "\n").trim();
  const originLicense = text("origin_license");
  if (!originLicense) return { ok: false, error: MANIFEST_REFUSAL.origin };
  const destinationLicense = text("destination_license");
  if (!destinationLicense) return { ok: false, error: MANIFEST_REFUSAL.destination };
  if (destinationLicense === originLicense) return { ok: false, error: MANIFEST_REFUSAL.samePair };
  const destinationLocation = text("destination_location") || null;
  const header = {} as ManifestHeaderValues;
  for (const field of MANIFEST_HEADER_FIELDS) header[field.name] = text(field.name);
  const tags = form.getAll("tags").map((v) => String(v ?? "").trim().toUpperCase());
  const prices = form.getAll("prices").map((v) => String(v ?? "").trim());
  if (tags.length === 0) return { ok: false, error: MANIFEST_REFUSAL.noPackages };
  const seen = new Set<string>();
  const packages: ParsedFinish["packages"] = [];
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (!isMetrcTagShape(tag)) return { ok: false, error: MANIFEST_REFUSAL.tagShape };
    if (seen.has(tag)) return { ok: false, error: MANIFEST_REFUSAL.duplicateTag };
    seen.add(tag);
    const price = prices[i] ?? "";
    if (price && !/^-?\d+(\.\d+)?$/.test(price.replaceAll(",", ""))) return { ok: false, error: MANIFEST_REFUSAL.price };
    packages.push({ tag, wholesalePrice: price ? price.replaceAll(",", "") : null });
  }
  return {
    ok: true,
    value: { originLicense, destinationLicense, destinationLocation, header, packages },
  };
}

/** The T3 header from a movement row's columns (the recipient is the destination). */
export function headerFromMovement(m: {
  destination_license: string;
  planned_route?: string | null;
  transfer_type?: string | null;
  invoice_number?: string | null;
  payment_term_days?: string | null;
  planned_departure?: string | null;
  planned_arrival?: string | null;
  gross_weight?: string | null;
  gross_weight_uom?: string | null;
  transporter_license?: string | null;
  transporter_phone?: string | null;
  driver?: string | null;
  driver_occupational_license?: string | null;
  driver_license_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_plate?: string | null;
}): T3ManifestHeader {
  return {
    recipientId: m.destination_license,
    plannedRoute: m.planned_route ?? "",
    transferType: m.transfer_type ?? "",
    invoiceNumber: m.invoice_number ?? "",
    paymentTermDays: m.payment_term_days ?? "",
    estimatedDeparture: m.planned_departure ?? "",
    estimatedArrival: m.planned_arrival ?? "",
    grossWeight: m.gross_weight ?? "",
    grossWeightUom: m.gross_weight_uom ?? "",
    transporterId: m.transporter_license ?? "",
    transporterPhone: m.transporter_phone ?? "",
    driverName: m.driver ?? "",
    driverOccupationalLicense: m.driver_occupational_license ?? "",
    driverLicenseNumber: m.driver_license_number ?? "",
    vehicleMake: m.vehicle_make ?? "",
    vehicleModel: m.vehicle_model ?? "",
    vehiclePlate: m.vehicle_plate ?? "",
  };
}

/* ------------------------------------------------------------ the page */

function quantityWords(pkg: MirrorPackage): string {
  if (pkg.quantity == null) return "";
  const uom = String(pkg.uom ?? "").trim();
  const isGrams = uom.toLowerCase() === "g" || uom.toLowerCase() === "grams";
  const qty = isGrams ? formatGrams(pkg.quantity) : String(pkg.quantity);
  return uom ? `${qty} ${uom}` : qty;
}

function licenseOptions(licenses: LicenseOption[], picked: string | null, skip: string | null): string {
  return licenses
    .filter((o) => o.value !== skip)
    .map((o) => {
      const sel = picked === o.value ? " selected" : "";
      return `<option value="${esc(o.value)}"${sel}>${esc(licenseOptionLabel(o.value, o.label))}</option>`;
    })
    .join("");
}

/** One package row. It carries both shuttles and the manifest-only boxes
 * (disabled until the row sits in the manifest list), so >> and << are a
 * class flip and a disabled flip, no markup built in the browser. */
export function packageRow(locale: Locale, pkg: MirrorPackage, manifestedId: string | null): string {
  const six = lastSix(pkg.tag);
  const sub = [pkg.item ?? "", quantityWords(pkg), pkg.location ?? ""].filter((s) => s !== "").join(" \u00b7 ");
  if (manifestedId) {
    return `<li class="pkg-row pkg-dim" data-tag="${esc(pkg.tag)}" data-last6="${esc(six)}" data-manifested="${esc(movementIdShort(manifestedId))}">
      <span class="shuttle-slot" aria-hidden="true"></span>
      <span class="pkg-main"><b class="tag-six">${esc(six)}</b> <span class="muted tag-full">${esc(pkg.tag)}</span>
        <span class="pkg-sub">${esc(sub)}</span>
        <span class="pkg-sub">${esc(t(locale, "on manifest"))} ${esc(movementIdShort(manifestedId))}</span></span>
    </li>`;
  }
  return `<li class="pkg-row" data-tag="${esc(pkg.tag)}" data-last6="${esc(six)}">
      <button type="button" class="secondary shuttle-btn" data-add aria-label="${esc(t(locale, "Add to manifest"))}" title="${esc(t(locale, "Add to manifest"))}">&gt;&gt;</button>
      <button type="button" class="secondary shuttle-btn" data-remove aria-label="${esc(t(locale, "Put back in the origin list"))}" title="${esc(t(locale, "Put back in the origin list"))}">&lt;&lt;</button>
      <span class="pkg-main"><b class="tag-six">${esc(six)}</b> <span class="muted tag-full">${esc(pkg.tag)}</span>
        <span class="pkg-sub">${esc(sub)}</span></span>
      <span class="manifest-only">
        <input type="hidden" name="tags" value="${esc(pkg.tag)}" disabled>
        <label class="field price-field">${esc(t(locale, "Wholesale price"))}
          <input type="text" name="prices" inputmode="decimal" autocomplete="off" placeholder="0.00" disabled></label>
      </span>
    </li>`;
}

function headerFields(locale: Locale): string {
  const fields = MANIFEST_HEADER_FIELDS.map((f) => {
    const label = esc(t(locale, f.label));
    if (f.kind === "textarea") {
      return `<label class="field wide">${label}<textarea name="${f.name}" rows="3" data-header-field></textarea></label>`;
    }
    return `<label class="field">${label}<input type="text" name="${f.name}" autocomplete="off" data-header-field></label>`;
  }).join("\n        ");
  return `<div class="hdr-grid">
        ${fields}
      </div>`;
}

function countWords(locale: Locale, n: number): string {
  return `${n} ${t(locale, n === 1 ? "package" : "packages")}`;
}

export function manifestBuilderPage(locale: Locale, data: ManifestBuilderData): string {
  const origin = data.origin;
  const originKnown = origin != null && data.licenses.some((o) => o.value === origin);
  const sorted = sortByLastSix(data.packages);
  const rows = sorted.map((pkg) => packageRow(locale, pkg, data.manifested.get(pkg.tag) ?? null)).join("\n");
  const originList = !originKnown
    ? `<p class="muted" data-origin-empty>${esc(t(locale, "- EMPTY -"))}</p>`
    : sorted.length === 0
      ? `<p class="muted" data-origin-empty>${esc(t(locale, "- EMPTY -"))}</p>`
      : `<label class="field">${esc(t(locale, "Last six"))}
        <input type="text" inputmode="numeric" autocomplete="off" maxlength="24" placeholder="######" data-last-six aria-describedby="origin-count"></label>
      <p class="muted" id="origin-count" data-origin-count data-total="${sorted.length}">${esc(countWords(locale, sorted.length))}</p>
      <ul class="floor-rows pkg-list" data-origin-list>
        ${rows}
      </ul>
      <p class="muted" data-origin-empty hidden>${esc(t(locale, "- EMPTY -"))}</p>`;
  const finished = data.finished
    ? `<div class="banner ok manifest-finished" data-manifest-finished="${esc(data.finished.movementId)}">
      ${esc(t(locale, "Manifest"))} <b>${esc(movementIdShort(data.finished.movementId))}</b>: ${esc(countWords(locale, data.finished.count))}.
      <a href="${esc(manifestCsvPath(data.finished.movementId))}" data-manifest-download>${esc(t(locale, "Download the T3 file"))}</a>.
      ${esc(t(locale, "It also waits on Pending Data Uploads until marked uploaded."))}
    </div>`
    : "";
  const payload = JSON.stringify({
    locations: data.locationsByLicense,
    prefill: data.prefillByDestination,
    recipientWord: t(locale, "Recipient"),
  });
  return `<h1 title="${esc(t(locale, "One origin license per manifest; the T3 file downloads at finish and waits on Pending Data Uploads."))}">${esc(t(locale, "Interco Logistics"))}</h1>
    ${finished}
    <form class="interco-panes" method="post" action="${MANIFEST_FINISH_PATH}" id="manifest-form" data-manifest-builder data-lock-on-submit>
      <input type="hidden" name="origin_license" value="${esc(originKnown ? origin : "")}">
      <section class="card pane" data-pane="origin">
        <h2>${esc(t(locale, "Origin license"))}</h2>
        <label class="field">${esc(t(locale, "License"))}
          <select data-origin-license>
            <option value=""></option>
            ${licenseOptions(data.licenses, originKnown ? origin : null, null)}
          </select>
        </label>
        ${originList}
      </section>
      <section class="card pane" data-pane="destination">
        <h2>${esc(t(locale, "Destination license"))}</h2>
        <label class="field">${esc(t(locale, "License"))}
          <select name="destination_license" data-dest-license required>
            <option value=""></option>
            ${licenseOptions(data.licenses, data.dest, originKnown ? origin : null)}
          </select>
        </label>
        <label class="field">${esc(t(locale, "Receive into"))}
          <select name="destination_location" data-receive-into>
            <option value=""></option>
          </select>
        </label>
        <p class="muted" data-receive-empty>${esc(t(locale, "- EMPTY -"))}</p>
      </section>
      <section class="card pane" data-pane="manifest">
        <h2>${esc(t(locale, "Manifest"))}</h2>
        <p data-recipient>${esc(t(locale, "Recipient"))}: <b data-recipient-value>-</b></p>
        <details class="manifest-header" open>
          <summary>${esc(t(locale, "Header"))}</summary>
          ${headerFields(locale)}
        </details>
        <h3>${esc(t(locale, "Packages"))} <span class="tile-count" data-manifest-count>0</span></h3>
        <ul class="floor-rows pkg-list" data-manifest-list></ul>
        <p class="muted" data-manifest-empty>${esc(t(locale, "- EMPTY -"))}</p>
        <p class="banner err" data-manifest-error hidden></p>
        <div class="row-actions manifest-actions">
          <button type="submit" data-finish>${esc(t(locale, "Finish"))}</button>
          <a class="btn secondary" href="${MANIFEST_PATH}" data-cancel>${esc(t(locale, "Cancel"))}</a>
        </div>
      </section>
    </form>
    <script type="application/json" id="manifest-data">${payload.replaceAll("<", "\\u003c")}</script>
    ${manifestBuilderScript(locale)}
    ${lockOnSubmitScript()}
    ${data.finished ? autoDownloadScript(manifestCsvPath(data.finished.movementId)) : ""}`;
}

/** After [finish] the page opens with the file already on its way (an
 * attachment navigation downloads and stays); the banner's link is the second
 * chance when a browser holds the automatic one back. */
export function autoDownloadScript(csvPath: string): string {
  return `<script>
(function () {
  var link = document.querySelector("[data-manifest-download]");
  if (!link) return;
  window.setTimeout(function () { window.location.href = ${JSON.stringify(csvPath)}; }, 120);
})();
</script>`;
}

/** The browser side of the three panes. Reads the page's own JSON block; no
 * fetches, nothing stored until [finish]. */
export function manifestBuilderScript(locale: Locale): string {
  const words = JSON.stringify({
    package: t(locale, "package"),
    packages: t(locale, "packages"),
    noPackages: t(locale, MANIFEST_REFUSAL.noPackages),
    noDestination: t(locale, MANIFEST_REFUSAL.destination),
  });
  return `<script>
(function () {
  var form = document.getElementById("manifest-form");
  if (!form || form.getAttribute("data-builder-wired")) return;
  form.setAttribute("data-builder-wired", "1");
  var WORDS = ${words};
  var dataEl = document.getElementById("manifest-data");
  var DATA = { locations: {}, prefill: {}, recipientWord: "Recipient" };
  try { DATA = JSON.parse(dataEl ? dataEl.textContent || "{}" : "{}"); } catch (e) {}
  var originSelect = form.querySelector("[data-origin-license]");
  var destSelect = form.querySelector("[data-dest-license]");
  var receiveInto = form.querySelector("[data-receive-into]");
  var receiveEmpty = form.querySelector("[data-receive-empty]");
  var recipientValue = form.querySelector("[data-recipient-value]");
  var originList = form.querySelector("[data-origin-list]");
  var originEmpty = form.querySelector("[data-origin-empty]");
  var originCount = form.querySelector("[data-origin-count]");
  var filter = form.querySelector("[data-last-six]");
  var manifestList = form.querySelector("[data-manifest-list]");
  var manifestEmpty = form.querySelector("[data-manifest-empty]");
  var manifestCount = form.querySelector("[data-manifest-count]");
  var errorLine = form.querySelector("[data-manifest-error]");

  function lastSixOf(tag) { return String(tag || "").toUpperCase().slice(-6); }
  function numberOf(tag) { var six = lastSixOf(tag); return /^[0-9]{6}$/.test(six) ? parseInt(six, 10) : null; }
  function compareTags(a, b) {
    var na = numberOf(a), nb = numberOf(b);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na !== null && nb === null) return -1;
    if (na === null && nb !== null) return 1;
    if (na === null && nb === null) { var sa = lastSixOf(a), sb = lastSixOf(b); if (sa !== sb) return sa < sb ? -1 : 1; }
    var ta = String(a).toUpperCase(), tb = String(b).toUpperCase();
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }
  function matches(tag, typed) {
    var q = String(typed || "").trim().toUpperCase();
    if (!q) return true;
    var full = String(tag || "").toUpperCase();
    if (q.length > 6) return full.indexOf(q) >= 0;
    return lastSixOf(full).indexOf(q) >= 0;
  }
  function showError(text) {
    if (!errorLine) return;
    if (text) { errorLine.textContent = text; errorLine.removeAttribute("hidden"); }
    else { errorLine.textContent = ""; errorLine.setAttribute("hidden", ""); }
  }
  function setDisabled(row, disabled) {
    row.querySelectorAll(".manifest-only input").forEach(function (i) { i.disabled = disabled; });
  }
  function refreshCounts() {
    if (manifestList && manifestCount) {
      var n = manifestList.querySelectorAll("li").length;
      manifestCount.textContent = String(n);
      if (manifestEmpty) { if (n === 0) manifestEmpty.removeAttribute("hidden"); else manifestEmpty.setAttribute("hidden", ""); }
    }
    if (originList) {
      var rows = originList.querySelectorAll("li");
      var shown = 0;
      rows.forEach(function (li) { if (!li.hasAttribute("hidden")) shown += 1; });
      if (originCount) originCount.textContent = String(shown) + " " + (shown === 1 ? WORDS.package : WORDS.packages);
      if (originEmpty) { if (rows.length === 0 || shown === 0) originEmpty.removeAttribute("hidden"); else originEmpty.setAttribute("hidden", ""); }
    }
  }
  function applyFilter() {
    if (!originList) return;
    var typed = filter ? filter.value : "";
    originList.querySelectorAll("li").forEach(function (li) {
      if (matches(li.getAttribute("data-tag"), typed)) li.removeAttribute("hidden"); else li.setAttribute("hidden", "");
    });
    refreshCounts();
  }
  function insertSorted(list, row) {
    var tag = row.getAttribute("data-tag");
    var next = null;
    list.querySelectorAll("li").forEach(function (li) {
      if (next) return;
      if (compareTags(li.getAttribute("data-tag"), tag) > 0) next = li;
    });
    if (next) list.insertBefore(row, next); else list.appendChild(row);
  }
  function addRow(row) {
    if (!manifestList) return;
    row.classList.add("in-manifest");
    row.removeAttribute("hidden");
    setDisabled(row, false);
    manifestList.appendChild(row);
    showError("");
    refreshCounts();
  }
  function removeRow(row) {
    if (!originList) return;
    row.classList.remove("in-manifest");
    setDisabled(row, true);
    var price = row.querySelector('input[name="prices"]');
    if (price) price.value = "";
    insertSorted(originList, row);
    applyFilter();
  }
  form.addEventListener("click", function (e) {
    var target = e.target;
    if (!(target instanceof Element)) return;
    var add = target.closest("[data-add]");
    if (add) { var r1 = add.closest("li"); if (r1) addRow(r1); return; }
    var remove = target.closest("[data-remove]");
    if (remove) { var r2 = remove.closest("li"); if (r2) removeRow(r2); }
  });
  if (filter) filter.addEventListener("input", applyFilter);
  if (originSelect) originSelect.addEventListener("change", function () {
    var v = originSelect.value;
    var dest = destSelect ? destSelect.value : "";
    var url = ${JSON.stringify(MANIFEST_PATH)} + (v ? "?origin=" + encodeURIComponent(v) + (dest ? "&dest=" + encodeURIComponent(dest) : "") : "");
    window.location.href = url;
  });
  function fillReceiveInto(license) {
    if (!receiveInto) return;
    var names = (DATA.locations && DATA.locations[license]) || [];
    var keep = receiveInto.value;
    receiveInto.innerHTML = "";
    var blank = document.createElement("option"); blank.value = ""; receiveInto.appendChild(blank);
    names.forEach(function (name) { var o = document.createElement("option"); o.value = name; o.textContent = name; receiveInto.appendChild(o); });
    if (names.indexOf(keep) >= 0) receiveInto.value = keep;
    if (receiveEmpty) { if (names.length === 0) receiveEmpty.removeAttribute("hidden"); else receiveEmpty.setAttribute("hidden", ""); }
    receiveInto.required = names.length > 0;
  }
  function prefillHeader(license) {
    var values = (DATA.prefill && DATA.prefill[license]) || {};
    form.querySelectorAll("[data-header-field]").forEach(function (field) {
      var mine = field.getAttribute("data-prefilled") === "1";
      if (field.value && !mine) return;
      var v = values[field.name];
      if (v) { field.value = v; field.setAttribute("data-prefilled", "1"); }
      else if (mine) { field.value = ""; field.removeAttribute("data-prefilled"); }
    });
  }
  form.querySelectorAll("[data-header-field]").forEach(function (field) {
    field.addEventListener("input", function () { field.removeAttribute("data-prefilled"); });
  });
  function onDestChange() {
    var license = destSelect ? destSelect.value : "";
    if (recipientValue) recipientValue.textContent = license || "-";
    fillReceiveInto(license);
    prefillHeader(license);
  }
  if (destSelect) { destSelect.addEventListener("change", onDestChange); onDestChange(); }
  // Capture phase, before the submit lock: a refused finish keeps its button live.
  form.addEventListener("submit", function (e) {
    var n = manifestList ? manifestList.querySelectorAll("li").length : 0;
    var refusal = (!destSelect || !destSelect.value) ? WORDS.noDestination : (n === 0 ? WORDS.noPackages : "");
    if (refusal) { e.preventDefault(); e.stopImmediatePropagation(); showError(refusal); return; }
    showError("");
  }, true);
  refreshCounts();
})();
</script>`;
}
