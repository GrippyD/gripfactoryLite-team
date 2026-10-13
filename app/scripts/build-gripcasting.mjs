/* Bundle the vendored GRIPCasting browser app into public/models/gripcasting/.
 * esbuild is the copy wrangler already installs. No new package.
 * SheetJS stays a dynamic import and loads from cdnjs the first time a workbook
 * is read or exported. The fetch base is /models/gripcasting/api/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appRoot, "public", "models", "gripcasting");
const vendorWeb = join(appRoot, "vendor", "gripcasting");
const modelDir = join(appRoot, "src", "gripcasting");
const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

function plain(text) {
  return text.replaceAll("\u2013", "-").replaceAll("\u2014", "-").replaceAll("\u2212", "-").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  absWorkingDir: appRoot,
  entryPoints: [join(vendorWeb, "src", "web", "app.ts")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: join(outDir, "app.js"),
  legalComments: "none",
  plugins: [
    {
      name: "gripcasting-bundle",
      setup(build) {
        build.onResolve({ filter: /^\.\.\/shared\/(model|types)$/ }, (args) => ({
          path: join(modelDir, args.path.endsWith("types") ? "types.ts" : "model.ts"),
        }));
        build.onResolve({ filter: /^xlsx$/ }, () => ({ path: "xlsx", namespace: "sheetjs-cdn" }));
        build.onLoad({ filter: /.*/, namespace: "sheetjs-cdn" }, () => ({
          loader: "js",
          contents: `
            let ready;
            function loadSheetJs() {
              const host = globalThis;
              if (host.XLSX) return Promise.resolve(host.XLSX);
              if (!ready) {
                ready = new Promise((resolve, reject) => {
                  const script = document.createElement("script");
                  script.src = ${JSON.stringify(XLSX_URL)};
                  script.onload = () => (host.XLSX ? resolve(host.XLSX) : reject(new Error("SheetJS did not load.")));
                  script.onerror = () => reject(new Error("SheetJS did not load."));
                  document.head.appendChild(script);
                });
              }
              return ready;
            }
            const XLSX = await loadSheetJs();
            export const read = XLSX.read.bind(XLSX);
            export const write = XLSX.write.bind(XLSX);
            export const utils = XLSX.utils;
          `,
        }));
      },
    },
  ],
});

const jsPath = join(outDir, "app.js");
let js = plain(readFileSync(jsPath, "utf8"));
js = js.replaceAll('fetch("/api/" + path', 'fetch("/models/gripcasting/api/" + path');
if (!js.includes('"/models/gripcasting/api/"')) {
  throw new Error("the bundle did not pick up the API base");
}
writeFileSync(jsPath, js.endsWith("\n") ? js : js + "\n", "utf8");

const html = plain(readFileSync(join(vendorWeb, "index.html"), "utf8"))
  .replace('href="/src/web/styles.css"', 'href="styles.css"')
  .replace('src="/src/web/app.ts"', 'src="app.js"');
writeFileSync(join(outDir, "index.html"), html.endsWith("\n") ? html : html + "\n", "utf8");
const css = plain(readFileSync(join(vendorWeb, "src", "web", "styles.css"), "utf8"));
writeFileSync(join(outDir, "styles.css"), css.endsWith("\n") ? css : css + "\n", "utf8");
console.log("gripcasting bundle written");
