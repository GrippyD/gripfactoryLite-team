import { formatGrams, shortLotId } from "./config";
import type { FieldDestination, FieldLoadRow, FieldSentLoad, FieldToteRow, OpenHbnOption } from "./db";
import { etWallClock } from "./farmday";
import { esc } from "./ui";
import { t, tFill, type Locale } from "./i18n";

const PATH = "/station/field_harvest";

export type FieldHarvestPageInput = {
  locale: Locale;
  destinations: FieldDestination[];
  openLoads: FieldLoadRow[];
  sentLoads: FieldSentLoad[];
  picked: {
    load: FieldLoadRow;
    totes: FieldToteRow[];
    hbnOptions: OpenHbnOption[];
    carryId: string | null;
    finish: "" | "ask" | "warn";
    warnIds: string[];
  } | null;
};

function hbnSelect(
  name: string,
  options: OpenHbnOption[],
  selected: string,
  blank: boolean,
  locale: Locale,
  caption = true
): string {
  const known = options.some((row) => row.id === selected);
  const blankOpt = blank ? `<option value=""${known ? "" : " selected"}></option>` : "";
  const opts = options
    .map((row) => {
      const on = row.id === selected ? " selected" : "";
      return `<option value="${esc(row.id)}"${on}>${esc(row.label)} (${esc(row.hbn)})</option>`;
    })
    .join("");
  if (!caption) return `<select name="${esc(name)}" aria-label="${esc(t(locale, "HBN"))}">${blankOpt}${opts}</select>`;
  return `<label class="field">${esc(t(locale, "HBN"))}<select name="${esc(name)}">${blankOpt}${opts}</select></label>`;
}

function loadBack(loadId: string): string {
  return `${PATH}?load=${encodeURIComponent(loadId)}`;
}

export function fieldHarvestPage(input: FieldHarvestPageInput): string {
  const locale = input.locale;
  const picked = input.picked;
  const openItems = input.openLoads
    .map((load) => {
      const selected = picked?.load.id === load.id ? " selected" : "";
      const who = [load.operator_name, load.destination_name].filter(Boolean).join(" / ");
      return `<li><a class="queue-pane-item${selected}" href="${esc(PATH)}?load=${esc(load.id)}">${esc(who || load.destination_name)}</a></li>`;
    })
    .join("");
  const left = `<aside class="queue-pane">
      <p><a class="btn" href="${esc(PATH)}">${esc(t(locale, "Start a new load"))}</a></p>
      ${openItems ? `<ul>${openItems}</ul>` : `<p class="muted">${esc(t(locale, "No rows waiting."))}</p>`}
    </aside>`;
  const sent = input.sentLoads
    .map((load) => {
      const hbns = load.hbns
        .map((row) => `<li>${esc(shortLotId(row.hbn, null))} ${esc(formatGrams(row.grams))} g</li>`)
        .join("");
      return `<article data-sent-load="${esc(load.id)}">
          <p><strong>${esc(t(locale, "IN-TRANSIT"))}</strong></p>
          <p>${esc(load.operator_name ?? "")}</p>
          <p>${esc(load.destination_name)}</p>
          <p>${esc(t(locale, "Sent"))} <time datetime="${esc(load.sent_at ?? "")}">${esc(etWallClock(load.sent_at ?? ""))}</time></p>
          <p>${esc(String(load.tote_count))} ${esc(t(locale, Number(load.tote_count) === 1 ? "tote" : "totes"))} ${esc(formatGrams(load.grams))} g</p>
          ${hbns ? `<ul>${hbns}</ul>` : ""}
          <form method="post" action="${esc(PATH)}/load/${esc(load.id)}/reopen" class="field-reopen">
            <input type="password" name="pin" inputmode="numeric" autocomplete="off" placeholder="${esc(t(locale, "PIN"))}" aria-label="${esc(t(locale, "PIN"))}">
            <button type="submit" class="shuttle-btn" title="&lt;&lt;" aria-label="&lt;&lt;">&lt;&lt;</button>
          </form>
        </article>`;
    })
    .join("");
  // THE IN-TRANSIT RULE (canon 0.30.320): loads still in transit, however old.
  // A received load is absent, so it has no <<.
  const right = `<aside class="queue-pane" data-loads-sent>
      <h2>${esc(t(locale, "Loads sent"))} <span class="tile-count">${input.sentLoads.length}</span></h2>
      ${sent || `<p class="muted">${esc(t(locale, "- EMPTY -"))}</p>`}
    </aside>`;
  return `<h1>${esc(t(locale, "Penn South/Arlington Harvest"))}</h1>
    <div class="station-triple field-triple">
      ${left}
      <section class="working-pane field-working">${middle(input)}</section>
      ${right}
    </div>`;
}

function middle(input: FieldHarvestPageInput): string {
  const locale = input.locale;
  const picked = input.picked;
  if (!picked) return emptyHeader(input.destinations, locale);
  const load = picked.load;
  const header = `<dl class="lot-meta" data-field-load="${esc(load.id)}">
      <dt>${esc(t(locale, "Operator"))}</dt><dd>${esc(load.operator_name ?? "")}</dd>
      <dt>${esc(t(locale, "Destination"))}</dt><dd>${esc(load.destination_name)}</dd>
      <dt>${esc(t(locale, "Started"))}</dt><dd><time datetime="${esc(load.started_at)}">${esc(etWallClock(load.started_at))}</time></dd>
    </dl>`;
  return `${header}
    ${entryPane(picked, locale)}
    ${contentPane(picked, locale)}
    ${finishBlock(picked, locale)}`;
}

function emptyHeader(destinations: FieldDestination[], locale: Locale): string {
  const options = [`<option value="" selected></option>`]
    .concat(
      destinations.map((row) => `<option value="${esc(row.code)}">${esc(row.display_name)}</option>`)
    )
    .join("");
  return `<form method="post" action="${esc(PATH)}/start" class="stack" data-field-header>
      <label class="field">${esc(t(locale, "Operator"))} <input type="text" name="operator_name" autocomplete="off"></label>
      <label class="field">${esc(t(locale, "Destination"))} <select name="destination_farm_code">${options}</select></label>
      <button type="submit">${esc(t(locale, "START"))}</button>
    </form>`;
}

function entryPane(
  picked: NonNullable<FieldHarvestPageInput["picked"]>,
  locale: Locale
): string {
  return `<form method="post" action="${esc(PATH)}/load/${esc(picked.load.id)}/weights" class="field-entry" data-field-entry>
      <label class="field">${esc(t(locale, "Weight"))} <input type="number" name="weight_grams" min="0" step="1" inputmode="numeric" required></label>
      ${hbnSelect("harvest_batch_id", picked.hbnOptions, picked.carryId ?? "", true, locale)}
      <button type="submit" aria-label="+">+</button>
    </form>`;
}

function contentPane(
  picked: NonNullable<FieldHarvestPageInput["picked"]>,
  locale: Locale
): string {
  const count = picked.totes.length;
  if (count === 0) return `<p class="muted">${esc(t(locale, "No weights yet."))}</p>`;
  const back = loadBack(picked.load.id);
  const rows = picked.totes
    .map((tote, i) => {
      const n = count - i;
      const options = picked.hbnOptions.some((row) => row.id === tote.harvest_batch_id)
        ? picked.hbnOptions
        : [...picked.hbnOptions, { id: tote.harvest_batch_id, hbn: tote.hbn, label: shortLotId(tote.hbn, null) }];
      const edit = `/record/wet_weights/${encodeURIComponent(tote.id)}/edit?back=${encodeURIComponent(back)}`;
      const voidHref = `/record/wet_weights/${encodeURIComponent(tote.id)}/void?back=${encodeURIComponent(back)}`;
      return `<tr data-field-tote="${esc(tote.id)}" data-weight-seq="${n}">
          <td class="weight-seq">${n}</td>
          <td>${esc(formatGrams(tote.weight_grams))}</td>
          <td>${esc(shortLotId(tote.hbn, null))}</td>
          <td class="field-hbn-cell">
            <form method="post" action="${esc(PATH)}/weights/${esc(tote.id)}/hbn" class="field-tote-hbn" data-tote-hbn>
              ${hbnSelect("harvest_batch_id", options, tote.harvest_batch_id, false, locale, false)}
              <span class="field-tote-pin"><input type="password" name="pin" inputmode="numeric" autocomplete="off" placeholder="${esc(t(locale, "PIN"))}" aria-label="${esc(t(locale, "PIN"))}"><button type="submit">${esc(t(locale, "Change"))}</button></span>
            </form>
          </td>
          <td class="row-actions">
            <a class="btn secondary" href="${esc(edit)}" title="Edit" aria-label="Edit weight">&#9998;</a>
            <a class="btn secondary" href="${esc(voidHref)}" title="Void" aria-label="Void weight">&times;</a>
          </td>
        </tr>`;
    })
    .join("");
  return `<div class="field-table"><table class="data weights-numbered"><thead><tr>
      <th class="weight-seq">#</th>
      <th>${esc(t(locale, "Weight"))}</th>
      <th>${esc(t(locale, "Lot"))}</th>
      <th>${esc(t(locale, "HBN"))}</th>
      <th>${esc(t(locale, "Controls"))}</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function finishBlock(
  picked: NonNullable<FieldHarvestPageInput["picked"]>,
  locale: Locale
): string {
  const loadId = picked.load.id;
  const question = t(locale, "Would you like to finish any HBNs on this load?");
  const sure = t(
    locale,
    "Are you sure you want to finish adding weights to HBN(s): {list}? If finished, you will not be able to add any more weight without admin approval."
  );
  const no = `<form method="post" action="${esc(PATH)}/load/${esc(loadId)}/send">
      <button type="submit">${esc(t(locale, "NO"))}</button>
    </form>`;
  const groups = hbnGroups(picked.totes);
  const showList = picked.finish === "ask" || picked.finish === "warn";
  const boxes = groups
    .map((group) => {
      const label = `${shortLotId(group.hbn, null)} ${t(locale, "On this load")} ${formatGrams(group.onLoad)} g ${t(locale, "In all")} ${formatGrams(group.inAll)} g`;
      return `<label class="field-finish-item"><input type="checkbox" name="hbn" value="${esc(group.id)}" data-hbn-label="${esc(group.hbn)}"> ${esc(label)}</label>`;
    })
    .join("");
  const ask = `<div data-finish-list${showList ? "" : " hidden"}>
      <form method="get" action="${esc(PATH)}" data-finish-ask data-send="${esc(PATH)}/load/${esc(loadId)}/send" data-confirm="${esc(sure)}">
        <input type="hidden" name="load" value="${esc(loadId)}">
        <input type="hidden" name="finish" value="warn">
        ${boxes}
        <button type="submit">${esc(t(locale, "Confirm"))}</button>
      </form>
    </div>`;
  const warnNames = groups.filter((group) => picked.warnIds.includes(group.id)).map((group) => group.hbn);
  const warn =
    picked.finish === "warn"
      ? warnNames.length === 0
        ? `<p class="field-warn">${esc(t(locale, "Pick an HBN to finish, or send the load without finishing."))}</p>`
        : `<div class="field-warn" data-finish-warn>
            <p>${esc(tFill(locale, "Are you sure you want to finish adding weights to HBN(s): {list}? If finished, you will not be able to add any more weight without admin approval.", { list: warnNames.join(", ") }))}</p>
            <form method="post" action="${esc(PATH)}/load/${esc(loadId)}/send">
              ${warnNames
                .map((hbn) => {
                  const group = groups.find((row) => row.hbn === hbn);
                  return group ? `<input type="hidden" name="hbn" value="${esc(group.id)}">` : "";
                })
                .join("")}
              <button type="submit">${esc(t(locale, "Confirm"))}</button>
            </form>
            <p><a href="${esc(PATH)}?load=${esc(loadId)}">${esc(t(locale, "Go Back"))}</a></p>
          </div>`
      : "";
  return `<details class="field-finish" data-finish-load${showList ? " open" : ""}>
      <summary class="btn" data-finish-open>${esc(t(locale, "Finish Load"))}</summary>
      <p>${esc(question)}</p>
      <div class="row-actions">
        <a class="btn" href="${esc(PATH)}?load=${esc(loadId)}&amp;finish=ask" data-finish-yes>${esc(t(locale, "YES"))}</a>
        ${no}
      </div>
      ${ask}
      ${warn}
    </details>
    ${finishScript()}`;
}

function hbnGroups(totes: FieldToteRow[]): Array<{ id: string; hbn: string; onLoad: number; inAll: number }> {
  const groups = new Map<string, { id: string; hbn: string; onLoad: number; inAll: number }>();
  for (const tote of totes) {
    const cur = groups.get(tote.harvest_batch_id) ?? {
      id: tote.harvest_batch_id,
      hbn: tote.hbn,
      onLoad: 0,
      inAll: Number(tote.lot_grams),
    };
    cur.onLoad += Number(tote.weight_grams);
    groups.set(tote.harvest_batch_id, cur);
  }
  return [...groups.values()];
}

function finishScript(): string {
  return `<script>
(function () {
  var yes = document.querySelector("[data-finish-yes]");
  var list = document.querySelector("[data-finish-list]");
  if (yes && list) {
    yes.addEventListener("click", function (e) {
      e.preventDefault();
      list.hidden = false;
    });
  }
  document.querySelectorAll("[data-tote-hbn]").forEach(function (f) {
    var sel = f.querySelector("select");
    if (!sel) return;
    var was = sel.value;
    f.classList.add("js");
    sel.addEventListener("change", function () {
      if (sel.value === was) {
        f.classList.remove("changed");
        return;
      }
      f.classList.add("changed");
      var pin = f.querySelector('input[name="pin"]');
      if (pin) pin.focus();
    });
  });
  var form = document.querySelector("[data-finish-ask]");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    if (form.getAttribute("data-posting") === "1") return;
    e.preventDefault();
    var labels = [];
    form.querySelectorAll('input[name="hbn"]:checked').forEach(function (box) {
      labels.push(box.getAttribute("data-hbn-label") || box.value);
    });
    if (!labels.length) return;
    var msg = (form.getAttribute("data-confirm") || "").split("{list}").join(labels.join(", "));
    if (!window.confirm(msg)) return;
    form.setAttribute("data-posting", "1");
    form.method = "post";
    form.action = form.getAttribute("data-send") || form.action;
    form.submit();
  });
})();
</script>`;
}
