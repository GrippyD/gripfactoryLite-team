#!/usr/bin/env python3
"""Refresh the Harvest Menu's data from the harvest-plan workbook.

Usage:
    python refresh_data.py path/to/shmerblez.xlsx            # writes data.json next to this script
    python refresh_data.py path/to/shmerblez.xlsx --inline   # also rewrites the embedded data in index.html

Reads the PNN sheet (flat layout: Farm | Environment | Row Labels | Count of Tag |
Harvest order | Fdate | % of canopy | THC | Hang | Silo | ...). Rows with no plant
count, and the 'Early' / 'Grand Total' rows, are skipped. GH -> Greenhouse,
anything else -> Outdoor. Blank Hang/Silo means 100% silo.

Requires: pip install openpyxl
"""
import sys, json, re, datetime, pathlib
try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is required:  pip install openpyxl")

HERE = pathlib.Path(__file__).resolve().parent
SOURCE_URL = "https://ocgcompanies-my.sharepoint.com/personal/wallace_gripcannabis_com/Documents/shmerblez.xlsx"

def pct(v):
    if v is None or v == "": return None
    if isinstance(v, str):
        v = v.strip().rstrip("%")
        if not v: return None
        try: v = float(v)
        except ValueError: return None
        return v
    v = float(v)
    return round(v * 100 if v <= 1 else v, 2)

def to_date(v, year=None):
    year = year or datetime.date.today().year
    if v is None or v == "": return None
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    if isinstance(v, datetime.date): return v.isoformat()
    s = str(v).strip()
    for fmt in ("%d-%b-%Y", "%d-%b", "%m/%d/%Y", "%Y-%m-%d", "%b %d %Y", "%b %d"):
        try:
            d = datetime.datetime.strptime(s, fmt)
            if "%Y" not in fmt: d = d.replace(year=year)
            return d.date().isoformat()
        except ValueError: pass
    return None

def parse(path, sheet="PNN"):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[sheet] if sheet in wb.sheetnames else wb[wb.sheetnames[0]]
    rows = list(ws.iter_rows(values_only=True))
    hi = next((i for i, r in enumerate(rows) if r and any(str(c or "").strip() == "Row Labels" for c in r)), None)
    if hi is None: sys.exit("Header row with 'Row Labels' not found.")
    H = [str(c or "").strip().lower() for c in rows[hi]]
    def col(*names):
        for n in names:
            if n in H: return H.index(n)
        return -1
    c = dict(farm=col("farm","au","site"), env=col("environment","od/gh"), strain=col("row labels","strain"),
             cnt=col("count of tag","plants","count"), date=col("fdate","date","harvest date"),
             thc=col("thc"), hang=col("hang"), silo=col("silo"), order=col("harvest order (rough)","harvest order"))
    if c["strain"] < 0 or c["cnt"] < 0: sys.exit("Missing 'Row Labels' or 'Count of Tag' column.")
    out, farm, rid = [], None, 0
    for r in rows[hi+1:]:
        if not r: continue
        strain = r[c["strain"]]
        if strain is None or not str(strain).strip(): continue
        if c["farm"] >= 0 and r[c["farm"]]: farm = str(r[c["farm"]]).strip()
        s = str(strain).strip()
        if re.fullmatch(r"(?i)row labels|grand total|early", s): continue
        try: plants = int(float(r[c["cnt"]] or 0))
        except (TypeError, ValueError): plants = 0
        if not plants: continue
        h = pct(r[c["hang"]]) if c["hang"] >= 0 else None
        si = pct(r[c["silo"]]) if c["silo"] >= 0 else None
        if h is None and si is None: h = 0
        elif h is None: h = 100 - si
        envraw = str(r[c["env"]] or "").strip().upper() if c["env"] >= 0 else ""
        env = "GH" if envraw == "GH" else ("IN" if envraw == "IN" else "OD")
        rid += 1
        out.append(dict(id=rid, site=farm or "—", env=env, strain=s, plants=plants,
                        date=to_date(r[c["date"]]) if c["date"] >= 0 else None,
                        thc=pct(r[c["thc"]]) if c["thc"] >= 0 else None,
                        hang=int(round(max(0, min(100, h)))),
                        order=(float(r[c["order"]]) if c["order"] >= 0 and r[c["order"]] not in (None, "") else None)))
    if not out: sys.exit("No strain rows found.")
    return out, ws.title

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    src = pathlib.Path(sys.argv[1])
    rows, sheet = parse(src)
    meta = dict(url=SOURCE_URL, file=src.name, sheet=sheet,
                asOf=datetime.datetime.fromtimestamp(src.stat().st_mtime).strftime("%Y-%m-%d %H:%M") + " (file)",
                method="refresh_data.py")
    (HERE / "data.json").write_text(json.dumps(dict(meta=meta, rows=rows), indent=1))
    print(f"data.json: {len(rows)} lots, {sum(r['plants'] for r in rows):,} plants, {sum(r['plants'] for r in rows)*6:,} lb biomass")
    if "--inline" in sys.argv:
        p = HERE / "index.html"; html = p.read_text()
        block = ("/*DATA-START*/\nconst SOURCE_META=" + json.dumps(meta) + ";\nconst SOURCE_ROWS=" +
                 json.dumps(rows, separators=(",", ":")) + ";\n/*DATA-END*/\n")
        new, n = re.subn(r"/\*DATA-START\*/[\s\S]*?/\*DATA-END\*/\n", lambda m: block, html)
        if n != 1: sys.exit("Data markers not found in index.html")
        p.write_text(new); print("index.html: embedded data updated")

if __name__ == "__main__":
    main()
