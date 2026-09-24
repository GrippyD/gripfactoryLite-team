import { t, type Locale } from "./i18n";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Owner ruling 2026-09-06 (canon 0.26.0, the hover help law): help text leaves
 * the screen everywhere and rides hover instead; the whole field carries its
 * help as a native title tooltip. */
export function fieldHelp(_locale: Locale, _help: string): string {
  return "";
}

export function fieldBlock(
  locale: Locale,
  label: string,
  control: string,
  help: string
): string {
  return `<label class="field" title="${esc(t(locale, help))}">${esc(t(locale, label))}
    ${control}
  </label>`;
}

export function rapidAddButton(locale: Locale): string {
  return `<button type="submit" class="secondary rapid-add" name="rapid_add" value="1" aria-label="${esc(t(locale, "Add and continue"))}" title="${esc(t(locale, "Add and continue"))}">+</button>`;
}

export function rapidFocusScript(focus: boolean): string {
  if (!focus) return "";
  return `<script>
(function () {
  var input = document.querySelector("[data-rapid-focus]");
  if (input && input.focus) input.focus();
})();
</script>`;
}

export function pencilLink(href: string, locale: Locale, label: string): string {
  return `<a class="btn secondary" href="${esc(href)}" title="${esc(t(locale, "Edit"))}" aria-label="${esc(t(locale, label))}">&#9998;</a>`;
}

export function voidLink(href: string, locale: Locale, label: string): string {
  return `<a class="btn secondary" href="${esc(href)}" title="${esc(t(locale, "Void"))}" aria-label="${esc(t(locale, label))}">&times;</a>`;
}

export function statusPill(status: string, locale: Locale): string {
  const cls = `status-pill status-${esc(status)}`;
  return `<span class="${cls}">${esc(t(locale, status))}</span>`;
}

export function tabBar(
  locale: Locale,
  tabs: Array<{ href: string; key: string; label: string }>,
  active: string
): string {
  const links = tabs
    .map((tab) => {
      const on = tab.key === active ? " aria-current=\"page\"" : "";
      return `<a class="tab-link${tab.key === active ? " tab-on" : ""}" href="${esc(tab.href)}" data-tab="${esc(tab.key)}"${on}>${esc(t(locale, tab.label))}</a>`;
    })
    .join("");
  return `<nav class="tab-bar">${links}</nav>`;
}
