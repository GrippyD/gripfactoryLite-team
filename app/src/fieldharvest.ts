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
  /** FINISHED LOTS, FOUND (canon 0.30.373): the lots weighing here whose totes are not all on this load, rendered. */
  lotsSoFar?: string;
  /** The lot a Reopen landed on; the open loads' links carry it. */
  focusLotId?: string | null;
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
  // THE HBN ENTRY (canon 0.30.341): each HBN's form and silo ride its option text ("... Bucked Silo 1").
  const opts = options
    .map((row) => {
      const on = row.id === selected ? " selected" : "";
      const landing = row.form ? ` ${t(locale, row.form === "bucked" ? "Bucked" : "Spear")}${row.silo ? ` ${row.silo}` : ""}` : "";
      return `<option value="${esc(row.id)}"${on}>${esc(row.label)} (${esc(row.hbn)})${esc(landing)}</option>`;
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
      const focus = input.focusLotId ? `&lot=${encodeURIComponent(input.focusLotId)}` : "";
      return `<li><a class="queue-pane-item${selected}" href="${esc(`${PATH}?load=${encodeURIComponent(load.id)}${focus}`)}">${esc(who || load.destination_name)}</a></li>`;
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
  if (!picked) return `${input.lotsSoFar ?? ""}${emptyHeader(input.destinations, locale)}`;
  const load = picked.load;
  const header = `<dl class="lot-meta" data-field-load="${esc(load.id)}">
      <dt>${esc(t(locale, "Operator"))}</dt><dd>${esc(load.operator_name ?? "")}</dd>
      <dt>${esc(t(locale, "Destination"))}</dt><dd>${esc(load.destination_name)}</dd>
      <dt>${esc(t(locale, "Started"))}</dt><dd><time datetime="${esc(load.started_at)}">${esc(etWallClock(load.started_at))}</time></dd>
    </dl>`;
  // THE FINISH LOAD IN REACH (canon 0.30.335). Owner, 2026-10-01, verbatim:
  // "finish load button on alrington Penn Spouth Harvest doesn't do anything".
  // It did open, but under a long list of totes the person scrolls until the
  // button shows at the bottom of the screen, and the question opened below the
  // edge. His V15 ruling put [Finish Load] in the entry pane after "+", so the
  // block sits right under the entry row, above the totes; its script comes
  // after the totes so it finds every row.
  return `${header}
    ${entryPane(picked, locale)}
    ${finishBlock(picked, locale)}
    ${contentPane(picked, locale)}
    ${input.lotsSoFar ?? ""}
    ${finishScript()}`;
}

function emptyHeader(destinations: FieldDestination[], locale: Locale): string {
  const options = [`<option value="" selected></option>`]
    .concat(
      destinations.map((row) => `<option value="${esc(row.code)}">${esc(row.display_name)}</option>`)
    )
    .join("");
  return `<form method="post" action="${esc(PATH)}/start" class="stack" data-field-header>
      <label class="field">${esc(t(locale, "Operator"))} <input type="text" name="operator_name" required autocomplete="off" data-keep-operator></label>
      <label class="field">${esc(t(locale, "Destination"))} <select name="destination_farm_code">${options}</select></label>
      <button type="submit">${esc(t(locale, "START"))}</button>
    </form>`;
}

/** THE PLUS KEEPS THE CURSOR (canon 0.30.334). Owner, 2026-10-01, verbatim:
 * "when the wet weight entry screen has the "+" pushed, the screen refreshes
 * and the operator needs to refind the cursor and click on the weight entry.
 * They're doing this 3500 times a day. Can we fix it so they can type, hit +
 * and type again without the exercise?" The Weight box takes the cursor when
 * the page loads (autofocus, the path without script); the script keeps it
 * there: the + press does not take the focus, the + key typed in the box is
 * the + button, and the post goes in the background, so the page never
 * reloads and a tablet's keyboard stays up. The box clears as the weight
 * leaves; the totes and the Finish Load block come back from the server's
 * own page and replace the old ones; a refusal or no answer puts the weight
 * back with the words under the form. */
function entryPane(
  picked: NonNullable<FieldHarvestPageInput["picked"]>,
  locale: Locale
): string {
  return `<form method="post" action="${esc(PATH)}/load/${esc(picked.load.id)}/weights" class="field-entry" data-field-entry>
      <label class="field">${esc(t(locale, "Weight"))} <input type="number" name="weight_grams" min="0" step="1" inputmode="numeric" required autofocus data-field-weight></label>
      ${hbnSelect("harvest_batch_id", picked.hbnOptions, picked.carryId ?? "", !picked.carryId || !picked.hbnOptions.some((row) => row.id === picked.carryId), locale)}
      <button type="submit" aria-label="+" data-field-plus>+</button>
      <p class="banner err field-entry-status" data-field-status data-no-answer="${esc(
        t(locale, "No answer from the server. Check the list before you add it again.")
      )}" role="status" aria-live="polite" hidden></p>
      ${fieldEntryScript()}
    </form>`;
}

/** The script of the entry form. It sits inside the form, which the background
 * post never replaces, so it runs once; the panes after the form are replaced
 * from the server's page and their own script runs again on the new nodes. */
function fieldEntryScript(): string {
  return `<script>
(function () {
  var form = document.querySelector("form[data-field-entry]");
  if (!form) return;
  var box = form.querySelector("[data-field-weight]");
  var plus = form.querySelector("[data-field-plus]");
  var status = form.querySelector("[data-field-status]");
  if (!box) return;
  var canPost = !!(window.fetch && window.DOMParser && window.FormData);
  var busy = false;
  var again = false;
  function keep() {
    var a = document.activeElement;
    if (a === box) return;
    if (a && a !== document.body && a !== plus) return;
    try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
  }
  function say(text) {
    if (!status) return;
    status.textContent = text || "";
    status.hidden = !text;
  }
  function noAnswer() { return (status && status.getAttribute("data-no-answer")) || ""; }
  if (plus) {
    plus.addEventListener("mousedown", function (e) { e.preventDefault(); });
    plus.addEventListener("pointerdown", function (e) { e.preventDefault(); });
  }
  box.addEventListener("keydown", function (e) {
    if (e.key !== "+") return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (canPost) post(); else form.submit();
  });
  if (!canPost) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    post();
  });
  var hbnKey = "gf_field_hbn:" + (form.getAttribute("action") || "");
  function keep() {
    var s = form.querySelector('select[name="harvest_batch_id"]');
    try { if (s && s.value) localStorage.setItem(hbnKey, s.value); } catch (e) {}
  }
  (function restore() {
    var s = form.querySelector('select[name="harvest_batch_id"]');
    if (!s) return;
    try {
      var v = localStorage.getItem(hbnKey);
      if (v && s.querySelector('option[value="' + v + '"]')) s.value = v;
    } catch (e) {}
    s.addEventListener("change", keep);
  })();
  function swap(doc) {
    var fresh = doc.querySelector("form[data-field-entry]");
    var pane = form.parentNode;
    if (!fresh || !pane) return false;
    while (form.nextSibling) pane.removeChild(form.nextSibling);
    for (var n = fresh.nextSibling; n; n = n.nextSibling) pane.appendChild(document.importNode(n, true));
    var runs = pane.querySelectorAll("script");
    for (var i = 0; i < runs.length; i++) {
      if (form.contains(runs[i])) continue;
      var s = document.createElement("script");
      s.text = runs[i].text;
      runs[i].parentNode.replaceChild(s, runs[i]);
    }
    var sel = form.querySelector('select[name="harvest_batch_id"]');
    var freshSel = fresh.querySelector('select[name="harvest_batch_id"]');
    if (sel && freshSel) {
      // THE HBN KEPT (canon 0.30.346): the HBN this tablet picked stays picked from "+" to "+"; the server's list
      // replaces the options, never the pick, while the pick is still on the list.
      var kept = sel.value;
      sel.innerHTML = freshSel.innerHTML;
      sel.value = kept && sel.querySelector('option[value="' + kept + '"]') ? kept : freshSel.value;
      keep();
    }
    var main = document.querySelector("main");
    var freshMain = doc.querySelector("main");
    if (main && freshMain) {
      var old = main.querySelectorAll(":scope > .banner");
      for (var j = 0; j < old.length; j++) main.removeChild(old[j]);
      var head = main.querySelector(":scope > h1");
      var come = freshMain.querySelectorAll(":scope > .banner");
      for (var k = 0; k < come.length; k++) main.insertBefore(document.importNode(come[k], true), head || main.firstChild);
    }
    return true;
  }
  function refresh() {
    fetch(location.href, { credentials: "same-origin" })
      .then(function (res) { return res.ok ? res.text() : ""; })
      .then(function (html) { if (html) swap(new DOMParser().parseFromString(html, "text/html")); })
      .catch(function () {});
  }
  function post() {
    if (busy) { again = true; return; }
    var sent = box.value;
    if (!sent) return;
    busy = true;
    again = false;
    var data = new FormData(form);
    box.value = "";
    say("");
    function fail(text) {
      again = false;
      if (!box.value) box.value = sent;
      say(sent + " g: " + text);
    }
    fetch(form.action, { method: "POST", body: data, credentials: "same-origin" })
      .then(function (res) {
        return res.text().then(function (html) { return { res: res, doc: new DOMParser().parseFromString(html, "text/html") }; });
      })
      .then(function (r) {
        if (!r.res.ok) {
          var err = r.doc.querySelector(".banner.err");
          fail((err && err.textContent) || noAnswer());
          return;
        }
        if (!swap(r.doc)) { location.assign(r.res.url || location.href); return; }
        if (history.replaceState && r.res.url) history.replaceState(null, "", r.res.url);
      })
      .catch(function () { fail(noAnswer()); refresh(); })
      .then(function () {
        busy = false;
        keep();
        if (again) {
          again = false;
          if (box.value && form.checkValidity()) post();
        }
      });
  }
})();
</script>`;
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
    </details>`;
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
  var block = document.querySelector("details.field-finish");
  function show(el) {
    if (!el || !el.scrollIntoView) return;
    try { el.scrollIntoView({ block: "nearest" }); } catch (e) { el.scrollIntoView(false); }
  }
  if (block) {
    block.addEventListener("toggle", function () {
      if (block.open) show(block);
    });
  }
  if (yes && list) {
    yes.addEventListener("click", function (e) {
      e.preventDefault();
      list.hidden = false;
      show(list);
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
    if (!labels.length) {
      form.setAttribute("data-posting", "1");
      form.submit();
      return;
    }
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
