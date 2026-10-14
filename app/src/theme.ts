import { DEFAULT_VIEW, type ViewName } from "./config";
import { labelEditorStyles } from "./labeleditor";

/** Owner ruling 2026-09-01 (brand slice): the brand marks, inlined once here
 * so every surface (the bar lockup, the view pill's CO segment, the boot
 * scrawl) renders them as currentColor inline SVG. The path data is copied
 * verbatim from public/brand/grip.svg and public/brand/co-mark.svg; the same
 * files serve raw at /brand/:file for img and external use. */
const GRIP_MARK_PATH = "M866.8 1343.2L866.5 946.5L802.0 946.5L737.5 946.5L737.0 1303.5C736.7 1540.7 736.2 1660.4 735.5 1660.3C735.0 1660.2 726.2 1655.5 716.0 1649.9C689.5 1635.4 687.6 1634.3 681.8 1631.1C656.5 1617.4 651.8 1614.8 624.5 1599.8C614.0 1594.0 602.4 1587.6 598.5 1585.5C594.6 1583.4 590.9 1581.3 590.2 1580.7C589.3 1580.0 589.0 1440.3 589.0 888.5C589.0 231.5 589.1 197.2 590.8 195.8C591.7 194.9 599.2 190.1 607.5 185.0C615.8 179.9 625.4 173.9 629.0 171.7C632.6 169.5 638.3 165.9 641.8 163.8C645.2 161.7 650.8 158.3 654.2 156.1C657.7 154.0 668.4 147.4 678.0 141.5C706.0 124.3 708.1 122.9 715.2 118.3C718.9 116.0 722.2 114.0 722.6 114.0C722.9 114.0 725.0 112.7 727.3 111.1C729.6 109.5 733.1 107.3 735.0 106.3C736.9 105.2 750.6 96.7 765.5 87.5C780.4 78.3 794.5 69.5 797.0 68.0C799.5 66.5 805.3 62.9 810.0 60.0C814.7 57.1 820.5 53.5 823.0 52.0C825.5 50.5 831.3 46.9 836.0 44.0C840.7 41.1 852.0 34.1 861.2 28.5L877.9 18.2L895.7 29.2C905.5 35.3 916.3 42.0 919.8 44.1C923.2 46.3 929.0 49.9 932.8 52.2C936.5 54.5 942.2 58.0 945.5 60.0C948.8 62.1 958.0 67.8 966.0 72.7C974.0 77.6 988.0 86.3 997.2 92.0L1014.0 102.4L1014.0 428.5L1014.0 754.5L1000.2 763.6C992.7 768.6 978.1 778.3 967.8 785.0C957.4 791.7 949.0 797.6 949.0 798.1C949.0 798.6 963.0 799.0 981.5 799.0L1014.0 799.0L1014.0 1229.3L1014.0 1659.6L1010.8 1661.3C1006.6 1663.4 994.2 1670.2 986.7 1674.6C983.5 1676.5 980.7 1678.0 980.5 1678.0C980.3 1678.0 977.9 1679.3 975.3 1680.8C972.7 1682.4 966.9 1685.6 962.5 1688.0C958.1 1690.4 952.9 1693.2 951.0 1694.3C949.1 1695.4 945.5 1697.4 943.0 1698.8C940.5 1700.2 931.1 1705.4 922.0 1710.5C912.9 1715.6 902.4 1721.4 898.5 1723.5C894.6 1725.6 889.3 1728.6 886.7 1730.2C884.1 1731.7 881.7 1733.0 881.5 1733.0C881.3 1733.0 878.4 1734.6 875.1 1736.5C871.9 1738.4 868.7 1740.0 868.1 1740.0C867.3 1740.0 866.9 1626.6 866.8 1343.2ZM1092.0 889.0C1092.0 299.7 1092.2 162.0 1093.3 162.0C1094.0 162.0 1095.5 162.7 1096.6 163.5C1098.9 165.1 1113.7 174.2 1118.5 177.0C1120.2 178.0 1128.7 183.2 1137.5 188.5C1159.4 201.9 1186.8 218.6 1196.5 224.4C1200.9 227.1 1207.2 230.9 1210.5 233.0C1213.8 235.0 1221.8 240.0 1228.2 243.9L1240.0 251.1L1240.0 892.4C1240.0 1501.9 1239.9 1533.8 1238.2 1535.2C1236.8 1536.4 1216.6 1547.8 1182.5 1566.5C1179.8 1568.0 1176.2 1570.0 1174.5 1571.0C1172.8 1572.0 1168.8 1574.2 1165.5 1576.0C1158.1 1580.0 1156.2 1581.1 1124.5 1598.8C1101.7 1611.5 1093.4 1616.0 1092.6 1616.0C1092.3 1616.0 1092.0 1288.9 1092.0 889.0ZM505.4 1533.1C504.9 1532.6 501.8 1530.8 498.5 1529.0C495.2 1527.2 491.1 1525.0 489.5 1524.0C487.9 1523.0 484.4 1521.1 481.8 1519.6C479.1 1518.2 475.1 1515.9 472.8 1514.6C470.4 1513.3 465.8 1510.8 462.5 1509.0C459.2 1507.2 453.6 1504.1 450.0 1502.0C446.4 1499.9 440.8 1496.8 437.5 1495.0C432.3 1492.1 401.4 1474.9 386.8 1466.7C378.9 1462.3 373.8 1459.5 367.5 1456.0C364.2 1454.2 360.1 1452.0 358.5 1451.0C356.9 1450.0 353.4 1448.1 350.8 1446.6C345.5 1443.7 342.5 1442.1 324.0 1431.7C317.1 1427.8 309.5 1423.6 307.0 1422.2C304.5 1420.9 301.1 1419.0 299.5 1418.0C297.9 1417.0 294.4 1415.1 291.8 1413.6C289.1 1412.2 285.0 1409.9 282.5 1408.5C280.0 1407.1 276.0 1404.9 273.5 1403.5C271.0 1402.1 267.0 1399.9 264.5 1398.5C262.0 1397.1 258.0 1394.9 255.5 1393.5C253.0 1392.1 248.9 1389.8 246.2 1388.3C243.6 1386.9 232.5 1380.7 221.5 1374.5C210.5 1368.4 199.4 1362.1 196.8 1360.7C192.3 1358.2 190.2 1357.0 178.8 1350.6C176.4 1349.3 172.4 1347.1 169.8 1345.6C167.1 1344.2 163.1 1341.9 160.8 1340.6C158.4 1339.3 154.9 1337.4 153.0 1336.3C149.2 1334.2 105.7 1309.9 100.0 1306.7C87.8 1300.0 85.3 1298.5 83.8 1297.2C82.1 1295.8 82.0 1275.9 82.0 906.4L82.0 517.1L91.0 511.0C95.9 507.7 100.2 505.0 100.5 505.0C100.8 505.0 104.7 502.6 109.3 499.6C119.6 493.0 135.3 482.9 153.5 471.5C166.7 463.2 173.4 459.0 195.3 445.1C200.3 441.9 215.8 432.2 229.5 423.5C243.2 414.9 258.1 405.5 262.5 402.7C266.9 399.9 274.7 395.0 279.8 391.8C284.8 388.6 293.2 383.3 298.2 380.1C303.3 376.9 314.5 369.8 323.0 364.5C331.5 359.2 342.7 352.1 347.8 348.9C356.5 343.3 364.8 338.1 383.5 326.3C387.9 323.5 396.4 318.1 402.5 314.3C408.6 310.5 419.8 303.4 427.5 298.5C435.2 293.7 445.6 287.2 450.5 284.0C488.8 259.6 507.4 248.0 508.1 248.0C508.6 248.0 509.0 376.5 509.0 552.0L509.0 856.0L435.5 856.0L362.0 856.0L362.0 692.0C362.0 565.4 361.7 528.0 360.8 528.0C359.7 528.0 354.5 531.2 323.0 551.3C304.5 563.1 290.9 571.8 278.5 579.7C242.9 602.3 233.3 608.5 231.8 609.8C230.1 611.2 230.0 626.6 230.0 907.1L230.0 1202.9L239.1 1208.7C244.1 1211.9 254.2 1218.4 261.6 1223.2C269.1 1228.1 275.3 1232.0 275.5 1232.0C275.8 1232.0 281.2 1235.4 287.7 1239.6C300.0 1247.6 305.5 1251.1 336.0 1270.5C346.2 1277.0 355.7 1283.1 357.2 1284.1C358.7 1285.2 360.4 1286.0 361.0 1286.0C361.7 1286.0 362.0 1249.4 362.0 1169.1C362.0 1065.5 361.8 1052.1 360.5 1051.6C359.6 1051.3 349.9 1051.1 338.7 1051.1L318.5 1051.2L318.2 977.6L318.0 904.0L413.5 904.0L509.0 904.0L509.0 1219.0C509.0 1544.2 509.1 1536.5 505.4 1533.1ZM1309.6 1493.3C1308.5 1492.2 1308.9 296.0 1310.0 296.0C1310.8 296.0 1340.3 314.1 1375.5 336.3C1379.9 339.1 1386.9 343.5 1391.0 346.1C1397.4 350.1 1426.9 368.5 1455.2 386.2C1459.5 388.8 1466.6 393.2 1471.0 396.0C1475.4 398.8 1482.5 403.2 1486.8 405.8C1491.0 408.5 1503.7 416.4 1515.0 423.5C1526.3 430.6 1538.4 438.1 1542.0 440.3C1545.6 442.5 1550.4 445.6 1552.7 447.1C1555.0 448.7 1557.1 450.0 1557.4 450.0C1557.8 450.0 1561.7 452.4 1566.3 455.4C1575.2 461.3 1640.5 502.1 1645.7 505.1C1647.4 506.1 1651.4 508.5 1654.4 510.4C1666.1 517.9 1671.0 521.0 1688.0 531.5C1697.6 537.5 1705.8 542.8 1706.2 543.4C1706.6 544.0 1706.9 682.4 1706.7 851.0L1706.5 1157.5L1581.5 1158.0L1456.5 1158.5L1456.0 1285.8L1455.5 1413.2L1429.5 1427.6C1415.2 1435.6 1400.1 1444.0 1396.0 1446.2C1391.9 1448.5 1386.9 1451.2 1385.0 1452.3C1383.1 1453.4 1379.5 1455.4 1377.0 1456.8C1374.5 1458.1 1369.9 1460.8 1366.7 1462.6C1363.5 1464.5 1360.7 1466.0 1360.5 1466.0C1360.3 1466.0 1356.3 1468.2 1351.5 1471.0C1346.7 1473.8 1342.7 1476.0 1342.5 1476.0C1342.4 1476.0 1338.0 1478.4 1332.9 1481.3C1313.1 1492.5 1310.3 1493.9 1309.6 1493.3ZM1560.0 810.1L1560.0 610.2L1555.2 607.2C1552.6 605.6 1542.6 599.4 1533.0 593.5C1523.4 587.6 1512.7 581.0 1509.2 578.9C1502.0 574.4 1492.7 568.6 1483.8 563.2C1480.3 561.1 1474.6 557.5 1471.0 555.3C1459.3 548.1 1457.3 547.0 1456.7 547.7C1455.8 548.5 1455.8 1008.5 1456.7 1009.3C1457.0 1009.7 1480.4 1010.0 1508.7 1010.0L1560.0 1010.0L1560.0 810.1ZM757.2 747.2C767.7 740.2 796.6 721.0 821.4 704.4L866.5 674.3L866.8 424.1C866.9 284.3 866.6 174.0 866.1 174.0C865.7 174.0 850.7 182.6 832.9 193.1C815.1 203.7 798.9 213.2 797.0 214.3C795.1 215.3 792.3 217.1 790.8 218.1C789.4 219.2 788.0 220.0 787.7 220.0C787.4 220.0 783.6 222.2 779.2 224.9C774.8 227.6 770.9 229.9 770.4 230.1C769.1 230.6 745.4 244.6 740.8 247.6L737.0 250.0L737.0 505.0C737.0 645.3 737.2 760.0 737.5 760.0C737.8 760.0 746.6 754.3 757.2 747.2Z";
const CO_MARK_PATH = "M101.0 250.9C63.8 242.1 38.8 222.8 23.5 191.2C17.7 179.2 17.0 177.7 16.4 174.0C16.1 172.1 15.1 168.2 14.2 165.5C11.4 157.2 11.8 130.3 14.9 117.5C16.2 112.0 17.9 106.6 18.7 105.5C19.4 104.4 20.0 103.0 20.0 102.2C20.0 101.0 24.8 90.7 27.3 86.5C36.8 70.9 52.9 55.2 67.5 47.4C72.3 44.8 73.8 44.1 78.0 42.1C89.7 36.8 98.1 34.9 116.0 33.4C126.5 32.6 150.4 35.4 157.0 38.3C158.9 39.2 163.6 41.1 167.3 42.7C175.4 46.0 176.9 48.0 174.4 51.8C172.5 54.6 170.3 58.4 167.6 63.5C166.7 65.2 164.9 68.3 163.6 70.5C162.2 72.7 160.5 75.8 159.7 77.5C157.5 82.2 155.3 83.7 152.8 82.1C141.3 75.0 115.7 73.1 100.7 78.4C97.0 79.7 93.5 81.2 92.8 81.7C92.1 82.3 90.5 83.1 89.3 83.4C81.2 85.9 65.8 102.3 60.3 114.5C59.5 116.2 58.4 118.3 57.9 119.3C56.5 121.9 54.0 136.6 54.0 142.5C54.0 148.4 56.4 163.0 57.9 165.7C58.4 166.7 60.2 170.4 61.9 174.0C65.1 180.8 71.1 188.7 77.0 193.7C82.1 198.1 90.8 204.0 92.1 204.0C92.7 204.0 94.9 204.8 96.9 205.9C101.7 208.4 115.2 211.3 122.0 211.3C128.9 211.3 142.3 208.4 147.2 205.9C149.2 204.9 151.5 204.0 152.3 204.0C153.0 204.0 156.1 202.2 159.0 200.0C161.9 197.8 164.9 196.0 165.5 196.0C167.2 196.0 177.7 185.4 180.7 180.6C185.3 173.4 187.0 164.4 187.0 146.0C187.2 109.3 189.6 98.3 201.6 80.0C207.1 71.5 209.3 69.3 221.4 59.9C235.6 48.8 235.7 48.8 244.1 44.8C261.8 36.2 273.0 33.7 293.0 33.6C312.0 33.5 324.1 35.8 338.0 42.1C342.2 44.1 343.7 44.8 348.5 47.4C366.3 56.9 383.1 74.8 392.9 94.7C394.6 98.1 396.0 101.5 396.0 102.2C396.0 103.0 396.6 104.4 397.3 105.5C398.1 106.6 399.9 112.7 401.5 119.1C404.0 129.8 404.2 132.0 403.8 145.6C403.3 160.7 400.9 173.9 397.5 180.2C396.7 181.6 396.0 183.4 396.0 184.2C395.9 185.7 392.4 193.0 389.6 197.5C388.5 199.2 386.4 202.5 384.8 205.0C377.4 216.7 361.1 231.9 349.4 238.0C346.2 239.7 343.1 241.5 342.5 241.9C339.8 243.8 325.8 248.4 314.5 251.0C307.5 252.6 277.2 252.2 271.0 250.5C268.0 249.6 263.7 248.5 261.5 248.0C257.0 247.0 246.8 242.9 244.8 241.3C244.1 240.8 242.7 240.0 241.8 239.7C239.9 239.0 239.3 235.5 240.9 234.5C242.1 233.8 252.2 216.0 256.3 207.2C258.2 203.3 262.8 202.8 268.8 205.9C273.7 208.4 287.1 211.3 294.0 211.3C300.9 211.3 314.3 208.4 319.2 205.9C321.2 204.9 323.4 204.0 324.0 204.0C325.2 204.0 334.0 198.0 339.0 193.7C352.6 182.1 362.0 161.4 362.0 143.0C362.0 136.6 359.6 122.0 358.1 119.3C357.5 118.3 356.4 115.9 355.5 114.0C350.5 102.2 337.8 89.0 325.5 82.8C313.6 76.7 308.5 75.5 294.0 75.6C282.7 75.6 279.4 76.0 274.0 77.8C261.9 82.0 251.1 88.1 244.0 95.0C231.1 107.5 229.3 113.6 228.6 149.0C228.1 171.6 227.9 174.2 225.5 182.0C218.5 205.3 206.0 220.2 179.5 236.8C178.4 237.5 176.2 238.7 174.5 239.4C172.8 240.2 171.2 241.2 170.8 241.6C169.6 242.7 158.8 247.0 154.5 248.0C152.3 248.5 148.0 249.6 145.0 250.5C139.0 252.2 107.6 252.5 101.0 250.9Z";

function escAttr(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** The GRIP hex mark as inline currentColor SVG (owner ruling 2026-09-01). */
export function gripMarkSvg(cls: string): string {
  return `<svg class="${escAttr(cls)}" viewBox="0 0 1782 1798" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${GRIP_MARK_PATH}"/></svg>`;
}

/** The Continuum CO interlock mark as inline currentColor SVG (owner ruling
 * 2026-09-01). With an ariaLabel it reads as an image (the view pill's CO
 * segment carries aria-label Continuum); without one it is decorative. */
export function coMarkSvg(cls: string, ariaLabel?: string): string {
  const aria = ariaLabel
    ? ` role="img" aria-label="${escAttr(ariaLabel)}"`
    : ` aria-hidden="true"`;
  return `<svg class="${escAttr(cls)}" viewBox="0 0 412 280"${aria} focusable="false"><path fill="currentColor" fill-rule="evenodd" d="${CO_MARK_PATH}"/></svg>`;
}

/** Owner ruling 2026-09-01: the Cerberus theme goes live now as the default
 * look, with an easy switch back to the lite view. Three stylesheets live
 * here. The lite sheet is the prior look, byte preserved (the 2026-09-01
 * universal bar ruling supersedes that preservation for the brand block only;
 * see the appended block at its end). The Cerberus sheet is built from
 * prompts/CERBERUSTHEMEPROMPT.md; its token, typography, honeycomb, and bloom
 * blocks paste verbatim from that prompt, and the component styling adapts
 * the prompt's usage rules to every existing surface. The co sheet (owner
 * dispatch 2026-09-02) carries the Continuum design language from Christine
 * Selden's vendored styles.css onto the same surfaces. The view is chrome only
 * and orthogonal to the THEME env (grip and c10 render alike under every
 * view; the env token blocks still ship in the lite sheet). */
export function themeStylesheet(view: ViewName = DEFAULT_VIEW): string {
  // L1 THE LABEL EDITOR (canon 0.30.386): one sheet appended to every view.
  const sheet =
    view === "lite"
      ? liteStylesheet()
      : view === "co"
        ? coStylesheet()
        : cerberusStylesheet();
  return sheet + labelEditorStyles();
}

/** Walk-slice chrome shared by all three sheets: vendored icon imgs, license
 * tones, clickable unload radios, and the Interco four-window floor. */
function walkSliceChrome(view: "lite" | "co" | "cerberus"): string {
  // Variant law: dark ground shows the white set, light ground shows the dark
  // set. Cerberus is steel-dark. Canon 0.19.0: CO is dark-always and joins the
  // white set. Lite identity law (canon 0.20.1, owner verbatim: "Lite Should
  // contain no icons, no animations, and no background texture. Simplify the
  // buttons."): Lite renders NO icons at all; the vendored dark set stays
  // vendored for any future light-ground view.
  const iconShow =
    view === "lite"
      ? `.ops-icon-on-dark, .ops-icon-on-light { display: none; }
.ops-icon-box { display: none; }`
      : view === "cerberus" || view === "co"
        ? `.ops-icon-on-dark { display: block; }
.ops-icon-on-light { display: none; }`
        : `.ops-icon-on-dark { display: none; }
.ops-icon-on-light { display: block; }`;
  // Lite identity law: the device pill shows its words again in Lite; the
  // glyph views keep the icons with the words as aria labels (canon 0.19.0).
  const devicePillWords =
    view === "lite"
      ? `.device-opt svg { display: none; }
.device-word { display: inline; }`
      : `.device-word { display: none; }`;
  const tones =
    view === "cerberus" || view === "co"
      ? `.tone-blue { color: #7eb6ff; }
.tone-yellow { color: #e6c35c; }
.tone-green { color: #7fb494; }
.tone-chip { display: inline-block; margin-left: 0.4rem; font-weight: 700; }
.lic-au { color: #e6c35c; }
.lic-med { color: #7eb6ff; }`
      : `.tone-blue { color: #1d4ed8; border: 2px solid #1d4ed8; padding: 0.05rem 0.35rem; }
.tone-yellow { color: #a16207; border: 2px solid #ca8a04; padding: 0.05rem 0.35rem; }
.tone-green { color: #166534; border: 2px solid #166534; padding: 0.05rem 0.35rem; }
.tone-chip { display: inline-block; margin-left: 0.4rem; font-weight: 700; }
.lic-au { color: #a16207; }
.lic-med { color: #1d4ed8; }`;
  const accent = view === "cerberus" ? "var(--gold)" : view === "co" ? "var(--primary)" : "var(--accent)";
  return `
.ops-icon-box { width: 3.4rem; height: 3.4rem; display: block; position: relative; }
.ops-icon { width: 3.4rem; height: 3.4rem; object-fit: contain; }
${iconShow}
${devicePillWords}
.station-split-3 { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.station-split-3 > * { flex: 1 1 16rem; min-width: 14rem; }
body.device-phone .station-split-3 { flex-direction: column; }
/* PRODUCTION SCHEDULING (canon 0.30.97): three shuttle panes. Shared by all
   three sheets through this walk-slice chrome (the station-split-3 precedent).
   Columns stack on phone and at the 480px floor. >> is a glyph pair, never a dash. */
.station-triple { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.station-triple > * { flex: 1 1 0; min-width: 16rem; }
.station-triple > .queue-pane { max-width: none; }
body.device-phone .station-triple { flex-direction: column; }
@media (max-width: 480px) { .station-triple { flex-direction: column; } }
/* THE PANES ANCHOR TO THE SIDES (canon 0.30.201; owner, 2026-09-23: "I'd like
   them to be anchored to the sides of the screen and still be equal to each
   other"): a page built as the three panes leaves the reading column and takes
   the screen behind the page gutter; the panes grow from a zero basis so they
   stay equal to each other, the third free to extend as far as it needs. */
main:has(.station-triple) { max-width: none; }
.shuttle-btn { min-width: 2.4rem; min-height: 2.4rem; padding: 0.15rem 0.45rem; font-weight: 700; letter-spacing: 0.04em; }
body.device-phone .shuttle-btn { width: auto; min-width: 2.8rem; }
/* ASSIGN PLANT COUNTS (canon 0.30.416): two panes, left over right on a phone, the buttons full width. */
.plant-panes { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.plant-panes > * { flex: 1 1 0; min-width: 0; }
.plant-panes > .queue-pane { max-width: none; }
.plant-panes .queue-pane a.queue-pane-item { overflow-wrap: normal; word-break: normal; }
body.device-phone .plant-panes { flex-direction: column; }
@media (max-width: 480px) { .plant-panes { flex-direction: column; } }
main:has(.plant-panes) { max-width: none; }
.plant-count-form { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: end; margin-top: 0.8rem; }
body.device-phone .plant-panes .plant-count-btn { width: 100%; display: block; box-sizing: border-box; }
/* ADMIN CLEANUP (canon 0.30.418): the bar's buttons wrap onto a second line inside a phone, and the page stays the screen's width. */
body.device-phone header.app-bar { max-width: 100%; }
body.device-phone .bar-actions { flex: 1 1 100%; flex-wrap: wrap; margin-left: 0; max-width: 100%; }
@media (max-width: 480px) { .plant-panes .plant-count-btn { width: 100%; display: block; box-sizing: border-box; } }
.schedule-status { font-weight: 600; }
.schedule-hbn-summary { display: flex; align-items: center; justify-content: space-between; gap: 0.45rem; }
.queue-fold { margin: 0 0 0.8rem; }
.queue-fold > summary { cursor: pointer; }
.silo-flags { color: var(--danger, #8b2e2e); font-weight: 700; }
.queue-fold > summary h2, .queue-fold > summary h3 { display: inline; }
.check-cell { width: 2rem; }
.batch-bar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: end; margin: 0.4rem 0 0.6rem; }
.batch-bar .field { margin: 0; }
.batch-bar button:disabled { opacity: 0.55; }
/* THE HBN ON THE SCHEDULING PANES (canon 0.30.102): the full HBN heads every
   group, sized to sit on one line in a 16rem pane and to break at a hyphen,
   never mid-token, when a pane runs narrower. */
.schedule-hbn-line, .schedule-hbn-label { font-size: 0.95rem; font-weight: 700; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.schedule-hbn-label { margin: 0 0 0.45rem; }
/* THE BACK LINK (canon 0.30.109; owner: "All sub-menus need to have a link
   that goes back to the pervious menu"): one crumb under the app bar on every
   page but Home, the arrow and the menu's name, sized like the pane text. */
/* THE CRYO RUN (canon 0.30.110): the run pane's line wraps at a hyphen, never
   mid-token, and the pool words sit on their own line; a fieldset never grows
   past its pane on a phone (its min-content default did, around the line's
   table), and Finish run keeps a breath above it. */
.queue-pane-item[data-cryo-run] strong { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.queue-pane-item[data-cryo-run] .muted { display: block; font-weight: 400; }
fieldset { min-width: 0; max-width: 100%; box-sizing: border-box; }
.cryo-finish { margin-top: 0.9rem; }
.cryo-pool tfoot th { font-weight: 700; }
.cryo-pool .pool-type-note { font-size: 0.85em; margin-left: 0.35em; }
/* THE POOL BY CATEGORY (canon 0.30.121): on a phone the four columns must fit
   the frame, the Remaining above all (the TL's over-issue check), so the pool
   table keeps its table layout at a tighter size and the type note drops under
   its category instead of widening the first column. */
body.device-phone table.data.cryo-pool { display: table; width: 100%; white-space: normal; font-size: 0.86rem; }
body.device-phone .cryo-pool th, body.device-phone .cryo-pool td { padding: 0.4rem 0.35rem; }
body.device-phone .cryo-pool .pool-type-note { display: block; margin-left: 0; }
.back-crumb { margin: 0 0 0.75rem; font-size: 0.95rem; }
.back-crumb .back-link { display: inline-block; padding: 0.2rem 0; font-weight: 600; text-decoration: none; }
.back-crumb .back-link:hover, .back-crumb .back-link:focus { text-decoration: underline; }
body.device-phone .back-crumb .back-link { min-height: 2.4rem; display: inline-flex; align-items: center; font-size: 1.05rem; }
/* THE BLAST FREEZER(S) (canon 0.30.106; owner: "Merge the blast freezer
   formatting to the FFZ inventory one"): a freezer tile wears the FFZ chrome
   (the blue wire, the fill's slow fade to white); its status and percent share
   one line and its lot lines sit muted beneath, sized like the FFZ source line. */
.freezer-gauge .freezer-state { white-space: nowrap; }
.freezer-gauge .freezer-lines { font-size: 0.74rem; margin: 0 0 0.3rem; letter-spacing: 0; text-transform: none; }
.freezer-gauge .freezer-lines .inv-lot { margin: 0.15rem 0; }
.freezer-gauge .freezer-lines .inv-lot-id { font-weight: 700; }
.schedule-item { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
/* THE RAD (canon 0.30.327): a run card stacks its grey, its stamps, and its
   packages. The clock is the strip's clock, tabular so the seconds hold still. */
.rad-card { display: grid; gap: 0.35rem; margin: 0 0 0.9rem; padding: 0 0 0.7rem; border-bottom: 1px solid var(--line, var(--border, #88888855)); }
.rad-card .rad-packages { margin: 0.2rem 0; padding-left: 1.1rem; }
.rad-card .silo-clock { font-variant-numeric: tabular-nums; font-weight: 700; }
.rad-grey { display: flex; flex-wrap: wrap; align-items: end; gap: 0.4rem; }
/* THE RAD START TIME (canon 0.30.330): the running card's clock and its Start
   Time form share one line and wrap under the clock on the phone; the form is
   a row of its own, the box about 4.5rem wide. */
.rad-start-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; }
.rad-start-line .rad-start-form { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin: 0; }
.rad-start-line .rad-start-form input[name="start_time"] { width: 4.5rem; }
.rad-start-line .rad-start-form select[name="meridiem"] { width: auto; }
body.device-phone main .rad-start-line .rad-start-form button { width: auto; }
.schedule-item-readonly { list-style: none; padding: 0.25rem 0; }
/* THE SCHEDULER BY PACKAGE (canon 0.30.196): the filter hides a row with the
   hidden attribute, which the row's own display would otherwise defeat; the
   HBN rides muted under the last six and breaks at a hyphen. */
.schedule-item[hidden], [data-schedule-empty][hidden], [data-schedule-heading][hidden] { display: none; }
.schedule-filter { margin: 0 0 0.9rem; max-width: 26rem; }
.schedule-hbn-muted, .schedule-inherit { font-size: 0.85em; overflow-wrap: anywhere; }
/* THE PACKAGE READS IN FOUR LINES (canon 0.30.199): the whole tag, the strain
   and grams, the HBN, the location, each on its own line, on the Prepack
   panes, From METRC and the station's job list. */
.pkg-identity { display: grid; gap: 0.1rem; min-width: 0; flex: 1 1 14rem; }
.pkg-identity > span { display: block; overflow-wrap: anywhere; }
.pkg-identity .pkg-tag, h2.pkg-tag { font-weight: 700; font-variant-numeric: tabular-nums; }
.pkg-identity .pkg-hbn, .pkg-identity .pkg-location { font-size: 0.85em; color: var(--muted); }
.pkg-identity .pkg-hbn strong { color: inherit; }
.queue-pane a.queue-pane-item .pkg-identity { font-weight: 400; }
.shuttle-form { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; margin: 0; }
.shuttle-form input[type="password"] { width: 5.5rem; }
.interco-floor { display: grid; grid-template-columns: 1fr 1fr 1fr 1.15fr; gap: 1rem; align-items: stretch; }
.interco-floor .pnn-wide { min-width: 0; }
.interco-floor .site-rooms { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.interco-road { margin: 1rem 0; }
/* Gate fix (canon 0.25.1): the floor's site panels read as panels in every
   view (the canvas the owner ratified), and floor rows carry the law's own
   numbering, so the lists render markerless. */
.card { background: var(--panel, transparent); border: 1px solid var(--line, var(--border, #88888855)); border-radius: 10px; padding: 0.9rem 1rem; }
.card > h2:first-child { margin-top: 0; }
.interco-floor .site-rooms > div { background: var(--panel-alt, var(--panel-2, transparent)); border: 1px solid var(--line, var(--border, #88888855)); border-radius: 8px; padding: 0.6rem 0.7rem; min-width: 0; }
ul.floor-rows { list-style: none; margin: 0.35rem 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
ul.floor-rows li { font-variant-numeric: tabular-nums; }
.lane-card { display: block; padding: 0.6rem 0.7rem; border: 1px solid var(--line); border-radius: 6px; margin: 0.4rem 0; }
body.device-phone .interco-floor { grid-template-columns: 1fr; }
/* THE MANIFEST BUILDER (canon 0.30.125; owner: "Three equal panes"): the
   origin, destination and manifest cards share the width; a package row is
   its shuttle, the last six in bold with the whole tag muted beside it and the
   mirror's item, quantity and location beneath; in the manifest list the row
   flips to << and shows its price box. The panes stack on a phone. */
.interco-panes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; align-items: start; }
.interco-panes .pane { min-width: 0; }
.interco-panes .pane > h2 { margin-top: 0; }
.pkg-list { max-height: 60vh; overflow-y: auto; padding-right: 0.2rem; }
.pkg-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.25rem 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid var(--line, var(--border, #88888833)); }
.pkg-row:last-child { border-bottom: 0; }
.pkg-row .pkg-main { flex: 1 1 0; min-width: 0; }
.pkg-row .tag-six { font-size: 1.1em; letter-spacing: 0.04em; }
.pkg-row .tag-full { display: block; font-size: 0.78em; word-break: break-all; }
.pkg-row .shuttle-btn, .pkg-row .shuttle-slot { flex: 0 0 auto; min-width: 2.6rem; }
.pkg-row [data-remove], .pkg-row .manifest-only { display: none; }
.pkg-row.in-manifest [data-add] { display: none; }
.pkg-row.in-manifest [data-remove] { display: inline-block; }
.pkg-row.in-manifest .manifest-only { display: block; flex: 1 0 100%; padding-left: 3.1rem; }
.pkg-row label.price-field { display: flex; flex-direction: row; align-items: center; gap: 0.4rem; margin: 0; font-size: 0.82em; font-weight: 600; }
.pkg-row .price-field input { width: 7rem; flex: 0 0 auto; }
.pkg-row.pkg-dim { opacity: 0.5; }
.manifest-header { margin: 0.4rem 0 0.8rem; }
.manifest-header > summary { cursor: pointer; font-weight: 700; }
.manifest-header .hdr-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.15rem 0.7rem; }
.manifest-header .hdr-grid .field.wide { grid-column: 1 / -1; }
.manifest-header .hdr-grid .field { margin: 0.2rem 0; font-size: 0.92em; }
.manifest-header textarea, .manifest-header input { width: 100%; }
.manifest-actions { margin-top: 0.8rem; align-items: center; }
.manifest-finished a { font-weight: 700; }
body.device-phone .interco-panes { grid-template-columns: 1fr; }
body.device-phone .pkg-list { max-height: none; }
body.device-phone .manifest-header .hdr-grid { grid-template-columns: minmax(0, 1fr); }
.lic-dim { opacity: 0.45; }
.pkg-sub { display: block; font-size: 0.82em; color: var(--text-dim, #888); }
.floor-lic { margin: 0.4rem 0; }
.floor-lic > summary { cursor: pointer; font-weight: 700; }
.floor-site > summary { cursor: pointer; }
.row-actions { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.2rem; }
.row-actions form { display: inline; }
.space-muted, .item-muted { opacity: 0.55; }
.license-picker { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; }
.license-picker select { flex: 1 1 12rem; }
.receive-reveal { margin-top: 0.4rem; padding: 0.5rem; border: 1px solid var(--line, var(--border)); position: relative; z-index: 2; }
.session-mode, .choice-row { position: relative; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem 0.7rem; }
.session-mode input[type="radio"], .choice-row input[type="radio"] {
  appearance: auto; -webkit-appearance: radio;
  width: 1.15rem; height: 1.15rem; min-width: 1.15rem; min-height: 1.15rem;
  margin: 0; pointer-events: auto; position: relative; z-index: 3;
  accent-color: ${accent};
}
.session-mode label, .choice-row label { pointer-events: auto; cursor: pointer; position: relative; z-index: 3; }
body.device-phone .session-mode input[type="radio"],
body.device-phone .choice-row input[type="radio"] {
  width: 1.35rem; height: 1.35rem; min-width: 1.35rem; min-height: 1.35rem;
}
.device-opt { display: inline-flex; align-items: center; justify-content: center; }
.device-glyph { width: 1.1em; height: 1.1em; display: block; }
.rapid-add { min-width: 2.8rem; padding: 0.2rem 0.55rem; font-weight: 800; }
.overissue-banner { border-left: 3px solid var(--alert, var(--danger, #b23c2b)); padding: 0.7rem 0.9rem; background: var(--alert-soft, rgba(178, 60, 43, 0.12)); }
.reconcile-gate { max-width: 36rem; padding: 0.7rem 0.9rem; border: 1px solid var(--border, #2a2b30); background: var(--surface, #17181b); }
.reconcile-gate .row-actions { margin-top: 0.8rem; }
body.device-phone main button.rapid-add,
body.device-phone .device-pill button { width: auto; min-height: 2.8rem; }
.kpi-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.8rem; margin: 0; }
/* Owner walk feedback 2026-09-04 (canon 0.22.0): the metrics live in their own
   pane, tinted apart from the menu buttons. color-mix falls back to the border
   alone on engines without it; the pane still reads distinct. */
.kpi-pane { display: block; border: 1px solid ${accent}; border-radius: var(--radius, 8px); padding: 0.9rem 1rem 1rem; margin: 0 0 1.4rem; background: color-mix(in srgb, ${accent} 7%, transparent); }
.kpi-pane-label { display: block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim, #888); margin-bottom: 0.6rem; }
.kpi-tile { background: color-mix(in srgb, ${accent} 4%, var(--panel, var(--surface, #fff))); border: 1px solid var(--line, var(--border, #ccc)); border-radius: var(--radius, 8px); padding: 0.8rem 1rem; }
.kpi-label { display: block; font-size: 0.85rem; color: var(--text-dim, #666); margin-bottom: 0.35rem; }
.kpi-value { display: block; font-size: 1.35rem; }
.kpi-yes { border-left: 4px solid var(--ok, #2f5d3a); }
.kpi-no { border-left: 4px solid var(--danger, #8b2e2e); }
.kpi-yes .kpi-value { color: var(--ok, #2f5d3a); }
.kpi-no .kpi-value { color: var(--danger, #8b2e2e); }
.pareto-list { display: flex; flex-direction: column; gap: 0.35rem; }
.pareto-row { display: grid; grid-template-columns: 8rem 1fr 3.2rem; gap: 0.4rem; align-items: center; }
.pareto-label { font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pareto-track { background: var(--panel-2, var(--line, #ddd)); height: 0.7rem; border-radius: 4px; overflow: hidden; }
.pareto-bar { display: block; height: 100%; background: ${accent}; }
.pareto-pct { font-size: 0.8rem; text-align: right; }
.tab-bar { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 1rem; }
.tab-link { display: inline-block; padding: 0.35rem 0.7rem; border: 1px solid var(--line, var(--border, #ccc)); border-radius: 6px; text-decoration: none; color: inherit; }
.tab-link.tab-on { background: ${accent}; color: var(--accent-text, #fff); border-color: ${accent}; }
.status-pill { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 999px; border: 1px solid var(--line, var(--border, #ccc)); font-size: 0.8rem; }
.status-open, .status-confirmed, .status-active, .status-Passed { color: var(--ok, #2f5d3a); }
.status-cancelled, .status-Failed, .status-inactive { color: var(--danger, #8b2e2e); }
.audit-notes { list-style: none; padding: 0; }
.audit-notes li { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline; padding: 0.35rem 0; border-bottom: 1px solid var(--line, var(--border, #ccc)); }
.remediate { background: var(--panel, var(--surface, #fff)); border: 1px solid var(--line, var(--border, #ccc)); padding: 0.8rem 1rem; }
.station-split { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.station-split > * { flex: 1 1 16rem; min-width: 14rem; }
body.device-phone table.phone-table thead { display: none; }
body.device-phone table.phone-table tr.phone-row,
body.device-phone table.phone-table tbody tr { display: block; border: 1px solid var(--line, var(--border, #ccc)); margin: 0 0 0.7rem; padding: 0.4rem 0.6rem; }
body.device-phone table.phone-table td { display: flex; justify-content: space-between; gap: 0.8rem; border: 0; padding: 0.2rem 0; }
body.device-phone table.phone-table td[data-th]::before { content: attr(data-th); font-weight: 700; }
/* Canon 0.30.18: Mount SOs (the pipeline readouts) and Pick Orders (the walk). */
.sotable td.z { opacity: 0.35; }
.sotable tr.qtyrow th, .sotable tr.qtyrow td { color: var(--text-dim, #888); font-size: 0.9em; }
.sotable td.tot, .sotable tr.tot td, .sotable tr.tot th { font-weight: 700; }
.sotable th span.muted { font-weight: 400; font-size: 0.7em; }
.chip { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; border: 1px solid var(--line, var(--border, #ccc)); font-size: 0.8rem; white-space: nowrap; }
.chip.so-picking { border-color: ${accent}; color: ${accent}; font-weight: 700; }
.chip.so-fulfilled { color: var(--ok, #2f5d3a); border-color: var(--ok, #2f5d3a); }
.chip.so-shipped { opacity: 0.6; }
.chip.so-stale { color: var(--text-dim, #888); font-style: italic; }
.pick-lines tr.loc-row th { text-align: left; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.78rem; background: color-mix(in srgb, ${accent} 12%, transparent); }
.pick-lines input.pick-qty { width: 5.5rem; }
.pick-lines input[type="text"] { width: 12rem; }
.pick-lines input[type="checkbox"] { appearance: auto; -webkit-appearance: checkbox; width: 1.15rem; height: 1.15rem; min-width: 1.15rem; accent-color: ${accent}; }
/* Canon 0.30.23: a grouped report heads each run of rows with its site. */
table.data tr.report-group th { text-align: left; font-size: 0.82rem; letter-spacing: 0.12em; text-transform: uppercase; padding-top: 0.9rem; background: color-mix(in srgb, ${accent} 10%, transparent); }
table.data tr.report-total td { font-weight: 700; border-top: 2px solid var(--line, var(--border, #888)); }
/* DRY WEIGHT BY STRAIN (canon 0.30.427): the lot numbers fold under their row. */
table.data tr.report-detail td { padding-top: 0; border-top: 0; }
.report-fold summary { cursor: pointer; font-size: 0.85rem; opacity: 0.8; }
.report-fold-body { display: block; font-size: 0.85rem; padding: 0.25rem 0 0.4rem 1rem; word-break: break-word; }
/* THE RECONCILE LEDGER LOCATION (canon 0.30.135): the editable ledger table. */
.reconcile-table input[type="text"], .reconcile-table select { width: 100%; min-width: 6em; box-sizing: border-box; }
.reconcile-table input.grams { min-width: 7em; text-align: right; }
.reconcile-table td.hbn { white-space: nowrap; font-size: 0.9em; }
.reconcile-pick select[disabled] { opacity: 0.7; }
details.reconcile-purge > summary, details.reconcile-edit > summary { cursor: pointer; font-weight: 600; margin-top: 0.75rem; }
/* Canon 0.30.19: the silo select's occupied rows and the all-full banner. */
.banner.warn { border-color: var(--alert, var(--danger, #b23c2b)); }
select option[data-occupied] { color: var(--text-dim, #888); }
/* THE CURE PANES (canon 0.30.164): CSA and CSB ride the drying strip.
   A pane is an inv-gauge tile the silo tiles' width (13.6rem, canon 0.30.355), its children the tile's full width. */
.cure-pane { flex: 0 0 auto; width: 13.6rem; min-width: 0; font-size: 0.8rem; position: relative; overflow: hidden; }
.inv-gauge.cure-pane { padding-bottom: 0; }
.cure-pane > * { width: 100%; }
/* THE V7 GATE (canon 0.30.384): an opened cure tile lays its body out as the pane itself, so V28's bar stands as built. */
.cure-pane > .dry-tile-body:not([hidden]) { display: contents; }
/* THE PANE IS A BAR (canon 0.30.355): the green rises from the tile's bottom to the percent full (its inline height), the silo tiles' width (13.6rem, owner 2026-10-02: "match width of the columns above").
   THE COUNT SITS ON THE BAR (canon 0.30.378): the lots fold lives inside the shade; opened, the shade grows (height auto, at least the percent full) and the tile grows with it. The summary and the rows read in the theme's text colour on the green; links keep the theme's link colour. */
.cure-pane > .cure-shade, .cure-pane > .dry-tile-body > .cure-shade { position: absolute; left: 0; right: 0; bottom: 0; top: auto; width: auto; background: rgba(46, 158, 79, 0.6); border-top: 2px solid #2e9e4f; pointer-events: auto; transition: height 0.6s ease; box-sizing: border-box; display: flex; flex-direction: column; min-height: min-content; }
.cure-pane > .cure-shade[data-cure-fill="0.0"], .cure-pane > .dry-tile-body > .cure-shade[data-cure-fill="0.0"] { border-top: 0; background: transparent; }
.cure-pane:has(.cure-lots[open]) > .cure-shade, .cure-pane:has(.cure-lots[open]) > .dry-tile-body > .cure-shade { position: relative; left: auto; right: auto; bottom: auto; align-self: stretch; width: calc(100% + 1.6rem); height: auto !important; min-height: var(--cure-fill, 0%); margin-top: auto; margin-left: -0.8rem; margin-right: -0.8rem; }
.cure-shade > .cure-lots { margin: 0; width: 100%; }
.cure-shade > .cure-lots > summary.cure-count { margin: 0; padding: 0.12rem 0.25rem 0.2rem; }
.cure-lots > summary.cure-count { cursor: pointer; list-style: none; }
.cure-lots > summary.cure-count::-webkit-details-marker { display: none; }
.cure-lots > summary.cure-count::before { content: "▸ "; font-size: 0.8em; opacity: 0.7; }
.cure-lots[open] > summary.cure-count::before { content: "▾ "; }
.cure-pane > :not(.cure-shade), .cure-pane > .dry-tile-body > :not(.cure-shade) { position: relative; z-index: 1; }
.cure-count { margin: 0.1rem 0 0.35rem; font-weight: 600; }
.cure-over { color: #7c1b1b; }
/* POST HARVEST PUZZLES (canon 0.30.351): the ten best and the ten worst. */
.php-best { background: #C6EFCE; color: #006100; }
.php-worst { background: #FFC7CE; color: #9C0006; }
.php-key { margin: 0.4rem 0 0; }
@media (prefers-color-scheme: dark) {
  .php-best { background: color-mix(in srgb, var(--ok, #7fb494) 28%, transparent); color: var(--ok, #7fb494); }
  .php-worst { background: color-mix(in srgb, var(--danger, #ef8a6f) 28%, transparent); color: var(--danger, #ef8a6f); }
}
.cure-conditions { margin: 0.2rem 0 0.45rem; font-variant-numeric: tabular-nums; }
/* THE DRYING TOTALS AND THE STRAIN ON THE LOT LINE (canon 0.30.183): three figures under the dry
   space tiles on the console; the strain under each lot number on the tiles. */
.drying-totals { display: flex; flex-wrap: wrap; gap: 0.5rem 1.6rem; margin: 0.15rem 0 0.6rem; font-variant-numeric: tabular-nums; }
.drying-total { min-width: 11.2rem; }
.drying-total-label { font-size: 0.85em; opacity: 0.8; }
.drying-total-value { font-size: 1.05em; }
.drying-total-sub { font-size: 0.85em; }
.inv-lot-strain { font-size: 0.9em; overflow-wrap: anywhere; }
.cure-stale { color: var(--danger, #8b2e2e); font-weight: 700; }
.cure-row { padding: 0.3rem 0; border-top: 1px solid var(--line, #ccc); font-variant-numeric: tabular-nums; text-align: left; overflow-wrap: anywhere; }
/* THE ROW FOLDS ON THE LOT NUMBER (owner, 2026-09-22): the lot number and its time in on one line, the rest under it when pressed. */
.cure-row > summary.cure-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.4rem; cursor: pointer; list-style: none; }
.cure-row > summary.cure-head::-webkit-details-marker { display: none; }
.cure-row > summary.cure-head::before { content: "▸"; font-size: 0.75em; opacity: 0.7; }
.cure-row[open] > summary.cure-head::before { content: "▾"; }
.cure-row .cure-id { font-weight: 700; flex: 1 1 auto; }
.cure-row .cure-clock { white-space: nowrap; }
.cure-row .cure-body { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.2rem 0 0 0.9rem; }
.cure-row .cure-link { font-size: 0.9em; }
.cure-live { font-size: 0.85em; }
.testing-desk h2 { margin-top: 1.4rem; }
.testing-desk form.stack { max-width: 36rem; }
.testing-warn { color: var(--danger, #8b2e2e); font-weight: 700; }
/* THE MAINTENANCE NODE (canon 0.30.293): check lines, the siren, the interval lists. */
.check-line { font-size: 0.78rem; font-variant-numeric: tabular-nums; margin-top: 0.15rem; }
.hc-siren { color: var(--danger, var(--alert, #8b2e2e)); font-weight: 800; }
.hc-siren .hc-icon { width: 1.9rem; height: auto; vertical-align: middle; margin-right: 0.25rem; }
.hc-siren [data-icon-siren-lamp] { animation: hc-waste-throb 1.6s ease-in-out infinite; }
.hc-siren[hidden], [data-countdown][hidden] { display: none !important; }
.maintenance-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 0.8rem 0; }
.maintenance-btn { display: inline-flex; align-items: center; min-height: 2.4rem; padding: 0.3rem 0.8rem; border: 2px solid var(--line, #888); border-radius: 0.4rem; font-weight: 700; text-decoration: none; }
.interval-pair { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.interval-pair > * { flex: 1 1 16rem; }
/* THE TWO HARVEST NODES (canon 0.30.317): the field station's entry row, shared by the three sheets. */
.field-entry { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: flex-end; }
.field-entry .field { margin: 0; }
.field-entry input[type="number"] { width: 8rem; }
/* THE PLUS KEEPS THE CURSOR (canon 0.30.334): a refusal or no answer under the entry form, on a row of its own. */
.field-entry .field-entry-status { flex: 1 1 100%; margin: 0.4rem 0 0; }
.field-finish { margin-top: 0.8rem; }
.field-finish > summary { list-style: none; display: inline-block; cursor: pointer; }
.field-finish > summary::-webkit-details-marker { display: none; }
.field-finish > p { margin-top: 0.8rem; }
.field-finish-item { display: block; margin: 0.3rem 0; }
.field-warn { margin: 0.6rem 0; padding: 0.6rem 0.8rem; border: 2px solid var(--line, #888); border-radius: 8px; }
/* TERP RECIPES (canon 0.30.321): the builder and the schedule pick, shared by the three sheets. */
.terp-work, .terp-pick { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: flex-end; }
.terp-work .field, .terp-pick .field, .terp-retire { margin: 0; }
.terp-work input[data-terp-percent], .terp-pick input[data-terp-dose] { width: 6rem; }
.terp-lines, .terp-saved { list-style: none; padding: 0; margin: 0.4rem 0; }
.terp-lines li, .terp-saved li { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin: 0.3rem 0; }
.terp-plain-row { display: flex; gap: 0.6rem; margin: 0.3rem 0; }
.terp-complete { margin: 0.6rem 0; padding: 0.6rem 0.8rem; border: 2px solid var(--line, #888); border-radius: 8px; }
.terp-retired { margin-top: 0.8rem; }
.station-triple.field-triple > .working-pane { flex: 3 1 0; }
.station-triple.field-triple > .queue-pane { min-width: 15rem; }
body.device-phone .station-triple.field-triple > *, body.device-phone .station-triple.field-triple > .working-pane { flex: 1 1 auto; min-width: 0; }
@media (max-width: 480px) { .station-triple.field-triple > *, .station-triple.field-triple > .working-pane { flex: 1 1 auto; min-width: 0; } }
.station-triple.field-triple .queue-pane a.queue-pane-item { overflow-wrap: normal; word-break: normal; }
.field-reopen { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.field-reopen input[type="password"] { width: 5rem; min-width: 0; }
.field-table { overflow-x: auto; }
.field-working .weights-numbered { width: 100%; }
.field-working .weights-numbered th, .field-working .weights-numbered td { padding: 0.45rem 0.4rem; }
.field-working .weights-numbered .weight-seq { width: 2.6rem; }
.field-working .weights-numbered td.field-hbn-cell { width: 11rem; }
.field-working .weights-numbered td.row-actions { min-width: 7.5rem; flex-wrap: nowrap; }
.field-tote-hbn { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.field-tote-hbn select { flex: 1 1 100%; min-width: 7rem; max-width: 100%; }
.field-tote-pin { display: inline-flex; gap: 0.35rem; align-items: center; }
.field-tote-hbn.js:not(.changed) .field-tote-pin { display: none; }
.field-tote-pin input[type="password"] { width: 4.5rem; }
/* FLOOR VS METRC (canon 0.30.415): the tables scroll inside their box. A grid
   column of minmax(0, 1fr) keeps that box on the page, including on a phone. */
.floor-metrc { display: grid; grid-template-columns: minmax(0, 1fr); max-width: 100%; }
.report-scroll { display: block; width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.report-scroll > table.data { width: max-content; min-width: 100%; }
.report-scroll > table.data th, .report-scroll > table.data td { white-space: nowrap; }
body.device-phone .report-scroll > table.data { display: table; overflow: visible; white-space: nowrap; }
${tones}
`;
}

/** The lite view: the pre-Cerberus stylesheet, byte preserved (owner ruling
 * 2026-09-01: "an easy way for me to switch back to 'lite' view"). */
export function liteStylesheet(): string {
  return `/* =====================================================================
   THEME TOKEN SLOTS  --  GRIP (neutral slice 1; real skin later)
   --------------------------------------------------------------------- */
:root[data-theme="grip"] {
  --bg: #f3efe6;
  --panel: #fffdf8;
  --panel-2: #e8e2d4;
  --text: #1c1914;
  --text-dim: #5c564c;
  --line: #c9c0ae;
  --accent: #4f6b4a;
  --accent-text: #ffffff;
  --danger: #8b2e2e;
  --ok: #2f5d3a;
  --focus: #2b4c7e;
  --font: system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius: 10px;
}

/* =====================================================================
   THEME TOKEN SLOTS  --  C10 (neutral slice 1; real skin later)
   --------------------------------------------------------------------- */
:root[data-theme="c10"] {
  --bg: #eef1f5;
  --panel: #ffffff;
  --panel-2: #dce3ec;
  --text: #16181c;
  --text-dim: #5a616b;
  --line: #b7c0cc;
  --accent: #3d5a80;
  --accent-text: #ffffff;
  --danger: #8b2e2e;
  --ok: #2f5d3a;
  --focus: #3d5a80;
  --font: system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius: 10px;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  font-size: 1.2rem;
  line-height: 1.4;
}
a { color: var(--accent); }
header.app-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.2rem;
  background: var(--panel);
  border-bottom: 2px solid var(--line);
}
.brand { font-weight: 700; letter-spacing: 0.04em; }
nav a { margin-right: 0.9rem; font-weight: 600; }
main { max-width: 89rem; margin: 0 auto; padding: 1.2rem; }
h1 { font-size: 1.8rem; margin: 0 0 1rem; }
h2 { font-size: 1.3rem; margin: 1.4rem 0 0.6rem; }
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.9rem;
}
.tile {
  display: block;
  background: var(--panel);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 1rem 1.1rem;
  text-decoration: none;
  color: inherit;
  min-height: 6.5rem;
}
.tile:focus, .tile:hover { border-color: var(--accent); }
.tile-stub { opacity: 0.75; border-left: 6px solid #d97706; }
.tile-stub:focus, .tile-stub:hover { border-left-color: #d97706; }
.tile-kind { font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.tile-title { display: block; font-size: 1.35rem; font-weight: 700; margin: 0.25rem 0; }
.tile-count { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.banner {
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  margin-bottom: 1rem;
  border: 2px solid var(--line);
  background: var(--panel);
}
.banner.ok { border-color: var(--ok); }
.banner.err { border-color: var(--danger); color: var(--danger); }
.hbn-mint {
  font-size: 2.1rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  word-break: break-all;
  background: var(--panel);
  border: 3px solid var(--accent);
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  margin: 0.6rem 0 1rem;
}
form.stack, .stack { display: flex; flex-direction: column; gap: 0.85rem; max-width: 40rem; }
label.field { display: flex; flex-direction: column; gap: 0.3rem; font-weight: 600; }
input, select, textarea, button {
  font-family: inherit;
  font-size: 1.15rem;
  line-height: 1.3;
}
input[type="text"], input[type="date"], input[type="time"], input[type="number"], input[type="file"], select, textarea {
  width: 100%;
  min-height: 2.8rem;
  padding: 0.45rem 0.65rem;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--text);
}
textarea { min-height: 5rem; }
input:focus, select:focus, textarea:focus, button:focus {
  outline: 3px solid var(--focus);
  outline-offset: 1px;
}
button, .btn {
  min-height: 2.8rem;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 2px solid var(--accent);
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
button.secondary, a.btn.secondary {
  background: var(--panel);
  color: var(--text);
  border-color: var(--line);
}
button.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.row-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
table.data {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
  font-size: 1.05rem;
}
table.data th, table.data td {
  text-align: left;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
table.data th { background: var(--panel-2); }
.person-form { display: flex; gap: 0.4rem; align-items: center; }
.person-form select { min-width: 12rem; }
.locale-pill { display: flex; border: 2px solid var(--line); border-radius: 999px; overflow: hidden; }
.locale-pill button {
  min-height: 2.2rem;
  min-width: 3.2rem;
  padding: 0.2rem 0.7rem;
  border: 0;
  border-radius: 0;
  background: var(--panel);
  color: var(--text-dim);
  font-weight: 700;
}
.locale-pill button.active { background: var(--accent); color: var(--accent-text); }
.muted { color: var(--text-dim); }
.pkg-table { max-width: none; width: 100%; }
.wide { max-width: none; }
.station-split { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.queue-pane {
  flex: 1 1 16rem;
  max-width: 22rem;
  background: var(--panel);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 0.9rem;
}
.queue-pane h2 { margin: 0 0 0.7rem; }
.queue-pane ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.queue-pane a.queue-pane-item {
  display: block;
  min-height: 2.8rem;
  padding: 0.6rem 0.8rem;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: inherit;
  font-weight: 600;
  text-decoration: none;
  word-break: break-all;
}
.queue-pane a.queue-pane-item:focus, .queue-pane a.queue-pane-item:hover { border-color: var(--accent); }
.queue-pane a.queue-pane-item.selected { border-color: var(--accent); background: var(--panel-2); }
.pane-group { margin: 0 0 0.5rem; }
.pane-group summary {
  cursor: pointer;
  min-height: 2.8rem;
  padding: 0.6rem 0.8rem;
  border: 2px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  font-weight: 600;
}
.pane-group summary:focus, .pane-group summary:hover { border-color: var(--accent); }
.pane-group ul { margin-top: 0.5rem; }
.working-pane { flex: 3 1 24rem; min-width: 0; }
.working-pane .working-pick { margin-top: 0; }
.move-to-row { display: flex; gap: 0.4rem; align-items: center; }
.move-to-row select { flex: 1; }
.move-to-row button { white-space: nowrap; }
.resume-lots { margin: 0 0 1rem; }
.resume-lots h3 { margin: 0 0 0.4rem; }
.resume-lots ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.resume-lots a { font-weight: 600; }
.lot-meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.9rem; margin: 0 0 1rem; }
.lot-meta dt { font-weight: 700; }
.lot-meta dd { margin: 0; }
.weights-pane {
  background: var(--panel);
  border: 2px solid var(--line);
  border-radius: var(--radius);
  padding: 0.9rem;
  max-width: 46rem;
}
.weights-pane h3 { margin: 0 0 0.7rem; }
.weights-controls { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; margin-bottom: 0.8rem; }
.weights-controls input[type="number"] { width: 11rem; }
.weights-numbered .weight-seq { width: 3.2rem; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* THE PLANT COUNT (canon 0.30.62): the finish form toggles the hidden attribute on its
   button and prompt; the button rule's display inline-flex would defeat the UA's [hidden]
   (the 2026-09-01 boot-slot lesson), so hidden is absolute inside this form. */
.finish-with-plants [hidden] { display: none !important; }
.finish-with-plants { flex-wrap: wrap; }
.finish-with-plants .plant-prompt { flex: 1 1 100%; }
/* THE EFFECTIVE DATE (canon 0.30.92): the collapsed field on a transactional form; the
   summary is the tap target, the open block stacks its date and PIN like any field. */
.effective-date { margin: 0.35rem 0 0.6rem; }
.effective-date > summary { cursor: pointer; padding: 0.35rem 0; font-weight: 700; }
.effective-date > summary:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.effective-date .field { margin-top: 0.4rem; }
.lot-total { font-size: 1.4rem; margin-top: 1rem; }
.inv-actions { margin-bottom: 1.2rem; }
.inv-section { margin: 0 0 0.7rem; background: var(--panel); border: 2px solid var(--line); border-radius: var(--radius); padding: 0.4rem 0.8rem 0.6rem; }
.inv-section > summary, .inv-total > summary {
  cursor: pointer; min-height: 2.8rem; padding: 0.6rem 0.2rem; font-weight: 700;
}
.inv-section > summary:focus, .inv-total > summary:focus { outline: 3px solid var(--focus); }
.inv-gauges { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.8rem 0 1rem; }
.inv-gauge {
  width: 10.5rem; min-height: 10.5rem; border-radius: 50%;
  border: 3px solid var(--accent); background: var(--panel-2);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 0.8rem; font-size: 0.85rem;
}
.inv-gauge-hang { border-radius: 12px; width: 12.5rem; min-height: 10.5rem; }
.inv-gauge-name { font-weight: 800; margin-bottom: 0.35rem; }
.inv-lot { margin: 0.25rem 0; }
.inv-lot-id { font-weight: 700; }
/* THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69): a silo is a cone-topped cylinder wireframe with its live fill, never a circle. */
.silo-shape { width: 11.2rem; height: 8.4rem; display: block; margin: 0.15rem auto 0.25rem; overflow: visible; }
/* THE WIDE SILO (canon 0.30.71): the silo card widens to hold the shape; its height is untouched. */
.silo-gauge { width: 13.6rem; }
/* THE ROWS (canon 0.30.383): one row per kind, a fixed total at the left, tiles in a line. Past five, the row scrolls. */
.dry-row { display: flex; align-items: stretch; gap: 0.45rem; margin: 0.35rem 0 0.7rem; }
.dry-row-total { flex: 0 0 9.2rem; padding: 0.35rem 0.4rem; border: 1px solid var(--line, #888); border-radius: 0.35rem; font-size: 0.75rem; }
.dry-row-total-label { font-weight: 800; margin-bottom: 0.2rem; }
.dry-row-total-value { font-variant-numeric: tabular-nums; }
.dry-row-scroller { display: flex; align-items: stretch; gap: 0.25rem; min-width: 0; }
.dry-row-tiles { display: flex; flex-wrap: nowrap; align-items: stretch; gap: 0.45rem; overflow-x: auto; max-width: calc(5 * 13.6rem + 4 * 0.45rem); scroll-behavior: smooth; }
.dry-row-tiles > .inv-gauge, .dry-row-tiles > .silo-gauge, .dry-row-tiles > .cure-pane { flex: 0 0 13.6rem; width: 13.6rem; }
.dry-row-arrow { flex: 0 0 auto; align-self: center; min-width: 1.8rem; min-height: 2.4rem; font-size: 1.2rem; }
.dry-tile-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.4rem; width: 100%; text-align: left; background: transparent; color: inherit; border: 0; padding: 0; cursor: pointer; font: inherit; }
.dry-tile-name { font-weight: 800; }
.dry-tile-status, .dry-tile-weight { font-size: 0.78rem; font-variant-numeric: tabular-nums; }
.dry-tile-icon { position: relative; width: 1.45rem; height: 1.15rem; display: inline-block; border: 2px solid var(--accent); box-sizing: border-box; overflow: hidden; flex: 0 0 auto; }
.dry-icon-silo { border-radius: 40% 40% 8% 8%; }
.dry-icon-cube { border-color: #2563eb; }
.dry-icon-cure { border-color: #2e9e4f; }
.dry-icon-fill, .dry-cure-icon-fill { position: absolute; left: 0; right: 0; bottom: 0; }
.dry-icon-fill.silo-fill-green, .dry-cure-icon-fill { background: #2e9e4f; }
.dry-icon-fill.silo-fill-red { background: #d23b2f; }
.dry-icon-fill.silo-fill-blue, .dry-icon-fill.ffz-fill { background: #1d4ed8; }
.dry-icon-fill.silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }
.dry-icon-fill.ffz-throb { animation: ffz-icon-throb 4.2s ease-in-out infinite; }
@keyframes ffz-icon-throb { 0%, 100% { background: #1d4ed8; } 50% { background: #eef4ff; } }
.dry-tile-body[hidden] { display: none; }
/* THE V7 GATE (canon 0.30.384): a collapsed tile is only its head, and an arrow hidden by the row script stays hidden. */
.dry-tile:has(> .dry-tile-body[hidden]) { min-height: 0; }
.dry-row-arrow[hidden] { display: none; }
.silo-wire { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.silo-fill { fill: transparent; fill-opacity: 0.55; transition: y 0.6s ease, height 0.6s ease; }
.silo-fill-green { fill: #2e9e4f; }
.silo-fill-red { fill: #d23b2f; }
.silo-fill-blue { fill: #2f6fd6; }
.silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }
@keyframes silo-throb { 0%, 100% { fill-opacity: 0.3; } 50% { fill-opacity: 0.9; } }
/* THE BLUE THROB (canon 0.30.79): the throb is a floor signal the owner ruled, so a reduced-motion setting slows the pulse instead of stilling it. */
@media (prefers-reduced-motion: reduce) { .silo-throb { animation-duration: 3.2s; } }
.silo-state { font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.72rem; margin: 0 0 0.3rem; }
.silo-state-filling, .silo-state-loading { color: #2e9e4f; }
.silo-state-drying, .silo-state-paused, .silo-state-loaded { color: #d23b2f; }
/* THE UNLOADING SILO (canon 0.30.77): dry weights coming out read unloading, blue, the fill falling with them. */
.silo-state-unloading { color: #2f6fd6; }
.silo-unload { font-size: 0.75rem; font-variant-numeric: tabular-nums; margin: -0.1rem 0 0.3rem; color: #2f6fd6; }
.silo-unload strong { font-weight: 800; }
/* THE BLUE THROB (canon 0.30.79; owner: "there's no blue throb"): an unloading silo's wire pulses blue with its fill, so the signal stands even when the fill is drawn down to nothing. */
.silo-shape[data-silo-state="unloading"] .silo-wire { stroke: #2f6fd6; animation: silo-wire-throb 1.6s ease-in-out infinite; }
@keyframes silo-wire-throb { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .silo-shape[data-silo-state="unloading"] .silo-wire { animation-duration: 3.2s; } }
.silo-state-empty { opacity: 0.6; }
.silo-wet { margin-top: auto; padding-top: 0.4rem; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.silo-wet strong { font-weight: 800; }
/* THE HARVEST CONSOLE (canon 0.30.73): the wire box (the Arlington Dry Room, a silo drawn as a cuboid) and the blue FFZ cube share the silo tile; back edges dashed, the side face darker, the liquid's top lighter. */
.silo-wire-hidden { stroke-dasharray: 5 5; opacity: 0.5; }
.silo-fill-side { filter: brightness(0.8); }
.silo-fill-top { filter: brightness(1.2); }
.ffz-gauge .silo-wire { stroke: #2563eb; }
.ffz-fill { fill: #1d4ed8; fill-opacity: 0.85; }
.ffz-throb { animation: ffz-throb 4.2s ease-in-out infinite; }
@keyframes ffz-throb { 0%, 100% { fill: #1d4ed8; fill-opacity: 0.92; } 50% { fill: #eef4ff; fill-opacity: 0.95; } }
@media (prefers-reduced-motion: reduce) { .ffz-throb { animation-duration: 8.4s; } }
.ffz-state { color: #2563eb; }
.ffz-source { font-size: 0.72rem; margin: 0 0 0.3rem; }
/* The console: collapsible sections; the three farm boxes and Total, each shaded by its % complete. */
.hc-section { margin: 0 0 0.9rem; }
.hc-section > summary { cursor: pointer; font-weight: 800; font-size: 1.05rem; padding: 0.35rem 0; }
.hc-section > summary .hc-year { font-weight: 500; font-size: 0.8rem; margin-left: 0.45rem; }
.hc-fg { margin: 0.1rem 0 0.15rem 0.75rem; overflow-wrap: anywhere; }
.hc-fg > summary { cursor: pointer; font-weight: 700; padding: 0.12rem 0; }
.hc-fg-lines { margin: 0.05rem 0 0.3rem 1rem; padding: 0; list-style: none; overflow-wrap: anywhere; }
.hc-fg-lines li { font-variant-numeric: tabular-nums; }
.hc-farms { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0; }
.hc-farm { position: relative; overflow: hidden; flex: 1 1 14rem; min-width: 13rem; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); }
.hc-shade { position: absolute; inset: 0; background: var(--accent); pointer-events: none; }
.hc-farm-body { position: relative; padding: 0.6rem 0.7rem; }
/* THE YEAR PANE (canon 0.30.346): the harvest year's wet total in its own inset inside the farm box. */
.hc-year-pane { margin-top: 0.45rem; padding: 0.4rem 0.55rem; border: 1px solid rgba(128, 128, 128, 0.35); border-radius: 8px; background: rgba(128, 128, 128, 0.08); }
.hc-farm-name { font-weight: 800; letter-spacing: 0.06em; font-size: 0.95rem; margin-bottom: 0.35rem; }
.hc-total .hc-farm-name { text-transform: uppercase; }
.hc-metrics { margin: 0; display: grid; gap: 0.4rem; }
.hc-metric dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
.hc-metric dd { margin: 0; font-variant-numeric: tabular-nums; }
.hc-value { font-weight: 800; font-size: 1.05rem; }
.hc-sub { display: block; font-size: 0.75rem; }
.hc-date { font-size: 0.68rem; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.hc-hours { display: flex; gap: 0.35rem; align-items: center; }
.hc-hours input[type="number"] { width: 6.5rem; }
.hc-hours button { padding: 0.2rem 0.6rem; font-size: 0.8rem; }
.hc-note { font-size: 0.8rem; }
.hc-stub > summary { opacity: 0.75; }
/* THE TESTING GATE (canon 0.30.293): four panes, the stats row, the failure pie. Eight fixed hues, cycling. */
.hc-gate { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.8rem; }
.hc-gate-pane, .hc-stat { flex: 1 1 10rem; text-align: center; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.7rem 0.45rem 0.6rem; }
.hc-gate-name { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.25rem; }
.hc-gate-pane .hc-icon { width: 7.5rem; height: auto; max-width: 100%; display: block; margin: 0 auto 0.35rem; }
.hc-gate-count { display: block; font-size: 0.75rem; margin-top: 0.15rem; }
.hc-stats { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.6rem; }
.hc-stat .hc-value { font-size: 1.35rem; }
.hc-pie-block { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; padding: 0.7rem; }
.hc-pie { width: 11rem; height: auto; flex: 0 0 auto; }
.hc-pie-side { flex: 1 1 16rem; }
.hc-pie-legend { list-style: none; margin: 0; padding: 0; }
.hc-pie-legend li { margin: 0.15rem 0; }
.hc-pie-pick { display: flex; gap: 0.45rem; align-items: baseline; width: 100%; background: transparent; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0.15rem 0; }
.hc-pie-swatch { width: 0.7rem; height: 0.7rem; border-radius: 0.12rem; background: currentColor; display: inline-block; flex: 0 0 auto; }
.hc-pie-strains { margin-top: 0.4rem; }
.hc-pie-strains[hidden] { display: none; }
.hc-pie-seg { cursor: pointer; stroke: var(--panel, var(--surface, #111111)); stroke-width: 0.4; }
.hc-pie-1 { color: #d6453d; }
.hc-pie-2 { color: #e6a23c; }
.hc-pie-3 { color: #2e9e4f; }
.hc-pie-4 { color: #2f6fd6; }
.hc-pie-5 { color: #7b4bdb; }
.hc-pie-6 { color: #1aa6b7; }
.hc-pie-7 { color: #d63384; }
.hc-pie-8 { color: #c4a35a; }
/* FULFILLMENT (canon 0.30.306): ten fixed hues, the pie's eight and two more, one per row. */
.hc-fill { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.8rem; }
.hc-fill-pane { flex: 1 1 16rem; text-align: center; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.7rem 0.45rem 0.6rem; }
.hc-fill-beside { display: flex; align-items: center; gap: 0.45rem; }
.hc-fill-beside .hc-icon { width: 7.5rem; flex: 0 0 auto; margin: 0; }
.hc-fill-band { flex: 1 1 auto; width: 100%; height: 2.5rem; min-width: 3rem; }
.hc-fill-legend { list-style: none; margin: 0.45rem 0 0; padding: 0; text-align: left; font-size: 0.78rem; }
.hc-fill-legend li { margin: 0.12rem 0; }
.hc-fill-swatch { width: 0.7rem; height: 0.7rem; border-radius: 0.12rem; background: currentColor; display: inline-block; margin-right: 0.35rem; vertical-align: -0.08rem; }
.hc-fill-1 { color: #d6453d; }
.hc-fill-2 { color: #e6a23c; }
.hc-fill-3 { color: #2e9e4f; }
.hc-fill-4 { color: #2f6fd6; }
.hc-fill-5 { color: #7b4bdb; }
.hc-fill-6 { color: #1aa6b7; }
.hc-fill-7 { color: #d63384; }
.hc-fill-8 { color: #c4a35a; }
.hc-fill-9 { color: #2a9d8f; }
.hc-fill-10 { color: #e07a3d; }
.fulfill-grid { width: 100%; border-collapse: collapse; }
.fulfill-grid th, .fulfill-grid td { padding: 0.25rem 0.4rem; vertical-align: middle; }
.fulfill-grid input[type="number"] { width: 6.5rem; }
@media (max-width: 600px) { .hc-gate-pane .hc-icon { width: 4.5rem; } .hc-fill-beside .hc-icon { width: 4.5rem; } .hc-fill-band { height: 1.5rem; } }
/* THE TRIMMING SECTION (canon 0.30.88): two shift cards, each a waffle pictograph (100 cells, one per percent of the weight ran, BUD in the silo green, OTHER quiet) beside his six lines. */
.hc-shifts { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0; }
.hc-shift { flex: 1 1 22rem; min-width: 18rem; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.6rem 0.7rem; }
.hc-shift-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin-bottom: 0.45rem; }
.hc-shift-name { font-weight: 800; letter-spacing: 0.06em; font-size: 0.95rem; }
.hc-shift-ops { font-size: 0.78rem; }
.hc-shift-body { display: flex; gap: 0.9rem; align-items: flex-start; }
/* THE TRIM LINE PICTURE (canon 0.30.154): his machine picture in each shift card; nodes in our panel and line colors, the flow bars in the continuum tubes' greens, moving only while the line runs. */
.hc-shift-stack { flex-direction: column; align-items: stretch; }
.hc-visuals { display: flex; gap: 0.9rem; align-items: flex-start; }
.hc-visuals .hc-trimline { flex: 3 1 26rem; min-width: 0; margin: 0; }
.hc-bud-col { flex: 0 0 14rem; }
.hc-bud { display: block; width: 100%; height: auto; }
.hc-bud-bud { fill: #2e9e4f; }
/* THE PLUME (canon 0.30.207): the two stem cells are permanent and draw as any unconsumed cell, not a color of their own. */
.hc-bud-stem { fill: #2e9e4f; }
.hc-bud-consumed { fill: #b5bab3; }
/* THE PRODUCT LINE (canon 0.30.243): the first sixty consumed cells grey as byproduct; a consumed cell of the last forty is waste, deep red (THE DEEP RED, 0.30.248; the dark green of 0.30.245 before it). */
.hc-bud-consumed[data-hc-bud-waste] { fill: #7c1b1b; }
/* THE THROBBING WASTE (canon 0.30.266): the deep red pulses while a waste cell is drawn. The trough stays at 0.55 so it never reads as the grey beside it. The legend swatch does not pulse. */
.hc-bud-consumed[data-hc-bud-waste] { animation: hc-waste-throb 1.6s ease-in-out infinite; }
@keyframes hc-waste-throb { 0%, 100% { fill-opacity: 0.55; } 50% { fill-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-bud-consumed[data-hc-bud-waste] { animation-duration: 3.2s; } }
.hc-bud-empty { fill: none; stroke: var(--line, var(--border, #88888899)); stroke-width: 0.6; }
.hc-btr-read { font-variant-numeric: tabular-nums; margin: 0.3rem 0 0.15rem; }
.hc-legend { font-size: 0.72rem; }
.hc-swatch { display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 0.12rem; margin: 0 0.22rem 0 0; vertical-align: -0.08rem; }
.hc-swatch-bud { background: #2e9e4f; }
.hc-swatch-consumed { background: #b5bab3; margin-left: 0.45rem; }
.hc-swatch-waste { background: #7c1b1b; margin-left: 0.45rem; }
.hc-trimline { display: block; width: 100%; max-width: 46rem; height: auto; margin: 0 auto 0.5rem; }
.hc-trim-rightnow { margin: 0 0 0.8rem; }
.hc-trim-rightnow .hc-trimline { max-width: none; max-height: 70vh; }
.hc-trim-down { color: var(--danger, #8b2e2e); font-weight: 800; }
.hc-btr-bar { position: relative; margin: 0.4rem 0 0.2rem; }
.hc-btr-track { position: relative; display: flex; height: 1.15rem; border: 1px solid var(--line, var(--border, #88888899)); border-radius: 0.2rem; }
.hc-btr-fill { background: #2e9e4f; height: 100%; }
.hc-btr-rest { background: #b5bab3; flex: 1 1 auto; min-width: 0; }
.hc-btr-bar-empty .hc-btr-track { background: transparent; }
.hc-btr-tick { position: absolute; top: 0; width: 2px; height: 1.15rem; background: var(--text, currentColor); transform: translateX(-1px); }
.hc-btr-bogey { position: absolute; top: 1.2rem; font-size: 0.68rem; transform: translateX(-50%); }
.hc-btr-bar .hc-btr-read { display: block; margin-top: 1.1rem; text-align: right; font-variant-numeric: tabular-nums; }
.hc-bud-col { margin-left: auto; margin-right: auto; }
.hc-trim-totals { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.7rem 0; }
.hc-trim-total { min-width: 8rem; }
.hc-trimline .hc-node { fill: var(--panel, var(--surface, transparent)); stroke: var(--line, var(--border, #88888899)); stroke-width: 3; }
.hc-trimline text { fill: var(--text, currentColor); text-anchor: middle; font-family: inherit; }
.hc-trimline .hc-node-label { font-weight: 800; font-size: 30px; letter-spacing: 0.06em; }
.hc-trimline .hc-node-label-big { font-size: 40px; }
.hc-trimline .hc-node-label-small { font-size: 25px; letter-spacing: 0.04em; }
.hc-trimline .hc-node-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hc-trimline .hc-node-sub { font-size: 17px; opacity: 0.75; font-variant-numeric: tabular-nums; }
.hc-trimline .hc-node-muted { opacity: 0.55; font-weight: 400; }
.hc-trimline .hc-flow-a { fill: #43c07a; }
.hc-trimline .hc-flow-b { fill: #2a7d4f; }
.hc-trimline .hc-converge polyline { fill: none; stroke: var(--line, var(--border, #88888899)); stroke-width: 3; stroke-linejoin: round; }
.hc-trimline .hc-converge-dot { fill: var(--line, var(--border, #88888899)); }
.hc-trimline .hc-total-label { font-size: 20px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; }
.hc-trimline .hc-total-value { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
.hc-running { color: #2e9e4f; font-weight: 800; letter-spacing: 0.1em; font-size: 0.8rem; animation: hc-running 1.6s ease-in-out infinite; }
@keyframes hc-running { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-running { animation-duration: 3.2s; } }
/* BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334): the Right now pane's two halves (stacked on the phone), the Rad's green throb like a loading silo (slowed, never stilled, under reduced motion, canon 0.30.79), his CRYO, AMAPS, UV picture in the plume's deep red (canon 0.30.248) with a darker band, the five-figure row of the shift panes. */
.hc-past-rightnow { margin: 0 0 0.8rem; }
.hc-past-halves { display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: stretch; }
.hc-past-half { border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.6rem 0.7rem; }
.hc-past-rad { flex: 1 1 14rem; min-width: 12rem; text-align: center; }
.hc-past-rad .hc-icon { width: 9rem; height: auto; max-width: 100%; display: block; margin: 0.2rem auto 0.4rem; color: #2e9e4f; }
.hc-rad-throb path { animation: hc-rad-throb 1.6s ease-in-out infinite; }
@keyframes hc-rad-throb { 0%, 100% { stroke-opacity: 0.3; } 50% { stroke-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-rad-throb path { animation-duration: 3.2s; } }
.hc-rad-lots { font-weight: 800; font-variant-numeric: tabular-nums; margin: 0.2rem 0; overflow-wrap: anywhere; }
.hc-past-rad .silo-clock { display: block; margin-top: 0.25rem; }
.hc-past-cryo { flex: 3 1 30rem; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: flex-start; }
.hc-cryoline { display: block; flex: 3 1 22rem; min-width: 0; max-width: 40rem; height: auto; }
.hc-cryoline .hc-node { fill: var(--panel, var(--surface, transparent)); stroke: var(--line, var(--border, #88888899)); stroke-width: 3; }
.hc-cryoline text { fill: var(--text, currentColor); text-anchor: middle; font-family: inherit; }
.hc-cryoline .hc-node-label { font-weight: 800; font-size: 40px; letter-spacing: 0.06em; }
.hc-cryoline .hc-node-value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hc-cryoline .hc-node-sub { font-size: 18px; opacity: 0.75; font-variant-numeric: tabular-nums; }
.hc-cryoline .hc-cryo-flow-a { fill: #7c1b1b; }
.hc-cryoline .hc-cryo-flow-b { fill: #4a0f0f; }
.hc-cryo-side { flex: 1 1 12rem; min-width: 11rem; }
.hc-cryo-list { margin: 0.3rem 0 0; display: grid; gap: 0.3rem; }
.hc-cryo-list dt { font-size: 0.7rem; letter-spacing: 0.05em; opacity: 0.8; }
.hc-cryo-list dd { margin: 0; font-variant-numeric: tabular-nums; }
.hc-past-figures { margin: 0.2rem 0 0.6rem; gap: 0.35rem; }
.hc-past-figures .hc-gate-pane { flex: 1 1 5rem; min-width: 5rem; padding: 0.45rem 0.15rem 0.4rem; }
.hc-past-figures .hc-gate-name { font-size: 0.62rem; letter-spacing: 0.02em; }
.hc-past-figures .hc-icon { width: 100%; max-width: 5rem; margin-bottom: 0.25rem; }
/* The V10 gate's fix (canon 0.30.337): a number never breaks between its digits; the row wraps instead. */
.hc-past-figures .hc-value { font-size: 0.95rem; overflow-wrap: normal; }
body.device-phone .hc-past-half { flex-basis: 100%; }
.hc-sheet-hours dd { font-variant-numeric: tabular-nums; }
.hc-shift .hc-metrics { flex: 1 1 auto; }
body.device-phone .hc-shift { flex-basis: 100%; }
body.device-phone .hc-shift-body { flex-wrap: wrap; }
body.device-phone .hc-visuals { flex-wrap: wrap; }
body.device-phone .hc-farm { flex-basis: 100%; }
.inv-gauge { border-radius: 14px; min-height: 12rem; justify-content: flex-start; }
/* Canon 0.30.6: the silo strip with running clocks, above every Drying Operations page (canon 0.30.69: cone-topped cylinders). */
.silo-strip { margin: 0 0 0.6rem; }
.silo-gauge .inv-lot-id a { color: inherit; text-decoration: none; }
.silo-clock { font-variant-numeric: tabular-nums; font-weight: 700; }
.silo-clock-state { font-size: 0.75rem; }
.silo-controls form { display: inline-block; }
.silo-controls button[disabled] { opacity: 0.45; cursor: not-allowed; }
.inv-total { margin: 0.5rem 0; background: var(--panel-2); border: 2px solid var(--line); border-radius: 8px; padding: 0 0.7rem 0.5rem; }
.inv-pareto { display: flex; align-items: flex-end; gap: 0.5rem; height: 12rem; margin: 0.8rem 0; }
.inv-pareto-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-width: 0; height: 100%; }
.inv-pareto-bar { width: 100%; background: var(--accent); min-height: 4px; border-radius: 4px 4px 0 0; }
.inv-pareto-label { font-size: 0.75rem; font-weight: 700; margin-top: 0.3rem; word-break: break-all; }
.inv-fg-type { margin: 0.4rem 0; }
.inv-fg-type > summary { display: flex; align-items: center; gap: 0.7rem; cursor: pointer; min-height: 2.6rem; }
/* Canon 0.30.36: the Zoho pane groups its offerings by category. */
.zoho-cat { margin: 0.5rem 0; }
.zoho-cat > summary { cursor: pointer; min-height: 2.4rem; display: flex; align-items: center; gap: 0.6rem; }
.zoho-cats { margin: 0.6rem 0 1rem; }
table.data td code { font-size: 0.85em; }
/* THE TAG LAW and THE METRC MIRROR (canon 0.30.38) */
.metrc-tag-input { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.04em; min-width: 17ch; }
.tag-missing { font-style: italic; white-space: nowrap; }
.tag-shape-note { cursor: help; }
.metrc-tag-shown { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.crumb { margin: 0 0 0.6rem; }
.metrc-holdings, .metrc-cross, .metrc-lookup, .metrc-drop, .metrc-mounts { margin: 0 0 1.4rem; }
.internal-fields form { flex-wrap: wrap; }
.inv-fg-code { font-weight: 800; flex: 0 0 clamp(3.4rem, 28vw, 11rem); overflow-wrap: anywhere; line-height: 1.1; }
.inv-fg-track { flex: 1; height: 1.4rem; background: var(--panel-2); border: 2px solid var(--line); border-radius: 6px; overflow: hidden; }
.inv-fg-bar { display: block; height: 100%; background: var(--accent); }
.inv-fg-stock { font-weight: 700; min-width: 4rem; text-align: right; }
.inv-fg-unit { font-weight: 400; font-size: 0.85em; }
.inv-fg-note { margin: 0.2rem 0 0.4rem; }
.inv-fg-heading { margin: 1rem 0 0.3rem; }
@media (max-width: 600px) { .inv-fg-type > summary { flex-wrap: wrap; row-gap: 0.2rem; } .inv-fg-code { flex-basis: 100%; } }
.acquire-split .recall-pane { flex: 1 1 16rem; }
.recall-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
.recall-hbn-label { font-weight: 700; word-break: break-all; }
.recall-btn { min-width: 2.8rem; min-height: 2.8rem; padding: 0; font-size: 1.4rem; }
/* =====================================================================
   BRAND LOCKUP, VIEW PILL CO MARK, DEVICE MODE, FULFILLMENT WRAPPER
   (owner rulings 2026-09-01, a brand slice). The owner's universal-bar
   ruling supersedes Lite byte-preservation for the brand block only;
   everything above this banner stays the preserved pre-Cerberus sheet.
   Lockup ink is near-black on Lite; the chip stays CSS-embossed steel
   (picked over a photo crop because it stays crisp at 26px tall).
   --------------------------------------------------------------------- */
.brand-lockup { display: inline-flex; align-items: center; gap: 0.5rem; position: relative; color: #1c1914; padding-right: 0.9rem; }
.brand-grip { height: 26px; width: auto; display: block; }
.brand-factory {
  position: relative; display: inline-flex; align-items: center;
  height: 26px; padding: 0 0.7rem;
  background: linear-gradient(180deg, #6a6e75, #43464c 55%, #33363b);
  border: 1px solid #23252a; border-radius: 3px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.5);
  font-weight: 800; font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: #17181c; text-shadow: 0 1px 0 rgba(255,255,255,0.25);
}
.brand-factory::before, .brand-factory::after {
  content: ""; position: absolute; top: 50%; transform: translateY(-50%);
  width: 4px; height: 4px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #9aa0a8, #22242a);
}
.brand-factory::before { left: 3px; }
.brand-factory::after { right: 3px; }
.brand-lite {
  position: absolute; right: -0.15rem; bottom: -0.55rem;
  font-weight: 800; font-style: italic; text-transform: lowercase;
  font-size: 0.95rem; line-height: 1; letter-spacing: 0.02em;
  transform: rotate(-14deg); pointer-events: none;
  color: #1c1914;
  text-shadow: 0 0 1px rgba(28,25,20,0.85), 0 0 5px rgba(28,25,20,0.4), 1px 1px 9px rgba(28,25,20,0.25);
}
.co-pill-mark { height: 1em; width: auto; display: block; }
.saleshelper-embed { width: calc(100vw - 1.25rem); margin-left: calc(50% - 50vw); margin-top: -1.2rem; }
.saleshelper-frame { display: block; width: 100%; border: 0; min-height: 480px; height: calc(100vh - 5.5rem); }
.saleshelper-embed-pane { margin-top: 0.8rem; }
.saleshelper-embed-pane .saleshelper-frame { min-height: 480px; height: calc(100vh - 12rem); }
/* Owner ruling 2026-09-01: the device pill's phone mode. Layout reflows
   rather than pinch-zooming: the two-pane station split stacks (pane above,
   working pane below by source order), tiles and buttons go full width with
   larger touch targets, tables scroll horizontally in place, and the base
   font steps up a notch. The meta viewport stays width=device-width. */
body.device-phone { font-size: 1.35rem; }
body.device-phone .station-split { flex-direction: column; }
body.device-phone .queue-pane { max-width: none; width: 100%; flex: 1 1 auto; }
body.device-phone .working-pane { width: 100%; flex: 1 1 auto; }
body.device-phone .tiles { grid-template-columns: 1fr; }
body.device-phone main button, body.device-phone main .btn { width: 100%; min-height: 3.4rem; }
body.device-phone table.data { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
/* Owner ruling 2026-09-02: operations map. Lite keeps the chunky 2px look.
   Phone mode is a single vertical chain; nothing scrolls horizontally. */
.ops-map { --ops-arrow: var(--accent); }
.ops-map-desktop { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; width: 100%; overflow-x: hidden; }
.ops-map-phone { display: none; }
.ops-row {
  display: grid; width: 100%; max-width: 44rem;
  grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr);
  align-items: center; justify-items: center; gap: 0.45rem 0.5rem;
}
.ops-row-down .ops-arrow-down { grid-column: 5; }
.ops-spacer { display: block; width: 0; height: 0; }
.ops-island { margin: 0; }
/* Owner ruling 2026-09-02 (map polish): rounded softkeys with a slight shine,
   raised at rest and pressed on tap; no numbers under the labels; the icons
   sized to fill the key. */
.ops-node {
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  text-decoration: none; color: inherit; gap: 0.35rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0) 55%), var(--panel);
  border: 2px solid var(--line); border-radius: 18px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 3px 0 rgba(28,25,20,0.16), 0 8px 14px rgba(28,25,20,0.18);
  padding: 1rem 0.55rem 0.9rem; min-width: 0; width: 100%; max-width: 11rem; min-height: 7.2rem;
}
.ops-node:focus, .ops-node:hover { border-color: var(--accent); }
.ops-node:active {
  transform: translateY(2px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 0 rgba(28,25,20,0.16), 0 3px 6px rgba(28,25,20,0.16);
}
.ops-node-stub { opacity: 0.8; border-left: 6px solid #d97706; }
.ops-node-stub:focus, .ops-node-stub:hover { border-left-color: #d97706; }
.ops-icon-svg { width: 3.4rem; height: 3.4rem; display: block; }
.ops-label { display: block; font-weight: 700; margin: 0; font-size: 0.88rem; }
.ops-menu-lines { display: flex; flex-direction: column; gap: 0.08rem; width: 100%; min-width: 0; max-width: 100%; }
.ops-menu-line { display: flex; flex-wrap: wrap; align-items: baseline; width: 100%; max-width: 100%; min-width: 0; font-size: 0.44rem; line-height: 1.15; font-weight: 600; }
.ops-menu-name { flex: 0 1 auto; min-width: 0; white-space: nowrap; }
.ops-menu-status { flex: 0 0 auto; max-width: 100%; white-space: nowrap; }
.ops-menu-dots { flex: 1 1 0.4rem; overflow: hidden; min-width: 0.4rem; white-space: nowrap; }
.ops-menu-dots::before { content: "................................................"; }
@media (max-width: 480px) {
  .ops-menu-dots { display: none; }
  .ops-menu-name, .ops-menu-status { flex: 1 0 100%; white-space: normal; }
  .ops-menu-status { text-align: right; }
}
.ops-arrow { color: var(--ops-arrow); flex: 0 0 auto; }
.ops-arrow-right, .ops-arrow-left, .ops-arrow-down {
  display: block; width: 0; height: 0;
}
.ops-arrow-right { border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-left: 16px solid currentColor; }
.ops-arrow-left { border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-right: 16px solid currentColor; }
.ops-arrow-down { border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 16px solid currentColor; }
body.device-phone .ops-map { overflow-x: hidden; width: 100%; }
body.device-phone .ops-map-desktop { display: none; }
body.device-phone .ops-map-phone {
  display: flex; flex-direction: column; align-items: center; gap: 0.45rem;
}
body.device-phone .ops-map-phone .ops-node { width: 100%; max-width: 18rem; }
/* THE BAR CARRIES REPORTS AND ADMIN (canon 0.30.201; owner, 2026-09-23: "make
   "reports" and "admin" always on top of the screen"). The 2026-09-02 lock to
   the bottom right is reversed: the two ride at the end of the app bar, Reports
   left of Admin, and main keeps no clearance for them. */
.bar-actions { display: flex; align-items: center; gap: 0.55rem; margin-left: auto; }
.models-link, .harvest-link, .maintenance-link, .admin-link, .reports-link {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 2.5rem; padding: 0.35rem 1rem;
  background: var(--accent); color: var(--accent-text);
  border: 2px solid var(--accent); border-radius: var(--radius);
  font-weight: 700; text-decoration: none;
}
.models-link:focus, .models-link:hover, .harvest-link:focus, .harvest-link:hover, .maintenance-link:focus, .maintenance-link:hover, .admin-link:focus, .admin-link:hover, .reports-link:focus, .reports-link:hover { outline: 3px solid var(--focus); outline-offset: 1px; }
${walkSliceChrome("lite")}
/* =====================================================================
   LITE IDENTITY LAW (canon 0.20.1, owner verbatim: "Lite Should contain
   no icons, no animations, and no background texture. Simplify the
   buttons.") These overrides close the sheet and win its cascade.
   --------------------------------------------------------------------- */
*, *::before, *::after { transition: none !important; animation: none !important; }
html, body { background-image: none !important; }
body::before, body::after { display: none !important; }
.ops-node, .ops-node-stub, button, .btn, .models-link, .harvest-link, .maintenance-link, .admin-link, .reports-link,
.locale-pill, .locale-pill button, .view-pill, .view-pill button, .device-opt {
  box-shadow: none !important; background-image: none !important;
  text-shadow: none !important; border-radius: 6px;
}
.ops-node { min-height: 0; padding: 0.9rem 1rem; }
.ops-node:active, button:active, .models-link:active, .harvest-link:active, .maintenance-link:active, .admin-link:active, .reports-link:active { transform: none !important; }
.locale-pill { border-radius: 999px; }
.locale-pill button { border-radius: 0; }`;
}

/** The CO (Continuum) view stylesheet (owner dispatch 2026-09-02). The source
 * of truth is Christine Selden's styles.css, vendored untouched at
 * prompts/2026-08-17_continuum_styles.css; its selectors target the Continuum
 * site's own markup, so this sheet carries its tokens and design language onto
 * our selectors instead: warm paper ground with the diagonal pinstripe and
 * radial glows, amber and copper primary, Palatino display over a system sans
 * body, 1px hairlines, 14px radius cards with lift-on-hover, pill buttons,
 * uppercase letterspaced labels, and her light default with the dark variant
 * riding prefers-color-scheme (our data-theme attribute carries the grip/c10
 * env, never light/dark, so the tokens live on bare :root plus the media
 * query). The eyebrow bar stands in for her em dash tag prefix (G-8). */
export function coStylesheet(): string {
  return `:root {
  color-scheme: dark;
  --bg: #0e0f11;
  --surface: #17181b;
  --surface-2: #1e2024;
  --text: #e9e9ea;
  --muted: #8a8c90;
  --primary: #c88a3c;
  --primary-strong: #d99a4a;
  --primary-soft: rgba(200, 138, 60, 0.16);
  --accent: #d9a24a;
  --accent-soft: rgba(217, 162, 74, 0.16);
  --alert: #ef8a6f;
  --alert-soft: rgba(239, 138, 111, 0.16);
  --ok: #7fb494;
  --ok-soft: rgba(127, 180, 148, 0.16);
  --glow-a: rgba(200, 138, 60, 0.13);
  --glow-b: rgba(217, 162, 74, 0.09);
  --row-line: rgba(255, 255, 255, 0.02);
  --border: #2a2b30;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.45), 0 18px 36px -22px rgba(0, 0, 0, 0.75);
  --shadow-hover: 0 2px 6px rgba(0, 0, 0, 0.5), 0 26px 48px -22px rgba(0, 0, 0, 0.85);
  --radius: 14px;
  --key-sheen: rgba(255, 255, 255, 0.07);
  --font-display: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif;
}
/* Christine's paper-light tokens, retained for a future flip-back:
  --bg: #f6f4ef; --surface: #ffffff; --surface-2: #efeade; --text: #1b1913;
  --muted: #6e685c; --primary: #b3762b; --primary-strong: #8f5d1f;
  --key-sheen: rgba(255, 255, 255, 0.75); */
@media (prefers-color-scheme: light) {
  :root {
    --bg: #0e0f11;
    --surface: #17181b;
    --surface-2: #1e2024;
    --text: #e9e9ea;
    --muted: #8a8c90;
    --primary: #c88a3c;
    --primary-strong: #d99a4a;
    --primary-soft: rgba(200, 138, 60, 0.16);
    --accent: #d9a24a;
    --accent-soft: rgba(217, 162, 74, 0.16);
    --alert: #ef8a6f;
    --alert-soft: rgba(239, 138, 111, 0.16);
    --ok: #7fb494;
    --ok-soft: rgba(127, 180, 148, 0.16);
    --glow-a: rgba(200, 138, 60, 0.13);
    --glow-b: rgba(217, 162, 74, 0.09);
    --row-line: rgba(255, 255, 255, 0.02);
    --border: #2a2b30;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.45), 0 18px 36px -22px rgba(0, 0, 0, 0.75);
    --shadow-hover: 0 2px 6px rgba(0, 0, 0, 0.5), 0 26px 48px -22px rgba(0, 0, 0, 0.85);
    --key-sheen: rgba(255, 255, 255, 0.07);
  }
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e0f11;
    --surface: #17181b;
    --surface-2: #1e2024;
    --text: #e9e9ea;
    --muted: #8a8c90;
    --primary: #c88a3c;
    --primary-strong: #d99a4a;
    --primary-soft: rgba(200, 138, 60, 0.16);
    --accent: #d9a24a;
    --accent-soft: rgba(217, 162, 74, 0.16);
    --alert: #ef8a6f;
    --alert-soft: rgba(239, 138, 111, 0.16);
    --ok: #7fb494;
    --ok-soft: rgba(127, 180, 148, 0.16);
    --glow-a: rgba(200, 138, 60, 0.13);
    --glow-b: rgba(217, 162, 74, 0.09);
    --row-line: rgba(255, 255, 255, 0.02);
    --border: #2a2b30;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.45), 0 18px 36px -22px rgba(0, 0, 0, 0.75);
    --shadow-hover: 0 2px 6px rgba(0, 0, 0, 0.5), 0 26px 48px -22px rgba(0, 0, 0, 0.85);
    --key-sheen: rgba(255, 255, 255, 0.07);
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-body);
  color: var(--text);
  font-size: 1.15rem;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  background-color: var(--bg);
  background-image:
    repeating-linear-gradient(118deg, transparent 0 27px, var(--row-line) 27px 28px),
    radial-gradient(1100px 620px at 8% -12%, var(--glow-a), transparent 60%),
    radial-gradient(960px 720px at 112% 118%, var(--glow-b), transparent 55%);
  background-attachment: fixed;
}
a { color: var(--primary); }
a:hover { color: var(--primary-strong); }
header.app-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.4rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.brand { font-weight: 700; letter-spacing: 0.04em; }
nav a { margin-right: 0.9rem; font-weight: 600; text-decoration: none; }
nav a:hover { text-decoration: underline; }
main { max-width: 89rem; margin: 0 auto; padding: 1.6rem 1.2rem 2.5rem; }
h1, h2, h3 { font-family: var(--font-display); font-weight: 700; }
h1 { font-size: 2.1rem; line-height: 1.12; margin: 0 0 1.1rem; text-wrap: balance; }
h2 { font-size: 1.35rem; line-height: 1.15; margin: 1.4rem 0 0.6rem; }
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.9rem;
}
.tile {
  display: block;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.05rem 1.15rem;
  text-decoration: none;
  color: inherit;
  min-height: 6.5rem;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.tile:focus, .tile:hover {
  border-color: var(--primary);
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
}
.tile-stub { opacity: 0.8; border-left: 6px solid #d97706; }
.tile-stub:focus, .tile-stub:hover { border-left-color: #d97706; }
.tile-kind {
  display: flex; align-items: center; gap: 0.55rem;
  font-size: 0.68rem; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.18em;
}
.tile-kind::before { content: ""; width: 20px; height: 2px; background: var(--primary); flex: 0 0 auto; }
.tile-title { display: block; font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; margin: 0.35rem 0; }
.tile-count { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums; }
.banner {
  padding: 0.85rem 1.05rem;
  border: 1px solid var(--border);
  border-left: 3px solid var(--primary);
  border-radius: 0 10px 10px 0;
  margin-bottom: 1rem;
  background: var(--surface);
}
.banner.ok { border-left-color: var(--ok); background: var(--ok-soft); }
.banner.err { border-left-color: var(--alert); background: var(--alert-soft); color: var(--alert); }
.hbn-mint {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  word-break: break-all;
  font-variant-numeric: tabular-nums;
  background: var(--primary-soft);
  border: 1px solid var(--primary);
  color: var(--text);
  padding: 0.85rem 1.05rem;
  border-radius: var(--radius);
  margin: 0.6rem 0 1rem;
}
form.stack, .stack { display: flex; flex-direction: column; gap: 0.85rem; max-width: 40rem; }
label.field { display: flex; flex-direction: column; gap: 0.3rem; font-weight: 600; }
input, select, textarea, button { font-family: inherit; font-size: 1.1rem; line-height: 1.3; }
input[type="text"], input[type="date"], input[type="time"], input[type="number"], input[type="file"], select, textarea {
  width: 100%;
  min-height: 2.8rem;
  padding: 0.45rem 0.7rem;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
}
textarea { min-height: 5rem; }
input:focus, select:focus, textarea:focus, button:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
a:focus-visible, summary:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}
button, .btn {
  min-height: 2.8rem;
  padding: 0.45rem 1.25rem;
  border-radius: 999px;
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
}
button:hover, .btn:hover { background: var(--primary-strong); border-color: var(--primary-strong); transform: translateY(-1px); box-shadow: var(--shadow-hover); }
button.secondary, a.btn.secondary {
  background: var(--surface);
  color: var(--primary);
  border-color: var(--border);
}
button.secondary:hover, a.btn.secondary:hover { background: var(--surface); color: var(--primary-strong); border-color: var(--primary); }
button.danger { background: var(--alert); border-color: var(--alert); color: #fff; }
button.danger:hover { background: var(--alert); border-color: var(--alert); }
.row-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
table.data {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
  font-size: 1rem;
}
table.data th, table.data td {
  text-align: left;
  padding: 0.6rem 0.7rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
table.data td { font-variant-numeric: tabular-nums; }
table.data th {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
table.data tbody tr:nth-child(even) td { background: rgba(255, 255, 255, 0.02); }
table.data tbody tr:hover td { background: var(--surface-2); }
.person-form { display: flex; gap: 0.4rem; align-items: center; }
.person-form select { min-width: 12rem; }
.locale-pill { display: flex; border: 1px solid var(--border); border-radius: 999px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow); }
.locale-pill button {
  min-height: 2.2rem;
  min-width: 3.2rem;
  padding: 0.2rem 0.7rem;
  border: 0;
  border-radius: 0;
  background: var(--surface);
  color: var(--muted);
  font-weight: 700;
  box-shadow: none;
}
.locale-pill button:hover { transform: none; box-shadow: none; background: var(--surface-2); color: var(--text); }
.locale-pill button.active { background: var(--primary); color: #fff; }
.locale-pill button.active:hover { background: var(--primary); color: #fff; }
.muted { color: var(--muted); }
.pkg-table { max-width: none; width: 100%; }
.wide { max-width: none; }
.station-split { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.queue-pane {
  flex: 1 1 16rem;
  max-width: 22rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1rem;
}
.queue-pane h2 { margin: 0 0 0.8rem; padding-bottom: 0.6rem; border-bottom: 1px solid var(--border); font-size: 1.2rem; }
.queue-pane ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.queue-pane a.queue-pane-item {
  display: block;
  min-height: 2.8rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: inherit;
  font-weight: 600;
  text-decoration: none;
  word-break: break-all;
  transition: border-color 0.15s, background 0.15s;
}
.queue-pane a.queue-pane-item:focus, .queue-pane a.queue-pane-item:hover { border-color: var(--primary); background: var(--primary-soft); }
.queue-pane a.queue-pane-item.selected { border-color: var(--primary); background: var(--primary-soft); box-shadow: inset 3px 0 0 var(--primary); }
.pane-group { margin: 0 0 0.5rem; }
.pane-group summary {
  cursor: pointer;
  min-height: 2.8rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-2);
  font-weight: 600;
}
.pane-group summary:focus, .pane-group summary:hover { border-color: var(--primary); }
.pane-group ul { margin-top: 0.5rem; }
.working-pane { flex: 3 1 24rem; min-width: 0; }
.working-pane .working-pick { margin-top: 0; }
.working-pick {
  display: inline-block;
  border-bottom: 2px solid var(--primary);
  padding-bottom: 0.25rem;
  font-variant-numeric: tabular-nums;
}
.move-to-row { display: flex; gap: 0.4rem; align-items: center; }
.move-to-row select { flex: 1; }
.move-to-row button { white-space: nowrap; }
.resume-lots { margin: 0 0 1rem; }
.resume-lots h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
.resume-lots ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.resume-lots a { font-weight: 600; }
.start-another > summary {
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0.4rem 0;
}
.start-another > summary:hover { color: var(--primary); }
.lot-meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; margin: 0 0 1rem; }
.lot-meta dt {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  align-self: baseline;
  padding-top: 0.2rem;
}
.lot-meta dd { margin: 0; font-variant-numeric: tabular-nums; }
.weights-pane {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1rem;
  max-width: 46rem;
}
.weights-pane h3 { margin: 0 0 0.8rem; padding-bottom: 0.55rem; border-bottom: 1px solid var(--border); font-size: 1.15rem; }
.weights-controls { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; margin-bottom: 0.8rem; }
.weights-controls input[type="number"] { width: 11rem; }
.weights-numbered .weight-seq { width: 3.2rem; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* THE PLANT COUNT (canon 0.30.62): the finish form toggles the hidden attribute on its
   button and prompt; the button rule's display inline-flex would defeat the UA's [hidden]
   (the 2026-09-01 boot-slot lesson), so hidden is absolute inside this form. */
.finish-with-plants [hidden] { display: none !important; }
.finish-with-plants { flex-wrap: wrap; }
.finish-with-plants .plant-prompt { flex: 1 1 100%; }
/* THE EFFECTIVE DATE (canon 0.30.92): the collapsed field on a transactional form; the
   summary is the tap target, the open block stacks its date and PIN like any field. */
.effective-date { margin: 0.35rem 0 0.6rem; }
.effective-date > summary { cursor: pointer; padding: 0.35rem 0; font-weight: 700; }
.effective-date > summary:focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
.effective-date .field { margin-top: 0.4rem; }
.lot-total { font-size: 1.15rem; margin-top: 1rem; }
.lot-total strong { font-family: var(--font-display); font-size: 1.6rem; color: var(--primary); font-variant-numeric: tabular-nums; }
.inv-actions { margin-bottom: 1.2rem; }
.inv-section { margin: 0 0 0.7rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 0.4rem 0.9rem 0.7rem; }
.inv-section > summary, .inv-total > summary {
  cursor: pointer; min-height: 2.8rem; padding: 0.6rem 0.2rem; font-weight: 700; font-family: var(--font-display); font-size: 1.1rem;
}
.inv-section > summary:focus, .inv-total > summary:focus { outline: 3px solid var(--primary); outline-offset: 1px; }
.inv-gauges { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.8rem 0 1rem; }
.inv-gauge {
  width: 10.5rem; min-height: 10.5rem; border-radius: 50%;
  border: 2px solid var(--primary); background: var(--primary-soft);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 0.8rem; font-size: 0.85rem;
}
.inv-gauge-hang { border-radius: var(--radius); width: 12.5rem; min-height: 10.5rem; }
.inv-gauge-name { font-family: var(--font-display); font-weight: 700; margin-bottom: 0.35rem; }
.inv-lot { margin: 0.25rem 0; }
.inv-lot-id { font-weight: 700; font-variant-numeric: tabular-nums; }
/* THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69): a silo is a cone-topped cylinder wireframe with its live fill, never a circle. */
.silo-shape { width: 11.2rem; height: 8.4rem; display: block; margin: 0.15rem auto 0.25rem; overflow: visible; }
/* THE WIDE SILO (canon 0.30.71): the silo card widens to hold the shape; its height is untouched. */
.silo-gauge { width: 13.6rem; }
/* THE ROWS (canon 0.30.383): one row per kind, a fixed total at the left, tiles in a line. Past five, the row scrolls. */
.dry-row { display: flex; align-items: stretch; gap: 0.45rem; margin: 0.35rem 0 0.7rem; }
.dry-row-total { flex: 0 0 9.2rem; padding: 0.35rem 0.4rem; border: 1px solid var(--line, #888); border-radius: 0.35rem; font-size: 0.75rem; }
.dry-row-total-label { font-weight: 800; margin-bottom: 0.2rem; }
.dry-row-total-value { font-variant-numeric: tabular-nums; }
.dry-row-scroller { display: flex; align-items: stretch; gap: 0.25rem; min-width: 0; }
.dry-row-tiles { display: flex; flex-wrap: nowrap; align-items: stretch; gap: 0.45rem; overflow-x: auto; max-width: calc(5 * 13.6rem + 4 * 0.45rem); scroll-behavior: smooth; }
.dry-row-tiles > .inv-gauge, .dry-row-tiles > .silo-gauge, .dry-row-tiles > .cure-pane { flex: 0 0 13.6rem; width: 13.6rem; }
.dry-row-arrow { flex: 0 0 auto; align-self: center; min-width: 1.8rem; min-height: 2.4rem; font-size: 1.2rem; }
.dry-tile-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.4rem; width: 100%; text-align: left; background: transparent; color: inherit; border: 0; padding: 0; cursor: pointer; font: inherit; }
.dry-tile-name { font-weight: 800; }
.dry-tile-status, .dry-tile-weight { font-size: 0.78rem; font-variant-numeric: tabular-nums; }
.dry-tile-icon { position: relative; width: 1.45rem; height: 1.15rem; display: inline-block; border: 2px solid var(--accent, var(--primary, #d9a24a)); box-sizing: border-box; overflow: hidden; flex: 0 0 auto; }
.dry-icon-silo { border-radius: 40% 40% 8% 8%; }
.dry-icon-cube { border-color: #2563eb; }
.dry-icon-cure { border-color: #2e9e4f; }
.dry-icon-fill, .dry-cure-icon-fill { position: absolute; left: 0; right: 0; bottom: 0; }
.dry-icon-fill.silo-fill-green, .dry-cure-icon-fill { background: #2e9e4f; }
.dry-icon-fill.silo-fill-red { background: #d23b2f; }
.dry-icon-fill.silo-fill-blue, .dry-icon-fill.ffz-fill { background: #1d4ed8; }
.dry-icon-fill.silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }
.dry-icon-fill.ffz-throb { animation: ffz-icon-throb 4.2s ease-in-out infinite; }
@keyframes ffz-icon-throb { 0%, 100% { background: #1d4ed8; } 50% { background: #eef4ff; } }
.dry-tile-body[hidden] { display: none; }
/* THE V7 GATE (canon 0.30.384): a collapsed tile is only its head, and an arrow hidden by the row script stays hidden. */
.dry-tile:has(> .dry-tile-body[hidden]) { min-height: 0; }
.dry-row-arrow[hidden] { display: none; }
.silo-wire { fill: none; stroke: var(--primary); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.silo-fill { fill: transparent; fill-opacity: 0.55; transition: y 0.6s ease, height 0.6s ease; }
.silo-fill-green { fill: #2e9e4f; }
.silo-fill-red { fill: #d23b2f; }
.silo-fill-blue { fill: #3b82f6; }
.silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }
@keyframes silo-throb { 0%, 100% { fill-opacity: 0.3; } 50% { fill-opacity: 0.9; } }
/* THE BLUE THROB (canon 0.30.79): the throb is a floor signal the owner ruled, so a reduced-motion setting slows the pulse instead of stilling it. */
@media (prefers-reduced-motion: reduce) { .silo-throb { animation-duration: 3.2s; } }
.silo-state { font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.72rem; margin: 0 0 0.3rem; }
.silo-state-filling, .silo-state-loading { color: #2e9e4f; }
.silo-state-drying, .silo-state-paused, .silo-state-loaded { color: #d23b2f; }
/* THE UNLOADING SILO (canon 0.30.77): dry weights coming out read unloading, blue, the fill falling with them. */
.silo-state-unloading { color: #3b82f6; }
.silo-unload { font-size: 0.75rem; font-variant-numeric: tabular-nums; margin: -0.1rem 0 0.3rem; color: #3b82f6; }
.silo-unload strong { font-weight: 800; }
/* THE BLUE THROB (canon 0.30.79; owner: "there's no blue throb"): an unloading silo's wire pulses blue with its fill, so the signal stands even when the fill is drawn down to nothing. */
.silo-shape[data-silo-state="unloading"] .silo-wire { stroke: #3b82f6; animation: silo-wire-throb 1.6s ease-in-out infinite; }
@keyframes silo-wire-throb { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .silo-shape[data-silo-state="unloading"] .silo-wire { animation-duration: 3.2s; } }
.silo-state-empty { opacity: 0.6; }
.silo-wet { margin-top: auto; padding-top: 0.4rem; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.silo-wet strong { font-weight: 800; }
/* THE HARVEST CONSOLE (canon 0.30.73): the wire box (the Arlington Dry Room, a silo drawn as a cuboid) and the blue FFZ cube share the silo tile; back edges dashed, the side face darker, the liquid's top lighter. */
.silo-wire-hidden { stroke-dasharray: 5 5; opacity: 0.5; }
.silo-fill-side { filter: brightness(0.8); }
.silo-fill-top { filter: brightness(1.2); }
.ffz-gauge .silo-wire { stroke: #3b82f6; }
.ffz-fill { fill: #1e40af; fill-opacity: 0.85; }
.ffz-throb { animation: ffz-throb 4.2s ease-in-out infinite; }
@keyframes ffz-throb { 0%, 100% { fill: #1e40af; fill-opacity: 0.92; } 50% { fill: #e8efff; fill-opacity: 0.95; } }
@media (prefers-reduced-motion: reduce) { .ffz-throb { animation-duration: 8.4s; } }
.ffz-state { color: #60a5fa; }
.ffz-source { font-size: 0.72rem; margin: 0 0 0.3rem; }
/* The console: collapsible sections; the three farm boxes and Total, each shaded by its % complete. */
.hc-section { margin: 0 0 0.9rem; }
.hc-section > summary { cursor: pointer; font-weight: 800; font-size: 1.05rem; padding: 0.35rem 0; }
.hc-section > summary .hc-year { font-weight: 500; font-size: 0.8rem; margin-left: 0.45rem; }
.hc-fg { margin: 0.1rem 0 0.15rem 0.75rem; overflow-wrap: anywhere; }
.hc-fg > summary { cursor: pointer; font-weight: 700; padding: 0.12rem 0; }
.hc-fg-lines { margin: 0.05rem 0 0.3rem 1rem; padding: 0; list-style: none; overflow-wrap: anywhere; }
.hc-fg-lines li { font-variant-numeric: tabular-nums; }
.hc-farms { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0; }
.hc-farm { position: relative; overflow: hidden; flex: 1 1 14rem; min-width: 13rem; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); }
.hc-shade { position: absolute; inset: 0; background: var(--primary); pointer-events: none; }
.hc-farm-body { position: relative; padding: 0.6rem 0.7rem; }
/* THE YEAR PANE (canon 0.30.346): the harvest year's wet total in its own inset inside the farm box. */
.hc-year-pane { margin-top: 0.45rem; padding: 0.4rem 0.55rem; border: 1px solid rgba(128, 128, 128, 0.35); border-radius: 8px; background: rgba(128, 128, 128, 0.08); }
.hc-farm-name { font-weight: 800; letter-spacing: 0.06em; font-size: 0.95rem; margin-bottom: 0.35rem; }
.hc-total .hc-farm-name { text-transform: uppercase; }
.hc-metrics { margin: 0; display: grid; gap: 0.4rem; }
.hc-metric dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
.hc-metric dd { margin: 0; font-variant-numeric: tabular-nums; }
.hc-value { font-weight: 800; font-size: 1.05rem; }
.hc-sub { display: block; font-size: 0.75rem; }
.hc-date { font-size: 0.68rem; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.hc-hours { display: flex; gap: 0.35rem; align-items: center; }
.hc-hours input[type="number"] { width: 6.5rem; }
.hc-hours button { padding: 0.2rem 0.6rem; font-size: 0.8rem; }
.hc-note { font-size: 0.8rem; }
.hc-stub > summary { opacity: 0.75; }
/* THE TESTING GATE (canon 0.30.293): four panes, the stats row, the failure pie. Eight fixed hues, cycling. */
.hc-gate { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.8rem; }
.hc-gate-pane, .hc-stat { flex: 1 1 10rem; text-align: center; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.7rem 0.45rem 0.6rem; }
.hc-gate-name { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.25rem; }
.hc-gate-pane .hc-icon { width: 7.5rem; height: auto; max-width: 100%; display: block; margin: 0 auto 0.35rem; }
.hc-gate-count { display: block; font-size: 0.75rem; margin-top: 0.15rem; }
.hc-stats { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.6rem; }
.hc-stat .hc-value { font-size: 1.35rem; }
.hc-pie-block { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; padding: 0.7rem; }
.hc-pie { width: 11rem; height: auto; flex: 0 0 auto; }
.hc-pie-side { flex: 1 1 16rem; }
.hc-pie-legend { list-style: none; margin: 0; padding: 0; }
.hc-pie-legend li { margin: 0.15rem 0; }
.hc-pie-pick { display: flex; gap: 0.45rem; align-items: baseline; width: 100%; background: transparent; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0.15rem 0; }
.hc-pie-swatch { width: 0.7rem; height: 0.7rem; border-radius: 0.12rem; background: currentColor; display: inline-block; flex: 0 0 auto; }
.hc-pie-strains { margin-top: 0.4rem; }
.hc-pie-strains[hidden] { display: none; }
.hc-pie-seg { cursor: pointer; stroke: var(--panel, var(--surface, #111111)); stroke-width: 0.4; }
.hc-pie-1 { color: #d6453d; }
.hc-pie-2 { color: #e6a23c; }
.hc-pie-3 { color: #2e9e4f; }
.hc-pie-4 { color: #2f6fd6; }
.hc-pie-5 { color: #7b4bdb; }
.hc-pie-6 { color: #1aa6b7; }
.hc-pie-7 { color: #d63384; }
.hc-pie-8 { color: #c4a35a; }
/* FULFILLMENT (canon 0.30.306): ten fixed hues, the pie's eight and two more, one per row. */
.hc-fill { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.8rem; }
.hc-fill-pane { flex: 1 1 16rem; text-align: center; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.7rem 0.45rem 0.6rem; }
.hc-fill-beside { display: flex; align-items: center; gap: 0.45rem; }
.hc-fill-beside .hc-icon { width: 7.5rem; flex: 0 0 auto; margin: 0; }
.hc-fill-band { flex: 1 1 auto; width: 100%; height: 2.5rem; min-width: 3rem; }
.hc-fill-legend { list-style: none; margin: 0.45rem 0 0; padding: 0; text-align: left; font-size: 0.78rem; }
.hc-fill-legend li { margin: 0.12rem 0; }
.hc-fill-swatch { width: 0.7rem; height: 0.7rem; border-radius: 0.12rem; background: currentColor; display: inline-block; margin-right: 0.35rem; vertical-align: -0.08rem; }
.hc-fill-1 { color: #d6453d; }
.hc-fill-2 { color: #e6a23c; }
.hc-fill-3 { color: #2e9e4f; }
.hc-fill-4 { color: #2f6fd6; }
.hc-fill-5 { color: #7b4bdb; }
.hc-fill-6 { color: #1aa6b7; }
.hc-fill-7 { color: #d63384; }
.hc-fill-8 { color: #c4a35a; }
.hc-fill-9 { color: #2a9d8f; }
.hc-fill-10 { color: #e07a3d; }
.fulfill-grid { width: 100%; border-collapse: collapse; }
.fulfill-grid th, .fulfill-grid td { padding: 0.25rem 0.4rem; vertical-align: middle; }
.fulfill-grid input[type="number"] { width: 6.5rem; }
@media (max-width: 600px) { .hc-gate-pane .hc-icon { width: 4.5rem; } .hc-fill-beside .hc-icon { width: 4.5rem; } .hc-fill-band { height: 1.5rem; } }
/* THE TRIMMING SECTION (canon 0.30.88): two shift cards, each a waffle pictograph (100 cells, one per percent of the weight ran, BUD in the silo green, OTHER quiet) beside his six lines. */
.hc-shifts { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0; }
.hc-shift { flex: 1 1 22rem; min-width: 18rem; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.6rem 0.7rem; }
.hc-shift-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin-bottom: 0.45rem; }
.hc-shift-name { font-weight: 800; letter-spacing: 0.06em; font-size: 0.95rem; }
.hc-shift-ops { font-size: 0.78rem; }
.hc-shift-body { display: flex; gap: 0.9rem; align-items: flex-start; }
/* THE TRIM LINE PICTURE (canon 0.30.154): his machine picture in each shift card; nodes in our panel and line colors, the flow bars in the continuum tubes' greens, moving only while the line runs. */
.hc-shift-stack { flex-direction: column; align-items: stretch; }
.hc-visuals { display: flex; gap: 0.9rem; align-items: flex-start; }
.hc-visuals .hc-trimline { flex: 3 1 26rem; min-width: 0; margin: 0; }
.hc-bud-col { flex: 0 0 14rem; }
.hc-bud { display: block; width: 100%; height: auto; }
.hc-bud-bud { fill: #2e9e4f; }
.hc-bud-stem { fill: #2e9e4f; }
.hc-bud-consumed { fill: #7a8088; }
.hc-bud-consumed[data-hc-bud-waste] { fill: #7c1b1b; }
/* THE THROBBING WASTE (canon 0.30.266): the deep red pulses while a waste cell is drawn. The trough stays at 0.55 so it never reads as the grey beside it. The legend swatch does not pulse. */
.hc-bud-consumed[data-hc-bud-waste] { animation: hc-waste-throb 1.6s ease-in-out infinite; }
@keyframes hc-waste-throb { 0%, 100% { fill-opacity: 0.55; } 50% { fill-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-bud-consumed[data-hc-bud-waste] { animation-duration: 3.2s; } }
.hc-bud-empty { fill: none; stroke: var(--line, var(--border, #88888899)); stroke-width: 0.6; }
.hc-btr-read { font-variant-numeric: tabular-nums; margin: 0.3rem 0 0.15rem; }
.hc-legend { font-size: 0.72rem; }
.hc-swatch { display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 0.12rem; margin: 0 0.22rem 0 0; vertical-align: -0.08rem; }
.hc-swatch-bud { background: #2e9e4f; }
.hc-swatch-consumed { background: #7a8088; margin-left: 0.45rem; }
.hc-swatch-waste { background: #7c1b1b; margin-left: 0.45rem; }
.hc-trimline { display: block; width: 100%; max-width: 46rem; height: auto; margin: 0 auto 0.5rem; }
.hc-trim-rightnow { margin: 0 0 0.8rem; }
.hc-trim-rightnow .hc-trimline { max-width: none; max-height: 70vh; }
.hc-trim-down { color: var(--danger, #8b2e2e); font-weight: 800; }
.hc-btr-bar { position: relative; margin: 0.4rem 0 0.2rem; }
.hc-btr-track { position: relative; display: flex; height: 1.15rem; border: 1px solid var(--line, var(--border, #88888899)); border-radius: 0.2rem; }
.hc-btr-fill { background: #2e9e4f; height: 100%; }
.hc-btr-rest { background: #7a8088; flex: 1 1 auto; min-width: 0; }
.hc-btr-bar-empty .hc-btr-track { background: transparent; }
.hc-btr-tick { position: absolute; top: 0; width: 2px; height: 1.15rem; background: var(--text, currentColor); transform: translateX(-1px); }
.hc-btr-bogey { position: absolute; top: 1.2rem; font-size: 0.68rem; transform: translateX(-50%); }
.hc-btr-bar .hc-btr-read { display: block; margin-top: 1.1rem; text-align: right; font-variant-numeric: tabular-nums; }
.hc-bud-col { margin-left: auto; margin-right: auto; }
.hc-trim-totals { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.7rem 0; }
.hc-trim-total { min-width: 8rem; }
.hc-trimline .hc-node { fill: var(--panel, var(--surface, transparent)); stroke: var(--line, var(--border, #88888899)); stroke-width: 3; }
.hc-trimline text { fill: var(--text, currentColor); text-anchor: middle; font-family: inherit; }
.hc-trimline .hc-node-label { font-weight: 800; font-size: 30px; letter-spacing: 0.06em; }
.hc-trimline .hc-node-label-big { font-size: 40px; }
.hc-trimline .hc-node-label-small { font-size: 25px; letter-spacing: 0.04em; }
.hc-trimline .hc-node-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hc-trimline .hc-node-sub { font-size: 17px; opacity: 0.75; font-variant-numeric: tabular-nums; }
.hc-trimline .hc-node-muted { opacity: 0.55; font-weight: 400; }
.hc-trimline .hc-flow-a { fill: #43c07a; }
.hc-trimline .hc-flow-b { fill: #2a7d4f; }
.hc-trimline .hc-converge polyline { fill: none; stroke: var(--line, var(--border, #88888899)); stroke-width: 3; stroke-linejoin: round; }
.hc-trimline .hc-converge-dot { fill: var(--line, var(--border, #88888899)); }
.hc-trimline .hc-total-label { font-size: 20px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; }
.hc-trimline .hc-total-value { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
.hc-running { color: #2e9e4f; font-weight: 800; letter-spacing: 0.1em; font-size: 0.8rem; animation: hc-running 1.6s ease-in-out infinite; }
@keyframes hc-running { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-running { animation-duration: 3.2s; } }
/* BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334): the Right now pane's two halves (stacked on the phone), the Rad's green throb like a loading silo (slowed, never stilled, under reduced motion, canon 0.30.79), his CRYO, AMAPS, UV picture in the plume's deep red (canon 0.30.248) with a darker band, the five-figure row of the shift panes. */
.hc-past-rightnow { margin: 0 0 0.8rem; }
.hc-past-halves { display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: stretch; }
.hc-past-half { border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.6rem 0.7rem; }
.hc-past-rad { flex: 1 1 14rem; min-width: 12rem; text-align: center; }
.hc-past-rad .hc-icon { width: 9rem; height: auto; max-width: 100%; display: block; margin: 0.2rem auto 0.4rem; color: #2e9e4f; }
.hc-rad-throb path { animation: hc-rad-throb 1.6s ease-in-out infinite; }
@keyframes hc-rad-throb { 0%, 100% { stroke-opacity: 0.3; } 50% { stroke-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-rad-throb path { animation-duration: 3.2s; } }
.hc-rad-lots { font-weight: 800; font-variant-numeric: tabular-nums; margin: 0.2rem 0; overflow-wrap: anywhere; }
.hc-past-rad .silo-clock { display: block; margin-top: 0.25rem; }
.hc-past-cryo { flex: 3 1 30rem; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: flex-start; }
.hc-cryoline { display: block; flex: 3 1 22rem; min-width: 0; max-width: 40rem; height: auto; }
.hc-cryoline .hc-node { fill: var(--panel, var(--surface, transparent)); stroke: var(--line, var(--border, #88888899)); stroke-width: 3; }
.hc-cryoline text { fill: var(--text, currentColor); text-anchor: middle; font-family: inherit; }
.hc-cryoline .hc-node-label { font-weight: 800; font-size: 40px; letter-spacing: 0.06em; }
.hc-cryoline .hc-node-value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hc-cryoline .hc-node-sub { font-size: 18px; opacity: 0.75; font-variant-numeric: tabular-nums; }
.hc-cryoline .hc-cryo-flow-a { fill: #7c1b1b; }
.hc-cryoline .hc-cryo-flow-b { fill: #4a0f0f; }
.hc-cryo-side { flex: 1 1 12rem; min-width: 11rem; }
.hc-cryo-list { margin: 0.3rem 0 0; display: grid; gap: 0.3rem; }
.hc-cryo-list dt { font-size: 0.7rem; letter-spacing: 0.05em; opacity: 0.8; }
.hc-cryo-list dd { margin: 0; font-variant-numeric: tabular-nums; }
.hc-past-figures { margin: 0.2rem 0 0.6rem; gap: 0.35rem; }
.hc-past-figures .hc-gate-pane { flex: 1 1 5rem; min-width: 5rem; padding: 0.45rem 0.15rem 0.4rem; }
.hc-past-figures .hc-gate-name { font-size: 0.62rem; letter-spacing: 0.02em; }
.hc-past-figures .hc-icon { width: 100%; max-width: 5rem; margin-bottom: 0.25rem; }
/* The V10 gate's fix (canon 0.30.337): a number never breaks between its digits; the row wraps instead. */
.hc-past-figures .hc-value { font-size: 0.95rem; overflow-wrap: normal; }
body.device-phone .hc-past-half { flex-basis: 100%; }
.hc-sheet-hours dd { font-variant-numeric: tabular-nums; }
.hc-shift .hc-metrics { flex: 1 1 auto; }
body.device-phone .hc-shift { flex-basis: 100%; }
body.device-phone .hc-shift-body { flex-wrap: wrap; }
body.device-phone .hc-visuals { flex-wrap: wrap; }
body.device-phone .hc-farm { flex-basis: 100%; }
.inv-gauge { border-radius: var(--radius); min-height: 12rem; justify-content: flex-start; }

.inv-total { margin: 0.5rem 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 9px; padding: 0 0.7rem 0.5rem; }
.inv-grams { font-variant-numeric: tabular-nums; }
.inv-pareto { display: flex; align-items: flex-end; gap: 0.5rem; height: 12rem; margin: 0.8rem 0; }
.inv-pareto-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-width: 0; height: 100%; }
.inv-pareto-bar { width: 100%; background: var(--primary); min-height: 4px; border-radius: 4px 4px 0 0; }
.inv-pareto-label { font-size: 0.75rem; font-weight: 700; margin-top: 0.3rem; word-break: break-all; }
.inv-fg-type { margin: 0.4rem 0; }
.inv-fg-type > summary { display: flex; align-items: center; gap: 0.7rem; cursor: pointer; min-height: 2.6rem; }
/* Canon 0.30.36: the Zoho pane groups its offerings by category. */
.zoho-cat { margin: 0.5rem 0; }
.zoho-cat > summary { cursor: pointer; min-height: 2.4rem; display: flex; align-items: center; gap: 0.6rem; }
.zoho-cats { margin: 0.6rem 0 1rem; }
table.data td code { font-size: 0.85em; }
/* THE TAG LAW and THE METRC MIRROR (canon 0.30.38) */
.metrc-tag-input { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.04em; min-width: 17ch; }
.tag-missing { font-style: italic; white-space: nowrap; }
.tag-shape-note { cursor: help; }
.metrc-tag-shown { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.crumb { margin: 0 0 0.6rem; }
.metrc-holdings, .metrc-cross, .metrc-lookup, .metrc-drop, .metrc-mounts { margin: 0 0 1.4rem; }
.internal-fields form { flex-wrap: wrap; }
.inv-fg-code { font-weight: 700; flex: 0 0 clamp(3.4rem, 28vw, 11rem); overflow-wrap: anywhere; line-height: 1.1; font-family: var(--font-display); }
.inv-fg-track { flex: 1; height: 1.1rem; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
.inv-fg-bar { display: block; height: 100%; background: var(--primary); border-radius: 999px; }
.inv-fg-stock { font-weight: 700; min-width: 4rem; text-align: right; font-variant-numeric: tabular-nums; }
.inv-fg-unit { font-weight: 400; font-size: 0.85em; }
.inv-fg-note { margin: 0.2rem 0 0.4rem; }
.inv-fg-heading { margin: 1rem 0 0.3rem; }
@media (max-width: 600px) { .inv-fg-type > summary { flex-wrap: wrap; row-gap: 0.2rem; } .inv-fg-code { flex-basis: 100%; } }
.acquire-split .recall-pane { flex: 1 1 16rem; }
.recall-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
.recall-hbn-label { font-weight: 600; word-break: break-all; font-variant-numeric: tabular-nums; }
.recall-btn { min-width: 2.8rem; min-height: 2.8rem; padding: 0; font-size: 1.3rem; border-radius: 999px; }
.brand-lockup { display: inline-flex; align-items: center; gap: 0.5rem; position: relative; color: var(--primary); padding-right: 0.9rem; }
.brand-grip { height: 26px; width: auto; display: block; }
.brand-factory {
  position: relative; display: inline-flex; align-items: center;
  height: 26px; padding: 0 0.7rem;
  background: linear-gradient(180deg, #6a6e75, #43464c 55%, #33363b);
  border: 1px solid #23252a; border-radius: 3px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.5);
  font-weight: 800; font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: #17181c; text-shadow: 0 1px 0 rgba(255,255,255,0.25);
}
.brand-factory::before, .brand-factory::after {
  content: ""; position: absolute; top: 50%; transform: translateY(-50%);
  width: 4px; height: 4px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #9aa0a8, #22242a);
}
.brand-factory::before { left: 3px; }
.brand-factory::after { right: 3px; }
.brand-lite {
  position: absolute; right: -0.15rem; bottom: -0.55rem;
  font-weight: 800; font-style: italic; text-transform: lowercase;
  font-size: 0.95rem; line-height: 1; letter-spacing: 0.02em;
  transform: rotate(-14deg); pointer-events: none;
  color: var(--primary-strong);
  text-shadow: 0 0 1px var(--primary-soft);
}
.co-pill-mark { height: 1em; width: auto; display: block; }
/* Canon 0.30.28: the home page's Back to the Continuum 10 crumb, co view only. */
.continuum-crumb { display: inline-block; color: var(--muted); text-decoration: none; font-size: 0.95rem; margin: 0 0 1rem; }
.continuum-crumb:hover { color: var(--primary-strong); }
.saleshelper-embed { width: calc(100vw - 1.25rem); margin-left: calc(50% - 50vw); margin-top: -1.6rem; }
.saleshelper-frame { display: block; width: 100%; border: 0; min-height: 480px; height: calc(100vh - 5.5rem); }
.saleshelper-embed-pane { margin-top: 0.8rem; }
.saleshelper-embed-pane .saleshelper-frame { min-height: 480px; height: calc(100vh - 12rem); }
body.device-phone { font-size: 1.3rem; }
body.device-phone .station-split { flex-direction: column; }
body.device-phone .queue-pane { max-width: none; width: 100%; flex: 1 1 auto; }
body.device-phone .working-pane { width: 100%; flex: 1 1 auto; }
body.device-phone .tiles { grid-template-columns: 1fr; }
body.device-phone main button, body.device-phone main .btn { width: 100%; min-height: 3.4rem; }
body.device-phone table.data { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
/* Owner ruling 2026-09-02: operations map. CO: paper cards, amber arrows,
   Palatino labels, lift on hover. Phone is a vertical chain. */
.ops-map { --ops-arrow: var(--primary); }
.ops-map-desktop { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; width: 100%; overflow-x: hidden; }
.ops-map-phone { display: none; }
.ops-row {
  display: grid; width: 100%; max-width: 46rem;
  grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr);
  align-items: center; justify-items: center; gap: 0.45rem 0.55rem;
}
.ops-row-down .ops-arrow-down { grid-column: 5; }
.ops-spacer { display: block; width: 0; height: 0; }
.ops-island { margin: 0; }
/* Owner ruling 2026-09-02 (map polish): rounded softkeys with a slight shine,
   raised at rest and pressed on tap; no numbers under the labels; the icons
   sized to fill the key. The sheen token dims under the dark variant. */
.ops-node {
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  text-decoration: none; color: inherit; gap: 0.4rem;
  background: linear-gradient(180deg, var(--key-sheen), rgba(255,255,255,0) 55%), var(--surface);
  border: 1px solid var(--border); border-radius: 18px;
  box-shadow: inset 0 1px 0 var(--key-sheen), 0 3px 0 rgba(0,0,0,0.45), var(--shadow);
  padding: 1rem 0.55rem 0.9rem; min-width: 0; width: 100%; max-width: 11.5rem; min-height: 7.4rem;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}
.ops-node:focus, .ops-node:hover {
  border-color: var(--primary); transform: translateY(-2px);
  box-shadow: inset 0 1px 0 var(--key-sheen), 0 4px 0 rgba(0,0,0,0.45), var(--shadow-hover);
}
.ops-node:active {
  transform: translateY(2px);
  box-shadow: inset 0 1px 0 var(--key-sheen), 0 1px 0 rgba(0,0,0,0.45), var(--shadow);
}
.ops-node-stub { opacity: 0.8; border-left: 6px solid #d97706; }
.ops-node-stub:focus, .ops-node-stub:hover { border-left-color: #d97706; }
.ops-icon-svg { width: 3.4rem; height: 3.4rem; display: block; }
.ops-label { display: block; font-family: var(--font-display); font-weight: 700; margin: 0; font-size: 0.95rem; }
.ops-menu-lines { display: flex; flex-direction: column; gap: 0.08rem; width: 100%; min-width: 0; max-width: 100%; }
.ops-menu-line { display: flex; flex-wrap: wrap; align-items: baseline; width: 100%; max-width: 100%; min-width: 0; font-size: 0.475rem; line-height: 1.15; font-weight: 600; }
.ops-menu-name { flex: 0 1 auto; min-width: 0; white-space: nowrap; }
.ops-menu-status { flex: 0 0 auto; max-width: 100%; white-space: nowrap; }
.ops-menu-dots { flex: 1 1 0.4rem; overflow: hidden; min-width: 0.4rem; white-space: nowrap; }
.ops-menu-dots::before { content: "................................................"; }
@media (max-width: 480px) {
  .ops-menu-dots { display: none; }
  .ops-menu-name, .ops-menu-status { flex: 1 0 100%; white-space: normal; }
  .ops-menu-status { text-align: right; }
}
.ops-arrow { color: var(--ops-arrow); flex: 0 0 auto; }
.ops-arrow-right, .ops-arrow-left, .ops-arrow-down { display: block; width: 0; height: 0; }
.ops-arrow-right { border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-left: 16px solid currentColor; }
.ops-arrow-left { border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-right: 16px solid currentColor; }
.ops-arrow-down { border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 16px solid currentColor; }
body.device-phone .ops-map { overflow-x: hidden; width: 100%; }
body.device-phone .ops-map-desktop { display: none; }
body.device-phone .ops-map-phone {
  display: flex; flex-direction: column; align-items: center; gap: 0.45rem;
}
body.device-phone .ops-map-phone .ops-node { width: 100%; max-width: 18rem; }
/* THE BAR CARRIES REPORTS AND ADMIN (canon 0.30.201): the 2026-09-02 lock to
   the bottom right is reversed; the two ride at the end of the app bar in her
   header-cta idiom, amber pill, shadow, lift on hover. */
.bar-actions { display: flex; align-items: center; gap: 0.55rem; margin-left: auto; }
.models-link, .harvest-link, .maintenance-link, .admin-link, .reports-link {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 2.5rem; padding: 0.35rem 1.1rem;
  background: var(--primary); color: #fff;
  border: 1px solid var(--primary); border-radius: 999px;
  font-weight: 600; text-decoration: none;
  box-shadow: var(--shadow);
  transition: transform 0.15s, background 0.15s;
}
.models-link:hover, .harvest-link:hover, .maintenance-link:hover, .admin-link:hover, .reports-link:hover { background: var(--primary-strong); transform: translateY(-1px); color: #fff; }
.models-link:focus-visible, .harvest-link:focus-visible, .maintenance-link:focus-visible, .admin-link:focus-visible, .reports-link:focus-visible { outline: 3px solid var(--primary-strong); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .tile, button, .btn, .queue-pane a.queue-pane-item, .models-link, .harvest-link, .maintenance-link, .admin-link, .reports-link, .ops-node { transition: none; }
  .tile:focus, .tile:hover, button:hover, .btn:hover, .models-link:hover, .harvest-link:hover, .maintenance-link:hover, .admin-link:hover, .reports-link:hover, .ops-node:hover { transform: none; }
}
${walkSliceChrome("co")}
.php-best { background: var(--ok-soft); color: var(--ok); }
.php-worst { background: var(--alert-soft); color: var(--alert); }`;
}

/** The Cerberus view stylesheet (owner ruling 2026-09-01). Order matters: the
 * Inter import must lead the sheet, so the verbatim typography block goes
 * first, then the verbatim token, honeycomb, and bloom blocks, then the
 * component discipline: bg page, panel cards, hairline lines, gold accents on
 * active states and key numbers, all caps letter spaced headings, tabular
 * numerals for weights. */
export function cerberusStylesheet(): string {
  return `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
body{ background:var(--bg); color:var(--ink); font-family:var(--font); font-weight:400;
  letter-spacing:.01em; -webkit-font-smoothing:antialiased; }
h1,h2,h3,.eyebrow,.hd{ text-transform:uppercase; letter-spacing:.08em; }
.mono{ font-variant-numeric:tabular-nums; font-feature-settings:"tnum"; }
/* Canonical tokens, verbatim from prompts/CERBERUSTHEMEPROMPT.md section 1. */
:root{
  --bg:#0c0c0e; --panel:#15161a; --panel-2:#1c1e24; --line:#2a2d35; --border:var(--line); --line-2:#3a3e48;
  --ink:#f4f4f5; --ink-dim:#b6b8c0; --ink-mute:#7a7d88; --gold:#f1c232; --gold-dim:#b4901f; --accent-gold:var(--gold);
  --panel-alt:#181a20; --chassis-steel:#3a3d42; --chassis-steel-2:#2a2c30; --chassis-bezel:#1c1e22;
  --danger:#e05757; --ok:#54b774;
}
:root{
  --bg2:#101116; --panel2:var(--panel-2);
  --ruby:var(--danger); --ruby-dim:#7a2230; --teal:var(--ok);
  --radius:10px;
  --hex-wave-sweep-ms:800ms;
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
}
/* Honeycomb background, verbatim from prompts/CERBERUSTHEMEPROMPT.md section 3a. */
#honeycomb{ position:fixed; inset:0; width:100%; height:100%; z-index:-1; pointer-events:none; display:block; }
#honeycomb .hc-base{ fill:none; stroke:rgba(255,255,255,0.055); stroke-width:1; }
#honeycomb .hc-wave{ fill:none; stroke:var(--gold); stroke-width:1.1; opacity:0; }
#honeycomb.hc-wave-on .hc-wave{
  opacity:0.55;
  -webkit-mask-image:linear-gradient(105deg, transparent 42%, #000 50%, transparent 58%);
          mask-image:linear-gradient(105deg, transparent 42%, #000 50%, transparent 58%);
  -webkit-mask-size:260% 100%; mask-size:260% 100%;
  animation:hc-wave-sweep var(--hex-wave-sweep-ms,800ms) ease forwards;
}
@keyframes hc-wave-sweep{
  from{ -webkit-mask-position:165% 0; mask-position:165% 0; }
  to  { -webkit-mask-position:-165% 0; mask-position:-165% 0; }
}
.hc-pulse{ fill:none; stroke:var(--gold); stroke-width:2; stroke-linecap:round; stroke-linejoin:round;
  filter:drop-shadow(0 0 4px var(--gold)) drop-shadow(0 0 10px rgba(241,194,50,0.7)); }
.hc-lens-line{ fill:none; stroke:rgba(235,216,150,0.24); stroke-width:1; }
.hc-bulge-core{ fill:#e9d57f; opacity:0.7; filter:drop-shadow(0 0 4px rgba(241,194,50,0.5)) drop-shadow(0 0 9px rgba(241,194,50,0.38)); }
#app{ position:relative; z-index:1; }
@media (prefers-reduced-motion: reduce){ #honeycomb.hc-wave-on .hc-wave{ animation:none; opacity:0; } }
/* Arrival blooms, verbatim from prompts/CERBERUSTHEMEPROMPT.md section 5. */
.logo-bloom { position: fixed; inset: 0; z-index: 60; pointer-events: none; color: var(--accent-gold); overflow: visible; }
.logo-bloom polygon {
  fill: none; stroke: currentColor; stroke-width: 2;
  transform-box: fill-box; transform-origin: center; will-change: transform, opacity;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent-gold) 55%, transparent));
}
@keyframes logo-bloom-sweep-left {
  0%   { transform: translateX(0) scale(1.05); opacity: var(--op, 0.85); }
  100% { transform: translateX(calc(-1 * var(--sweep, 300px))) scale(1.9); opacity: 0; }
}
@keyframes logo-bloom-sweep-right {
  0%   { transform: translateX(0) scale(1.05); opacity: var(--op, 0.85); }
  100% { transform: translateX(var(--sweep, 600px)) scale(1.9); opacity: 0; }
}
.logo-bloom-kick { animation: logo-bloom-kick 320ms ease-out; }
@keyframes logo-bloom-kick { 0%,100% { transform: scale(1); } 45% { transform: scale(1.07); } }
@media (prefers-reduced-motion: reduce) { .logo-bloom { display: none !important; } .logo-bloom-kick { animation: none; } }
/* =====================================================================
   CERBERUS COMPONENTS (owner ruling 2026-09-01)
   Every existing surface adapted to the steel and gold discipline:
   surfaces stack bg, panel, panel-2; separation is 1px hairlines; gold is
   the only accent (active states, key numbers); text ink, ink-dim labels,
   ink-mute fine print; near black text on gold.
   --------------------------------------------------------------------- */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-size: 1.1rem; line-height: 1.45; color-scheme: dark; }
a { color: var(--gold); }
header.app-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.2rem;
  background: linear-gradient(180deg,#15161a,#101116);
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: 5;
}
/* Owner ruling 2026-09-01: the universal bar carries the brand lockup in
   BOTH views, replacing the text brand: the GRIP hex mark at bar height,
   FACTORY as a stamped-steel chip (CSS embossed; picked over a photo crop
   because it stays crisp at 26px tall, with the corner bolts echoed as
   studs), and a small spray style "lite" overlapping the chip's bottom
   right corner. Near-white here; near-black ink on the Lite sheet. */
.brand-lockup { display: inline-flex; align-items: center; gap: 0.5rem; position: relative; color: #f4f4f5; padding-right: 0.9rem; }
.brand-grip { height: 26px; width: auto; display: block; filter: drop-shadow(0 0 5px rgba(241,194,50,0.18)); }
.brand-factory {
  position: relative; display: inline-flex; align-items: center;
  height: 26px; padding: 0 0.7rem;
  background: linear-gradient(180deg, #6a6e75, #43464c 55%, #33363b);
  border: 1px solid #23252a; border-radius: 3px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.5);
  font-weight: 800; font-size: 0.68rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: #17181c; text-shadow: 0 1px 0 rgba(255,255,255,0.25);
}
.brand-factory::before, .brand-factory::after {
  content: ""; position: absolute; top: 50%; transform: translateY(-50%);
  width: 4px; height: 4px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #9aa0a8, #22242a);
}
.brand-factory::before { left: 3px; }
.brand-factory::after { right: 3px; }
.brand-lite {
  position: absolute; right: -0.15rem; bottom: -0.55rem;
  font-weight: 800; font-style: italic; text-transform: lowercase;
  font-size: 0.95rem; line-height: 1; letter-spacing: 0.02em;
  transform: rotate(-14deg); pointer-events: none;
  color: var(--gold);
  text-shadow: 0 0 1px rgba(241,194,50,0.9), 0 0 4px rgba(241,194,50,0.55), 1px 1px 10px rgba(241,194,50,0.3);
}
.co-pill-mark { height: 1em; width: auto; display: block; }
nav a {
  margin-right: 0.9rem;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
nav a:hover, nav a:focus { color: var(--gold); border-bottom-color: var(--gold); }
main { max-width: 89rem; margin: 0 auto; padding: 1.2rem; position: relative; z-index: 1; }
h1 { font-size: 1.35rem; margin: 0 0 1rem; letter-spacing: 0.12em; }
h2 { font-size: 1.05rem; margin: 1.4rem 0 0.6rem; letter-spacing: 0.1em; }
h3 { font-size: 0.95rem; }
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.9rem;
}
.tile {
  display: block;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1rem 1.1rem;
  text-decoration: none;
  color: var(--ink);
  min-height: 6.5rem;
}
.tile:focus, .tile:hover { border-color: var(--gold); }
.tile-stub { opacity: 0.75; border-left: 6px solid #d97706; }
.tile-stub:focus, .tile-stub:hover { border-left-color: #d97706; }
.tile-kind { font-size: 0.72rem; color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.14em; }
.tile-title { display: block; font-size: 1.2rem; font-weight: 700; margin: 0.35rem 0; text-transform: uppercase; letter-spacing: 0.08em; }
.tile-count { font-size: 1.5rem; font-weight: 700; color: var(--gold); font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.banner {
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  margin-bottom: 1rem;
  border: 1px solid var(--line);
  background: var(--panel);
}
.banner.ok { border-color: var(--ok); }
.banner.err { border-color: var(--danger); color: var(--danger); }
.hbn-mint {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  word-break: break-all;
  background: var(--panel);
  border: 1px solid var(--gold);
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  margin: 0.6rem 0 1rem;
}
form.stack, .stack { display: flex; flex-direction: column; gap: 0.85rem; max-width: 40rem; }
label.field { display: flex; flex-direction: column; gap: 0.3rem; font-weight: 600; }
input, select, textarea, button {
  font-family: inherit;
  font-size: 1.05rem;
  line-height: 1.3;
}
input[type="text"], input[type="date"], input[type="time"], input[type="number"], input[type="password"], input[type="file"], select, textarea {
  width: 100%;
  min-height: 2.8rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  color: var(--ink);
}
textarea { min-height: 5rem; }
input:focus, select:focus, textarea:focus, button:focus {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
button, .btn {
  min-height: 2.8rem;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--gold);
  background: var(--gold);
  color: #1a1500;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
button.secondary, a.btn.secondary {
  background: var(--panel-2);
  color: var(--ink);
  border-color: var(--line-2);
}
button.secondary:hover, a.btn.secondary:hover { border-color: var(--gold-dim); }
button.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
.row-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
table.data {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
  border: 1px solid var(--line);
  font-size: 1rem;
}
table.data th, table.data td {
  text-align: left;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
table.data th {
  background: var(--panel-2);
  color: var(--ink-dim);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
table.data td { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
fieldset { border: 1px solid var(--line); border-radius: var(--radius); padding: 0.8rem 1rem; margin: 0; }
legend { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.78rem; color: var(--ink-dim); font-weight: 600; padding: 0 0.4rem; }
.person-form { display: flex; gap: 0.4rem; align-items: center; }
.person-form select { min-width: 12rem; }
.locale-pill { display: flex; border: 1px solid var(--line-2); border-radius: 999px; overflow: hidden; background: var(--panel); }
.locale-pill button {
  min-height: 2.2rem;
  min-width: 3.2rem;
  padding: 0.2rem 0.7rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink-dim);
  font-weight: 700;
  letter-spacing: 0.06em;
  font-size: 0.85rem;
}
.locale-pill button.active { background: var(--gold); color: #1a1500; }
.muted { color: var(--ink-mute); }
.pkg-table { max-width: none; width: 100%; }
.wide { max-width: none; }
.station-split { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: flex-start; }
.queue-pane {
  flex: 1 1 16rem;
  max-width: 22rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 0.9rem;
}
.queue-pane h2 { margin: 0 0 0.7rem; }
.queue-pane ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.queue-pane a.queue-pane-item {
  display: block;
  min-height: 2.8rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-alt);
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
  word-break: break-all;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
.queue-pane a.queue-pane-item:focus, .queue-pane a.queue-pane-item:hover { border-color: var(--gold); }
.queue-pane a.queue-pane-item.selected { border-color: var(--gold); background: var(--panel-2); }
.pane-group { margin: 0 0 0.5rem; }
.pane-group summary {
  cursor: pointer;
  min-height: 2.8rem;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-2);
  font-weight: 600;
}
.pane-group summary:focus, .pane-group summary:hover { border-color: var(--gold); }
.pane-group ul { margin-top: 0.5rem; }
.working-pane { flex: 3 1 24rem; min-width: 0; }
.working-pane .working-pick { margin-top: 0; }
.working-pick { color: var(--gold); letter-spacing: 0.08em; }
.move-to-row { display: flex; gap: 0.4rem; align-items: center; }
.move-to-row select { flex: 1; }
.move-to-row button { white-space: nowrap; }
.resume-lots { margin: 0 0 1rem; }
.resume-lots h3 { margin: 0 0 0.4rem; }
.resume-lots ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.resume-lots a { font-weight: 600; }
.lot-meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.9rem; margin: 0 0 1rem; }
.lot-meta dt { font-weight: 600; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85rem; }
.lot-meta dd { margin: 0; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.weights-pane {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 0.9rem;
  max-width: 46rem;
}
.weights-pane h3 { margin: 0 0 0.7rem; }
.weights-controls { display: flex; flex-wrap: wrap; gap: 0.8rem; align-items: center; margin-bottom: 0.8rem; }
.weights-controls input[type="number"] { width: 11rem; }
.weights-numbered .weight-seq { width: 3.2rem; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* THE PLANT COUNT (canon 0.30.62): the finish form toggles the hidden attribute on its
   button and prompt; the button rule's display inline-flex would defeat the UA's [hidden]
   (the 2026-09-01 boot-slot lesson), so hidden is absolute inside this form. */
.finish-with-plants [hidden] { display: none !important; }
.finish-with-plants { flex-wrap: wrap; }
.finish-with-plants .plant-prompt { flex: 1 1 100%; }
/* THE EFFECTIVE DATE (canon 0.30.92): the collapsed field on a transactional form; the
   summary is the tap target, the open block stacks its date and PIN like any field. */
.effective-date { margin: 0.35rem 0 0.6rem; }
.effective-date > summary { cursor: pointer; padding: 0.35rem 0; font-weight: 700; }
.effective-date > summary:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.effective-date .field { margin-top: 0.4rem; }
.lot-total { font-size: 1.4rem; margin-top: 1rem; }
.lot-total strong { color: var(--gold); font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.inv-actions { margin-bottom: 1.2rem; }
.inv-section { margin: 0 0 0.7rem; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 0.4rem 0.8rem 0.6rem; }
.inv-section > summary, .inv-total > summary {
  cursor: pointer; min-height: 2.8rem; padding: 0.6rem 0.2rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.inv-section > summary:focus, .inv-total > summary:focus { outline: 2px solid var(--gold); }
.inv-gauges { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.8rem 0 1rem; }
.inv-gauge {
  width: 10.5rem; min-height: 10.5rem; border-radius: 50%;
  border: 1px solid var(--gold); background: radial-gradient(circle at 40% 35%, #2a2d35, #15161a);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 0.8rem; font-size: 0.82rem;
  box-shadow: inset 0 0 18px rgba(241,194,50,0.12);
}
.inv-gauge-hang { border-radius: 12px; width: 12.5rem; min-height: 10.5rem; }
.inv-gauge-name { font-weight: 800; color: var(--gold); margin-bottom: 0.35rem; letter-spacing: 0.08em; }
.inv-lot { margin: 0.25rem 0; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.inv-lot-id { font-weight: 700; }
/* THE SILO SHAPE AND THE LIVE WET WEIGHT (canon 0.30.69): a silo is a cone-topped cylinder wireframe with its live fill, never a circle. */
.silo-shape { width: 11.2rem; height: 8.4rem; display: block; margin: 0.15rem auto 0.25rem; overflow: visible; }
/* THE WIDE SILO (canon 0.30.71): the silo card widens to hold the shape; its height is untouched. */
.silo-gauge { width: 13.6rem; }
/* THE ROWS (canon 0.30.383): one row per kind, a fixed total at the left, tiles in a line. Past five, the row scrolls. */
.dry-row { display: flex; align-items: stretch; gap: 0.45rem; margin: 0.35rem 0 0.7rem; }
.dry-row-total { flex: 0 0 9.2rem; padding: 0.35rem 0.4rem; border: 1px solid var(--line, #888); border-radius: 0.35rem; font-size: 0.75rem; }
.dry-row-total-label { font-weight: 800; margin-bottom: 0.2rem; }
.dry-row-total-value { font-variant-numeric: tabular-nums; }
.dry-row-scroller { display: flex; align-items: stretch; gap: 0.25rem; min-width: 0; }
.dry-row-tiles { display: flex; flex-wrap: nowrap; align-items: stretch; gap: 0.45rem; overflow-x: auto; max-width: calc(5 * 13.6rem + 4 * 0.45rem); scroll-behavior: smooth; }
.dry-row-tiles > .inv-gauge, .dry-row-tiles > .silo-gauge, .dry-row-tiles > .cure-pane { flex: 0 0 13.6rem; width: 13.6rem; }
.dry-row-arrow { flex: 0 0 auto; align-self: center; min-width: 1.8rem; min-height: 2.4rem; font-size: 1.2rem; }
.dry-tile-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.4rem; width: 100%; text-align: left; background: transparent; color: inherit; border: 0; padding: 0; cursor: pointer; font: inherit; }
.dry-tile-name { font-weight: 800; }
.dry-tile-status, .dry-tile-weight { font-size: 0.78rem; font-variant-numeric: tabular-nums; }
.dry-tile-icon { position: relative; width: 1.45rem; height: 1.15rem; display: inline-block; border: 2px solid var(--gold, #d9a24a); box-sizing: border-box; overflow: hidden; flex: 0 0 auto; }
.dry-icon-silo { border-radius: 40% 40% 8% 8%; }
.dry-icon-cube { border-color: #2563eb; }
.dry-icon-cure { border-color: #2e9e4f; }
.dry-icon-fill, .dry-cure-icon-fill { position: absolute; left: 0; right: 0; bottom: 0; }
.dry-icon-fill.silo-fill-green, .dry-cure-icon-fill { background: #2e9e4f; }
.dry-icon-fill.silo-fill-red { background: #d23b2f; }
.dry-icon-fill.silo-fill-blue, .dry-icon-fill.ffz-fill { background: #1d4ed8; }
.dry-icon-fill.silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }
.dry-icon-fill.ffz-throb { animation: ffz-icon-throb 4.2s ease-in-out infinite; }
@keyframes ffz-icon-throb { 0%, 100% { background: #1d4ed8; } 50% { background: #eef4ff; } }
.dry-tile-body[hidden] { display: none; }
/* THE V7 GATE (canon 0.30.384): a collapsed tile is only its head, and an arrow hidden by the row script stays hidden. */
.dry-tile:has(> .dry-tile-body[hidden]) { min-height: 0; }
.dry-row-arrow[hidden] { display: none; }
.silo-wire { fill: none; stroke: var(--gold); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.silo-fill { fill: transparent; fill-opacity: 0.55; transition: y 0.6s ease, height 0.6s ease; }
.silo-fill-green { fill: #3ecf6b; }
.silo-fill-red { fill: #ff5a4a; }
.silo-fill-blue { fill: #4f8cff; }
.silo-throb { animation: silo-throb 1.6s ease-in-out infinite; }
@keyframes silo-throb { 0%, 100% { fill-opacity: 0.3; } 50% { fill-opacity: 0.9; } }
/* THE BLUE THROB (canon 0.30.79): the throb is a floor signal the owner ruled, so a reduced-motion setting slows the pulse instead of stilling it. */
@media (prefers-reduced-motion: reduce) { .silo-throb { animation-duration: 3.2s; } }
.silo-state { font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.72rem; margin: 0 0 0.3rem; }
.silo-state-filling, .silo-state-loading { color: #3ecf6b; }
.silo-state-drying, .silo-state-paused, .silo-state-loaded { color: #ff5a4a; }
/* THE UNLOADING SILO (canon 0.30.77): dry weights coming out read unloading, blue, the fill falling with them. */
.silo-state-unloading { color: #4f8cff; }
.silo-unload { font-size: 0.75rem; font-variant-numeric: tabular-nums; margin: -0.1rem 0 0.3rem; color: #4f8cff; }
.silo-unload strong { font-weight: 800; }
/* THE BLUE THROB (canon 0.30.79; owner: "there's no blue throb"): an unloading silo's wire pulses blue with its fill, so the signal stands even when the fill is drawn down to nothing. */
.silo-shape[data-silo-state="unloading"] .silo-wire { stroke: #4f8cff; animation: silo-wire-throb 1.6s ease-in-out infinite; }
@keyframes silo-wire-throb { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .silo-shape[data-silo-state="unloading"] .silo-wire { animation-duration: 3.2s; } }
.silo-state-empty { opacity: 0.6; }
.silo-wet { margin-top: auto; padding-top: 0.4rem; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.silo-wet strong { font-weight: 800; }
/* THE HARVEST CONSOLE (canon 0.30.73): the wire box (the Arlington Dry Room, a silo drawn as a cuboid) and the blue FFZ cube share the silo tile; back edges dashed, the side face darker, the liquid's top lighter. */
.silo-wire-hidden { stroke-dasharray: 5 5; opacity: 0.5; }
.silo-fill-side { filter: brightness(0.8); }
.silo-fill-top { filter: brightness(1.2); }
.ffz-gauge .silo-wire { stroke: #4f8cff; }
.ffz-fill { fill: #1e3a8a; fill-opacity: 0.85; }
.ffz-throb { animation: ffz-throb 4.2s ease-in-out infinite; }
@keyframes ffz-throb { 0%, 100% { fill: #1e3a8a; fill-opacity: 0.92; } 50% { fill: #e6eeff; fill-opacity: 0.95; } }
@media (prefers-reduced-motion: reduce) { .ffz-throb { animation-duration: 8.4s; } }
.ffz-state { color: #6da2ff; }
.ffz-source { font-size: 0.72rem; margin: 0 0 0.3rem; }
/* The console: collapsible sections; the three farm boxes and Total, each shaded by its % complete. */
.hc-section { margin: 0 0 0.9rem; }
.hc-section > summary { cursor: pointer; font-weight: 800; font-size: 1.05rem; padding: 0.35rem 0; }
.hc-section > summary .hc-year { font-weight: 500; font-size: 0.8rem; margin-left: 0.45rem; }
.hc-fg { margin: 0.1rem 0 0.15rem 0.75rem; overflow-wrap: anywhere; }
.hc-fg > summary { cursor: pointer; font-weight: 700; padding: 0.12rem 0; }
.hc-fg-lines { margin: 0.05rem 0 0.3rem 1rem; padding: 0; list-style: none; overflow-wrap: anywhere; }
.hc-fg-lines li { font-variant-numeric: tabular-nums; }
.hc-farms { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0; }
.hc-farm { position: relative; overflow: hidden; flex: 1 1 14rem; min-width: 13rem; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); }
.hc-shade { position: absolute; inset: 0; background: var(--gold); pointer-events: none; }
.hc-farm-body { position: relative; padding: 0.6rem 0.7rem; }
/* THE YEAR PANE (canon 0.30.346): the harvest year's wet total in its own inset inside the farm box. */
.hc-year-pane { margin-top: 0.45rem; padding: 0.4rem 0.55rem; border: 1px solid rgba(128, 128, 128, 0.35); border-radius: 8px; background: rgba(128, 128, 128, 0.08); }
.hc-farm-name { font-weight: 800; letter-spacing: 0.06em; font-size: 0.95rem; margin-bottom: 0.35rem; }
.hc-total .hc-farm-name { text-transform: uppercase; }
.hc-metrics { margin: 0; display: grid; gap: 0.4rem; }
.hc-metric dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8; }
.hc-metric dd { margin: 0; font-variant-numeric: tabular-nums; }
.hc-value { font-weight: 800; font-size: 1.05rem; }
.hc-sub { display: block; font-size: 0.75rem; }
.hc-date { font-size: 0.68rem; text-transform: none; letter-spacing: 0; white-space: nowrap; }
.hc-hours { display: flex; gap: 0.35rem; align-items: center; }
.hc-hours input[type="number"] { width: 6.5rem; }
.hc-hours button { padding: 0.2rem 0.6rem; font-size: 0.8rem; }
.hc-note { font-size: 0.8rem; }
.hc-stub > summary { opacity: 0.75; }
/* THE TESTING GATE (canon 0.30.293): four panes, the stats row, the failure pie. Eight fixed hues, cycling. */
.hc-gate { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.8rem; }
.hc-gate-pane, .hc-stat { flex: 1 1 10rem; text-align: center; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.7rem 0.45rem 0.6rem; }
.hc-gate-name { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 0.25rem; }
.hc-gate-pane .hc-icon { width: 7.5rem; height: auto; max-width: 100%; display: block; margin: 0 auto 0.35rem; }
.hc-gate-count { display: block; font-size: 0.75rem; margin-top: 0.15rem; }
.hc-stats { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.6rem; }
.hc-stat .hc-value { font-size: 1.35rem; }
.hc-pie-block { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-start; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; padding: 0.7rem; }
.hc-pie { width: 11rem; height: auto; flex: 0 0 auto; }
.hc-pie-side { flex: 1 1 16rem; }
.hc-pie-legend { list-style: none; margin: 0; padding: 0; }
.hc-pie-legend li { margin: 0.15rem 0; }
.hc-pie-pick { display: flex; gap: 0.45rem; align-items: baseline; width: 100%; background: transparent; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; padding: 0.15rem 0; }
.hc-pie-swatch { width: 0.7rem; height: 0.7rem; border-radius: 0.12rem; background: currentColor; display: inline-block; flex: 0 0 auto; }
.hc-pie-strains { margin-top: 0.4rem; }
.hc-pie-strains[hidden] { display: none; }
.hc-pie-seg { cursor: pointer; stroke: var(--panel, var(--surface, #111111)); stroke-width: 0.4; }
.hc-pie-1 { color: #d6453d; }
.hc-pie-2 { color: #e6a23c; }
.hc-pie-3 { color: #2e9e4f; }
.hc-pie-4 { color: #2f6fd6; }
.hc-pie-5 { color: #7b4bdb; }
.hc-pie-6 { color: #1aa6b7; }
.hc-pie-7 { color: #d63384; }
.hc-pie-8 { color: #c4a35a; }
/* FULFILLMENT (canon 0.30.306): ten fixed hues, the pie's eight and two more, one per row. */
.hc-fill { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0 0.8rem; }
.hc-fill-pane { flex: 1 1 16rem; text-align: center; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.7rem 0.45rem 0.6rem; }
.hc-fill-beside { display: flex; align-items: center; gap: 0.45rem; }
.hc-fill-beside .hc-icon { width: 7.5rem; flex: 0 0 auto; margin: 0; }
.hc-fill-band { flex: 1 1 auto; width: 100%; height: 2.5rem; min-width: 3rem; }
.hc-fill-legend { list-style: none; margin: 0.45rem 0 0; padding: 0; text-align: left; font-size: 0.78rem; }
.hc-fill-legend li { margin: 0.12rem 0; }
.hc-fill-swatch { width: 0.7rem; height: 0.7rem; border-radius: 0.12rem; background: currentColor; display: inline-block; margin-right: 0.35rem; vertical-align: -0.08rem; }
.hc-fill-1 { color: #d6453d; }
.hc-fill-2 { color: #e6a23c; }
.hc-fill-3 { color: #2e9e4f; }
.hc-fill-4 { color: #2f6fd6; }
.hc-fill-5 { color: #7b4bdb; }
.hc-fill-6 { color: #1aa6b7; }
.hc-fill-7 { color: #d63384; }
.hc-fill-8 { color: #c4a35a; }
.hc-fill-9 { color: #2a9d8f; }
.hc-fill-10 { color: #e07a3d; }
.fulfill-grid { width: 100%; border-collapse: collapse; }
.fulfill-grid th, .fulfill-grid td { padding: 0.25rem 0.4rem; vertical-align: middle; }
.fulfill-grid input[type="number"] { width: 6.5rem; }
@media (max-width: 600px) { .hc-gate-pane .hc-icon { width: 4.5rem; } .hc-fill-beside .hc-icon { width: 4.5rem; } .hc-fill-band { height: 1.5rem; } }
/* THE TRIMMING SECTION (canon 0.30.88): two shift cards, each a waffle pictograph (100 cells, one per percent of the weight ran, BUD in the silo green, OTHER quiet) beside his six lines. */
.hc-shifts { display: flex; flex-wrap: wrap; gap: 0.7rem; margin: 0.4rem 0; }
.hc-shift { flex: 1 1 22rem; min-width: 18rem; border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.6rem 0.7rem; }
.hc-shift-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem; margin-bottom: 0.45rem; }
.hc-shift-name { font-weight: 800; letter-spacing: 0.06em; font-size: 0.95rem; }
.hc-shift-ops { font-size: 0.78rem; }
.hc-shift-body { display: flex; gap: 0.9rem; align-items: flex-start; }
/* THE TRIM LINE PICTURE (canon 0.30.154): his machine picture in each shift card; nodes in our panel and line colors, the flow bars in the continuum tubes' greens, moving only while the line runs. */
.hc-shift-stack { flex-direction: column; align-items: stretch; }
.hc-visuals { display: flex; gap: 0.9rem; align-items: flex-start; }
.hc-visuals .hc-trimline { flex: 3 1 26rem; min-width: 0; margin: 0; }
.hc-bud-col { flex: 0 0 14rem; }
.hc-bud { display: block; width: 100%; height: auto; }
.hc-bud-bud { fill: #3ecf6b; }
.hc-bud-stem { fill: #3ecf6b; }
.hc-bud-consumed { fill: #6f7680; }
.hc-bud-consumed[data-hc-bud-waste] { fill: #ba2929; }
/* THE THROBBING WASTE (canon 0.30.266): the deep red pulses while a waste cell is drawn. The trough stays at 0.55 so it never reads as the grey beside it. The legend swatch does not pulse. */
.hc-bud-consumed[data-hc-bud-waste] { animation: hc-waste-throb 1.6s ease-in-out infinite; }
@keyframes hc-waste-throb { 0%, 100% { fill-opacity: 0.55; } 50% { fill-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-bud-consumed[data-hc-bud-waste] { animation-duration: 3.2s; } }
.hc-bud-empty { fill: none; stroke: var(--line, var(--border, #88888899)); stroke-width: 0.6; }
.hc-btr-read { font-variant-numeric: tabular-nums; margin: 0.3rem 0 0.15rem; }
.hc-legend { font-size: 0.72rem; }
.hc-swatch { display: inline-block; width: 0.65rem; height: 0.65rem; border-radius: 0.12rem; margin: 0 0.22rem 0 0; vertical-align: -0.08rem; }
.hc-swatch-bud { background: #3ecf6b; }
.hc-swatch-consumed { background: #6f7680; margin-left: 0.45rem; }
.hc-swatch-waste { background: #ba2929; margin-left: 0.45rem; }
.hc-trimline { display: block; width: 100%; max-width: 46rem; height: auto; margin: 0 auto 0.5rem; }
.hc-trim-rightnow { margin: 0 0 0.8rem; }
.hc-trim-rightnow .hc-trimline { max-width: none; max-height: 70vh; }
.hc-trim-down { color: var(--danger, #8b2e2e); font-weight: 800; }
.hc-btr-bar { position: relative; margin: 0.4rem 0 0.2rem; }
.hc-btr-track { position: relative; display: flex; height: 1.15rem; border: 1px solid var(--line, var(--border, #88888899)); border-radius: 0.2rem; }
.hc-btr-fill { background: #3ecf6b; height: 100%; }
.hc-btr-rest { background: #6f7680; flex: 1 1 auto; min-width: 0; }
.hc-btr-bar-empty .hc-btr-track { background: transparent; }
.hc-btr-tick { position: absolute; top: 0; width: 2px; height: 1.15rem; background: var(--text, currentColor); transform: translateX(-1px); }
.hc-btr-bogey { position: absolute; top: 1.2rem; font-size: 0.68rem; transform: translateX(-50%); }
.hc-btr-bar .hc-btr-read { display: block; margin-top: 1.1rem; text-align: right; font-variant-numeric: tabular-nums; }
.hc-bud-col { margin-left: auto; margin-right: auto; }
.hc-trim-totals { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0.7rem 0; }
.hc-trim-total { min-width: 8rem; }
.hc-trimline .hc-node { fill: var(--panel, var(--surface, transparent)); stroke: var(--line, var(--border, #88888899)); stroke-width: 3; }
.hc-trimline text { fill: var(--text, currentColor); text-anchor: middle; font-family: inherit; }
.hc-trimline .hc-node-label { font-weight: 800; font-size: 30px; letter-spacing: 0.06em; }
.hc-trimline .hc-node-label-big { font-size: 40px; }
.hc-trimline .hc-node-label-small { font-size: 25px; letter-spacing: 0.04em; }
.hc-trimline .hc-node-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hc-trimline .hc-node-sub { font-size: 17px; opacity: 0.75; font-variant-numeric: tabular-nums; }
.hc-trimline .hc-node-muted { opacity: 0.55; font-weight: 400; }
.hc-trimline .hc-flow-a { fill: #43c07a; }
.hc-trimline .hc-flow-b { fill: #2a7d4f; }
.hc-trimline .hc-converge polyline { fill: none; stroke: var(--line, var(--border, #88888899)); stroke-width: 3; stroke-linejoin: round; }
.hc-trimline .hc-converge-dot { fill: var(--line, var(--border, #88888899)); }
.hc-trimline .hc-total-label { font-size: 20px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; }
.hc-trimline .hc-total-value { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
.hc-running { color: #3ecf6b; font-weight: 800; letter-spacing: 0.1em; font-size: 0.8rem; animation: hc-running 1.6s ease-in-out infinite; }
@keyframes hc-running { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-running { animation-duration: 3.2s; } }
/* BRIEF V10, PASTEURIZATION ON THE CONSOLE (canon 0.30.334): the Right now pane's two halves (stacked on the phone), the Rad's green throb like a loading silo (slowed, never stilled, under reduced motion, canon 0.30.79), his CRYO, AMAPS, UV picture in the plume's deep red (canon 0.30.248) with a darker band, the five-figure row of the shift panes. */
.hc-past-rightnow { margin: 0 0 0.8rem; }
.hc-past-halves { display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: stretch; }
.hc-past-half { border: 1px solid var(--line, var(--border, #88888855)); border-radius: 0.6rem; background: var(--panel-2, var(--surface, transparent)); padding: 0.6rem 0.7rem; }
.hc-past-rad { flex: 1 1 14rem; min-width: 12rem; text-align: center; }
.hc-past-rad .hc-icon { width: 9rem; height: auto; max-width: 100%; display: block; margin: 0.2rem auto 0.4rem; color: #3ecf6b; }
.hc-rad-throb path { animation: hc-rad-throb 1.6s ease-in-out infinite; }
@keyframes hc-rad-throb { 0%, 100% { stroke-opacity: 0.3; } 50% { stroke-opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hc-rad-throb path { animation-duration: 3.2s; } }
.hc-rad-lots { font-weight: 800; font-variant-numeric: tabular-nums; margin: 0.2rem 0; overflow-wrap: anywhere; }
.hc-past-rad .silo-clock { display: block; margin-top: 0.25rem; }
.hc-past-cryo { flex: 3 1 30rem; min-width: 0; display: flex; flex-wrap: wrap; gap: 0.9rem; align-items: flex-start; }
.hc-cryoline { display: block; flex: 3 1 22rem; min-width: 0; max-width: 40rem; height: auto; }
.hc-cryoline .hc-node { fill: var(--panel, var(--surface, transparent)); stroke: var(--line, var(--border, #88888899)); stroke-width: 3; }
.hc-cryoline text { fill: var(--text, currentColor); text-anchor: middle; font-family: inherit; }
.hc-cryoline .hc-node-label { font-weight: 800; font-size: 40px; letter-spacing: 0.06em; }
.hc-cryoline .hc-node-value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hc-cryoline .hc-node-sub { font-size: 18px; opacity: 0.75; font-variant-numeric: tabular-nums; }
.hc-cryoline .hc-cryo-flow-a { fill: #ba2929; }
.hc-cryoline .hc-cryo-flow-b { fill: #6e1414; }
.hc-cryo-side { flex: 1 1 12rem; min-width: 11rem; }
.hc-cryo-list { margin: 0.3rem 0 0; display: grid; gap: 0.3rem; }
.hc-cryo-list dt { font-size: 0.7rem; letter-spacing: 0.05em; opacity: 0.8; }
.hc-cryo-list dd { margin: 0; font-variant-numeric: tabular-nums; }
.hc-past-figures { margin: 0.2rem 0 0.6rem; gap: 0.35rem; }
.hc-past-figures .hc-gate-pane { flex: 1 1 5rem; min-width: 5rem; padding: 0.45rem 0.15rem 0.4rem; }
.hc-past-figures .hc-gate-name { font-size: 0.62rem; letter-spacing: 0.02em; }
.hc-past-figures .hc-icon { width: 100%; max-width: 5rem; margin-bottom: 0.25rem; }
/* The V10 gate's fix (canon 0.30.337): a number never breaks between its digits; the row wraps instead. */
.hc-past-figures .hc-value { font-size: 0.95rem; overflow-wrap: normal; }
body.device-phone .hc-past-half { flex-basis: 100%; }
.hc-sheet-hours dd { font-variant-numeric: tabular-nums; }
.hc-shift .hc-metrics { flex: 1 1 auto; }
body.device-phone .hc-shift { flex-basis: 100%; }
body.device-phone .hc-shift-body { flex-wrap: wrap; }
body.device-phone .hc-visuals { flex-wrap: wrap; }
body.device-phone .hc-farm { flex-basis: 100%; }
.inv-gauge { border-radius: 12px; min-height: 12rem; justify-content: flex-start; }
/* Canon 0.30.6: the silo strip with running clocks, above every Drying Operations page (canon 0.30.69: cone-topped cylinders). */
.silo-strip { margin: 0 0 0.6rem; }
.silo-gauge .inv-lot-id a { color: inherit; text-decoration: none; }
.silo-clock { font-variant-numeric: tabular-nums; font-weight: 700; }
.silo-clock-state { font-size: 0.75rem; }
.silo-controls form { display: inline-block; }
.silo-controls button[disabled] { opacity: 0.45; cursor: not-allowed; }
.inv-total { margin: 0.5rem 0; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 0 0.7rem 0.5rem; }
.inv-grams { color: var(--gold); font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.inv-pareto { display: flex; align-items: flex-end; gap: 0.5rem; height: 12rem; margin: 0.8rem 0; }
.inv-pareto-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-width: 0; height: 100%; }
.inv-pareto-bar { width: 100%; background: var(--gold); min-height: 4px; border-radius: 4px 4px 0 0; }
.inv-pareto-label { font-size: 0.7rem; font-weight: 700; margin-top: 0.3rem; word-break: break-all; text-transform: uppercase; }
.inv-fg-type { margin: 0.4rem 0; }
.inv-fg-type > summary { display: flex; align-items: center; gap: 0.7rem; cursor: pointer; min-height: 2.6rem; }
/* Canon 0.30.36: the Zoho pane groups its offerings by category. */
.zoho-cat { margin: 0.5rem 0; }
.zoho-cat > summary { cursor: pointer; min-height: 2.4rem; display: flex; align-items: center; gap: 0.6rem; }
.zoho-cats { margin: 0.6rem 0 1rem; }
table.data td code { font-size: 0.85em; }
/* THE TAG LAW and THE METRC MIRROR (canon 0.30.38) */
.metrc-tag-input { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.04em; min-width: 17ch; }
.tag-missing { font-style: italic; white-space: nowrap; }
.tag-shape-note { cursor: help; }
.metrc-tag-shown { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.crumb { margin: 0 0 0.6rem; }
.metrc-holdings, .metrc-cross, .metrc-lookup, .metrc-drop, .metrc-mounts { margin: 0 0 1.4rem; }
.internal-fields form { flex-wrap: wrap; }
.inv-fg-code { font-weight: 800; flex: 0 0 clamp(3.4rem, 28vw, 11rem); overflow-wrap: anywhere; line-height: 1.1; color: var(--gold); }
.inv-fg-track { flex: 1; height: 1.4rem; background: var(--panel-2); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.inv-fg-bar { display: block; height: 100%; background: var(--gold); }
.inv-fg-stock { font-weight: 700; min-width: 4rem; text-align: right; font-variant-numeric: tabular-nums; }
.inv-fg-unit { font-weight: 400; font-size: 0.85em; }
.inv-fg-note { margin: 0.2rem 0 0.4rem; }
.inv-fg-heading { margin: 1rem 0 0.3rem; }
@media (max-width: 600px) { .inv-fg-type > summary { flex-wrap: wrap; row-gap: 0.2rem; } .inv-fg-code { flex-basis: 100%; } }
.acquire-split .recall-pane { flex: 1 1 16rem; }
.recall-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
.recall-hbn-label { font-weight: 700; word-break: break-all; font-variant-numeric: tabular-nums; }
.recall-btn { min-width: 2.8rem; min-height: 2.8rem; padding: 0; font-size: 1.4rem; }
.saleshelper-embed { width: calc(100vw - 1.25rem); margin-left: calc(50% - 50vw); margin-top: -1.2rem; }
.saleshelper-frame { display: block; width: 100%; border: 0; min-height: 480px; height: calc(100vh - 5.5rem); background: transparent; }
.saleshelper-embed-pane { margin-top: 0.8rem; }
.saleshelper-embed-pane .saleshelper-frame { min-height: 480px; height: calc(100vh - 12rem); }
/* Owner ruling 2026-09-01: the device pill's phone mode, mirrored in BOTH
   view stylesheets. Layout reflows rather than pinch-zooming: the two-pane
   station split stacks (pane above, working pane below by source order),
   tiles and buttons go full width with larger touch targets, tables scroll
   horizontally in place, and the base font steps up a notch. The meta
   viewport stays width=device-width. */
body.device-phone { font-size: 1.25rem; }
body.device-phone .station-split { flex-direction: column; }
body.device-phone .queue-pane { max-width: none; width: 100%; flex: 1 1 auto; }
body.device-phone .working-pane { width: 100%; flex: 1 1 auto; }
body.device-phone .tiles { grid-template-columns: 1fr; }
body.device-phone main button, body.device-phone main .btn { width: 100%; min-height: 3.4rem; }
body.device-phone table.data { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
/* Owner ruling 2026-09-02: operations map. Cerberus: steel plates, gold ink.
   Honeycomb stays untouched. Phone is a vertical chain. */
.ops-map { --ops-arrow: var(--gold); }
.ops-map-desktop { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; width: 100%; overflow-x: hidden; }
.ops-map-phone { display: none; }
.ops-row {
  display: grid; width: 100%; max-width: 46rem;
  grid-template-columns: minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr);
  align-items: center; justify-items: center; gap: 0.45rem 0.55rem;
}
.ops-row-down .ops-arrow-down { grid-column: 5; }
.ops-spacer { display: block; width: 0; height: 0; }
.ops-island { margin: 0; }
/* Owner ruling 2026-09-02 (map polish): rounded steel softkeys with a slight
   shine, raised at rest and pressed on tap; no numbers under the labels; the
   icons sized to fill the key. */
.ops-node {
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  text-decoration: none; color: var(--ink); gap: 0.45rem;
  background: linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0) 55%), var(--panel);
  border: 1px solid var(--line); border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 0 rgba(0,0,0,0.55), 0 10px 18px rgba(0,0,0,0.45);
  padding: 1rem 0.55rem 0.9rem; min-width: 0; width: 100%; max-width: 11rem; min-height: 7.2rem;
}
.ops-node:focus, .ops-node:hover { border-color: var(--gold); }
.ops-node:active {
  transform: translateY(2px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4);
}
.ops-node-stub { opacity: 0.8; border-left: 6px solid #d97706; }
.ops-node-stub:focus, .ops-node-stub:hover { border-left-color: #d97706; }
.ops-icon-svg { width: 3.4rem; height: 3.4rem; display: block; }
.ops-label { display: block; font-weight: 700; margin: 0; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
.ops-menu-lines { display: flex; flex-direction: column; gap: 0.08rem; width: 100%; min-width: 0; max-width: 100%; }
.ops-menu-line { display: flex; flex-wrap: wrap; align-items: baseline; width: 100%; max-width: 100%; min-width: 0; font-size: 0.36rem; line-height: 1.15; font-weight: 600; letter-spacing: 0; text-transform: none; }
.ops-menu-name { flex: 0 1 auto; min-width: 0; white-space: nowrap; }
.ops-menu-status { flex: 0 0 auto; max-width: 100%; white-space: nowrap; }
.ops-menu-dots { flex: 1 1 0.4rem; overflow: hidden; min-width: 0.4rem; white-space: nowrap; }
.ops-menu-dots::before { content: "................................................"; }
@media (max-width: 480px) {
  .ops-menu-dots { display: none; }
  .ops-menu-name, .ops-menu-status { flex: 1 0 100%; white-space: normal; letter-spacing: 0; text-transform: none; }
  .ops-menu-status { text-align: right; }
}
.ops-arrow { color: var(--ops-arrow); flex: 0 0 auto; }
.ops-arrow-right, .ops-arrow-left, .ops-arrow-down { display: block; width: 0; height: 0; }
.ops-arrow-right { border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-left: 16px solid currentColor; }
.ops-arrow-left { border-top: 9px solid transparent; border-bottom: 9px solid transparent; border-right: 16px solid currentColor; }
.ops-arrow-down { border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 16px solid currentColor; }
body.device-phone .ops-map { overflow-x: hidden; width: 100%; }
body.device-phone .ops-map-desktop { display: none; }
body.device-phone .ops-map-phone {
  display: flex; flex-direction: column; align-items: center; gap: 0.45rem;
}
body.device-phone .ops-map-phone .ops-node { width: 100%; max-width: 18rem; }
${walkSliceChrome("cerberus")}
.php-best { background: color-mix(in srgb, var(--ok, #3ecf6b) 28%, transparent); color: var(--ok, #3ecf6b); }
.php-worst { background: color-mix(in srgb, #ba2929 28%, transparent); color: #ba2929; }
.cure-pane > .cure-shade, .cure-pane > .dry-tile-body > .cure-shade { background: rgba(62, 207, 107, 0.5); border-top-color: #3ecf6b; }
.cure-over { color: #ba2929; }
/* =====================================================================
   BOOT SCRAWL (owner ruling 2026-09-01)
   Adapted from the theme prompt's PLATO datapad boot; the referenced
   PLATO_STINGER_SPEC.md is not vendored in this repo, so the chassis,
   glitch, and CRT close are rebuilt here on its five phase timeline. The
   screen marks are typographic because the pixel art asset is not
   vendored either; both marks share the fixed 168px slot.
   --------------------------------------------------------------------- */
#boot-scrawl {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #050507;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
#boot-scrawl[hidden] { display: none; }
#boot-scrawl .boot-pad {
  position: relative;
  width: min(340px, 86vw);
  border-radius: 14px;
  padding: 16px 16px 12px;
  border: 1px solid var(--line-2);
  background: linear-gradient(180deg, var(--chassis-steel), var(--chassis-steel-2));
  box-shadow: 0 18px 60px rgba(0,0,0,0.7);
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
#boot-scrawl .boot-pad::before, #boot-scrawl .boot-pad::after {
  content: "";
  position: absolute;
  top: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #6a6e75, #1a1b1e);
}
#boot-scrawl .boot-pad::before { left: 8px; }
#boot-scrawl .boot-pad::after { right: 8px; }
#boot-scrawl.boot-on .boot-pad { opacity: 1; transform: none; }
#boot-scrawl .boot-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; padding: 0 2px 10px; }
#boot-scrawl .boot-name { font-weight: 800; letter-spacing: 0.3em; font-size: 0.85rem; color: var(--ink); }
#boot-scrawl .boot-sub { font-size: 0.6rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-mute); }
#boot-scrawl .boot-bezel { border: 1px solid var(--chassis-bezel); border-radius: 8px; padding: 8px; background: #0a0a0c; }
#boot-scrawl .boot-screen {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: #0b0a06;
  box-shadow: inset 0 0 26px rgba(241,194,50,0.22);
  transform-origin: 50% 50%;
}
#boot-scrawl .boot-slot { height: 168px; display: flex; align-items: center; justify-content: center; }
/* Owner ruling 2026-09-01 (brand slice fix): the 2906ms swap toggles the
   hidden attribute, but the marks' own display:flex rules defeated the UA's
   [hidden] display none, so both screens rendered side by side (the plate
   clipped at the screen edge, the spray pushed out of view). This guard makes
   hidden absolute inside the slot: before the swap only the Continuum lockup
   exists on screen, after it only the reveal composition does. */
#boot-scrawl .boot-slot [hidden] { display: none !important; }
#boot-scrawl .boot-mark {
  font-weight: 800;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  text-align: center;
  font-size: 1.15rem;
  color: var(--gold);
  text-shadow: 0 0 12px rgba(241,194,50,0.45);
}
/* Owner ruling 2026-09-01 (brand slice): the first screen's PLATO wordmark
   is the Continuum lockup now, the CO mark beside CONTINUUM in Inter 800
   caps with wide tracking, white; clean, no filigree (the owner expects
   touch-up later). The five phase timeline is untouched. */
#boot-scrawl .boot-mark-continuum { display: flex; align-items: center; justify-content: center; gap: 12px; color: #ffffff; text-shadow: none; }
#boot-scrawl .boot-co-mark { width: 46px; height: auto; display: block; }
#boot-scrawl .boot-continuum-word { font-weight: 800; letter-spacing: 0.3em; font-size: 1.1rem; color: #ffffff; }
/* Owner ruling 2026-09-01 (brand slice): the brand reveal frame, per the
   owner's words: "the Grip Logo with the word Factory stamped into diamond
   plate and bolted to the background followed by the word lite spray painted
   diagonally across the bottom right 25% of the factory plate spilling over
   onto the background." A centered vertical stack on the dark screen: the
   GRIP hex mark leads near-white up top, the plate photo (which already
   reads FACTORY stamped with corner bolts) sits under it at 64% of the
   screen width so it never touches the screen edges, and the spray rides
   the plate's bottom right quarter, spilling past the plate onto the screen
   background while staying inside the screen's overflow clip (the frame's
   bottom padding biases the stack up to make room for the overhang). The
   spray look is a tight pass plus a wide soft overspray pass of gold
   text-shadow, with a cheap mask gradient for the subtle irregular opacity. */
#boot-scrawl .boot-brand-frame { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; width: 100%; padding-bottom: 20px; }
#boot-scrawl .boot-grip-mark { height: 58px; width: auto; display: block; color: #f4f4f5; }
#boot-scrawl .boot-plate-wrap { position: relative; display: block; width: 64%; }
#boot-scrawl .boot-plate { display: block; width: 100%; height: auto; }
#boot-scrawl .boot-spray-lite {
  position: absolute; right: -8%; bottom: -10%;
  width: 34%; text-align: center;
  font-weight: 800; font-style: italic; text-transform: lowercase;
  font-size: 2rem; line-height: 1; letter-spacing: 0.04em;
  transform: rotate(-15deg); pointer-events: none;
  color: var(--gold);
  text-shadow:
    0 0 1px rgba(241,194,50,0.95), 0 0 3px rgba(241,194,50,0.8),
    0 0 12px rgba(241,194,50,0.5), 0 0 26px rgba(241,194,50,0.3),
    2px 3px 20px rgba(241,194,50,0.28);
  -webkit-mask-image: linear-gradient(105deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.82) 40%, rgba(0,0,0,0.97) 65%, rgba(0,0,0,0.85) 100%);
          mask-image: linear-gradient(105deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.82) 40%, rgba(0,0,0,0.97) 65%, rgba(0,0,0,0.85) 100%);
}
#boot-scrawl .boot-screen::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(180deg, rgba(241,194,50,0.06) 0 1px, transparent 1px 3px);
}
#boot-scrawl.boot-hold .boot-screen::after { animation: boot-scan-drift 2.2s linear infinite; }
@keyframes boot-scan-drift { from { transform: translateY(0); } to { transform: translateY(3px); } }
#boot-scrawl.boot-glitch .boot-screen { animation: boot-tear 85ms steps(2) infinite; }
#boot-scrawl.boot-glitch .boot-mark { text-shadow: 2px 0 rgba(224,87,87,0.85), -2px 0 rgba(84,183,116,0.85); }
@keyframes boot-tear {
  0% { transform: translateX(0); }
  25% { transform: translateX(-3px) skewX(1.5deg); }
  50% { transform: translateX(2px); }
  75% { transform: translateX(-1px) skewX(-1deg); }
  100% { transform: translateX(0); }
}
#boot-scrawl.boot-collapse .boot-screen { transform: scaleY(0.02); transition: transform 0.2s ease-in; }
#boot-scrawl.boot-line .boot-screen { box-shadow: inset 0 0 26px rgba(241,194,50,0.6), 0 0 18px rgba(241,194,50,0.5); }
#boot-scrawl.boot-off .boot-screen { opacity: 0; transition: opacity 0.1s ease; }
#boot-scrawl.boot-out .boot-pad { opacity: 0; transform: translateY(10px); transition: opacity 0.15s ease, transform 0.15s ease; }
#boot-scrawl.boot-out { opacity: 0; transition: opacity 0.15s ease; }
#boot-scrawl .boot-keys { display: flex; align-items: center; gap: 6px; padding: 10px 2px 0; }
#boot-scrawl .boot-keys span { flex: 1; height: 8px; border-radius: 2px; background: linear-gradient(180deg, #4a4e55, #26282c); border: 1px solid #1c1d20; }
#boot-scrawl .boot-tag { font-style: normal; font-size: 0.55rem; letter-spacing: 0.14em; color: var(--ink-mute); padding-left: 6px; }
@media (prefers-reduced-motion: reduce) { #boot-scrawl { display: none !important; } }
/* THE BAR CARRIES REPORTS AND ADMIN (canon 0.30.201): the 2026-09-02 lock to
   the bottom right is reversed; the two ride at the end of the app bar.
   Cerberus discipline: steel plate, gold ink, all caps letterspaced. */
.bar-actions { display: flex; align-items: center; gap: 0.55rem; margin-left: auto; }
.models-link, .harvest-link, .maintenance-link, .admin-link, .reports-link {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 2.5rem; padding: 0.35rem 1rem;
  background: var(--panel); color: var(--gold);
  border: 1px solid var(--gold); border-radius: 8px;
  font-weight: 700; font-size: 0.82rem; letter-spacing: 0.16em; text-transform: uppercase;
  text-decoration: none;
}
.models-link:hover, .harvest-link:hover, .maintenance-link:hover, .admin-link:hover, .reports-link:hover { background: var(--gold); color: #1a1500; }
.models-link:focus-visible, .harvest-link:focus-visible, .maintenance-link:focus-visible, .admin-link:focus-visible, .reports-link:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
`;
}

/** Owner ruling 2026-09-01: the Cerberus client chrome the layout appends at
 * the end of body, Cerberus view only. First the background script: the
 * honeycomb and bloom code verbatim from prompts/CERBERUSTHEMEPROMPT.md
 * (sections 3b and 5; one comment rephrased in ASCII per the dash law), plus
 * the adapted arrival wiring. Then the boot scrawl overlay and its script.
 * Owner ruling 2026-09-01 (brand slice): the first screen carries the
 * Continuum lockup (the chassis head follows, since it too read PLATO on the
 * first screen); the reveal frame carries the GRIP mark, the FACTORY plate
 * photo, and the spray painted lite. The strings on the datapad are brand
 * marks and stay literal by the bar's old precedent. */
export function cerberusChrome(): string {
  return `<script>
const SVGNS='http://www.w3.org/2000/svg';
const HC = { R:26, svg:null, verts:null, bottoms:[], w:0, h:0, d:'', lensSeq:0 };
function reducedMotion(){ return typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches; }

function buildHoneycomb(){
  let svg=document.getElementById('honeycomb');
  if(!svg){ svg=document.createElementNS(SVGNS,'svg'); svg.id='honeycomb'; svg.setAttribute('aria-hidden','true'); document.body.appendChild(svg); }
  while(svg.firstChild) svg.removeChild(svg.firstChild);
  const W=HC.w=window.innerWidth, H=HC.h=window.innerHeight, R=HC.R;
  svg.setAttribute('width',W); svg.setAttribute('height',H); svg.setAttribute('viewBox',\`0 0 \${W} \${H}\`);
  const hexW=Math.sqrt(3)*R, vSpace=1.5*R;
  const verts=new Map(); const edges=new Set();
  const vkey=(x,y)=>Math.round(x)+'_'+Math.round(y);
  function vert(x,y){ const k=vkey(x,y); let v=verts.get(k); if(!v){ v={key:k,x,y,nbrs:new Map()}; verts.set(k,v); } return v; }
  function addEdge(ax,ay,bx,by){ const a=vert(ax,ay), b=vert(bx,by);
    const ek=a.key<b.key?a.key+'|'+b.key:b.key+'|'+a.key; if(edges.has(ek)) return; edges.add(ek);
    const w=Math.hypot(a.x-b.x,a.y-b.y); a.nbrs.set(b.key,w); b.nbrs.set(a.key,w); }
  const cols=Math.ceil(W/hexW)+2, rows=Math.ceil(H/vSpace)+2;
  for(let row=-1; row<rows; row++) for(let col=-1; col<cols; col++){
    const cx=col*hexW + (Math.abs(row%2)?hexW/2:0), cy=row*vSpace;
    const p=[]; for(let k=0;k<6;k++){ const a=Math.PI/180*(60*k-90); p.push([cx+R*Math.cos(a), cy+R*Math.sin(a)]); }
    for(let k=0;k<6;k++){ const q=p[(k+1)%6]; addEdge(p[k][0],p[k][1],q[0],q[1]); }
  }
  let d=''; edges.forEach(ek=>{ const [k1,k2]=ek.split('|'); const a=verts.get(k1), b=verts.get(k2);
    d+=\`M\${a.x.toFixed(1)} \${a.y.toFixed(1)}L\${b.x.toFixed(1)} \${b.y.toFixed(1)}\`; });
  const base=document.createElementNS(SVGNS,'path'); base.setAttribute('class','hc-base'); base.setAttribute('d',d); svg.appendChild(base);
  const wave=document.createElementNS(SVGNS,'path'); wave.setAttribute('class','hc-wave'); wave.setAttribute('d',d); svg.appendChild(wave);
  HC.svg=svg; HC.verts=verts; HC.d=d;
  HC.bottoms=[...verts.values()].filter(v=>v.y>=H-R*1.2);
}

// Most-vertical climb: from origin, always step to the upward neighbor with the smallest
// horizontal change (prefers the hex's vertical edges), tie-broken toward the origin's x.
function mostVerticalPath(startKey){
  const V=HC.verts, R=HC.R;
  let cur=V.get(startKey); const startX=cur.x;
  const out=[[cur.x,cur.y]]; const seen=new Set([startKey]); let guard=0;
  while(cur.y>R*1.2 && guard++<4000){
    let best=null;
    cur.nbrs.forEach((w,nk)=>{ const n=V.get(nk);
      if(n.y < cur.y-0.1 && !seen.has(nk)){
        if(!best){ best=n; return; }
        const da=Math.abs(n.x-cur.x), db=Math.abs(best.x-cur.x);
        if(da<db-0.1 || (Math.abs(da-db)<0.1 && Math.abs(n.x-startX)<Math.abs(best.x-startX))) best=n;
      }});
    if(!best) break;
    seen.add(best.key); out.push([best.x,best.y]); cur=best;
  }
  return out; // origin (bottom) to top
}

function firePulse(){
  if(!HC.verts || !HC.bottoms.length || reducedMotion()) return;
  const start=HC.bottoms[Math.floor(Math.random()*HC.bottoms.length)];
  let pts=mostVerticalPath(start.key);
  if(!pts || pts.length<2) return;
  const d='M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L');
  const path=document.createElementNS(SVGNS,'path'); path.setAttribute('d',d);
  path.style.fill='none'; path.style.stroke='none';
  HC.svg.appendChild(path);
  const L=path.getTotalLength();
  const lid='hclens'+(++HC.lensSeq);
  const clip=document.createElementNS(SVGNS,'clipPath'); clip.setAttribute('id',lid); clip.setAttribute('clipPathUnits','userSpaceOnUse');
  const clipShape=document.createElementNS(SVGNS,'path'); clip.appendChild(clipShape); HC.svg.appendChild(clip);
  const lensG=document.createElementNS(SVGNS,'g'); lensG.setAttribute('clip-path',\`url(#\${lid})\`);
  const lensLine=document.createElementNS(SVGNS,'path'); lensLine.setAttribute('class','hc-lens-line'); lensLine.setAttribute('d',HC.d);
  lensG.appendChild(lensLine); HC.svg.appendChild(lensG);
  const core=document.createElementNS(SVGNS,'circle'); core.setAttribute('class','hc-bulge-core'); core.setAttribute('r','2.6'); HC.svg.appendChild(core);
  const A=18, B=6.5, MAG=1.6;   // aperture half-length / half-width; lens magnification
  function spindleD(px,py,tx,ty){
    const nx=-ty, ny=tx;
    const fx=px+tx*A, fy=py+ty*A, rx=px-tx*A, ry=py-ty*A;
    const c1x=px+nx*2*B, c1y=py+ny*2*B, c2x=px-nx*2*B, c2y=py-ny*2*B;
    return \`M\${fx.toFixed(1)} \${fy.toFixed(1)}Q\${c1x.toFixed(1)} \${c1y.toFixed(1)} \${rx.toFixed(1)} \${ry.toFixed(1)}\`
         + \`Q\${c2x.toFixed(1)} \${c2y.toFixed(1)} \${fx.toFixed(1)} \${fy.toFixed(1)}Z\`;
  }
  const dur=Math.min(950, Math.max(475, L*0.525)), t0=performance.now();
  (function step(t){
    const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,2); // ease-out
    const s=L*e;
    const p=path.getPointAtLength(s);
    const pa=path.getPointAtLength(Math.max(0,s-2)), pb=path.getPointAtLength(Math.min(L,s+2));
    let dx=pb.x-pa.x, dy=pb.y-pa.y, m=Math.hypot(dx,dy)||1; dx/=m; dy/=m;
    clipShape.setAttribute('d', spindleD(p.x,p.y,dx,dy));
    lensLine.setAttribute('transform', \`translate(\${p.x.toFixed(1)} \${p.y.toFixed(1)}) scale(\${MAG}) translate(\${(-p.x).toFixed(1)} \${(-p.y).toFixed(1)})\`);
    core.setAttribute('cx',p.x); core.setAttribute('cy',p.y);
    if(k<1) requestAnimationFrame(step);
    else { lensG.style.transition=core.style.transition='opacity .3s ease';
      requestAnimationFrame(()=>{ lensG.style.opacity='0'; core.style.opacity='0'; });
      setTimeout(()=>{ path.remove(); clip.remove(); lensG.remove(); core.remove(); }, 360); }
  })(t0);
}

function hcWave(){
  const svg=HC.svg; if(!svg || reducedMotion()) return;
  svg.classList.remove('hc-wave-on'); void svg.getBoundingClientRect(); // restart animation
  svg.classList.add('hc-wave-on');
  setTimeout(()=>svg.classList.remove('hc-wave-on'), 1100);
}

(function initHoneycomb(){
  buildHoneycomb();
  let rt; window.addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(buildHoneycomb,250); });
  setTimeout(firePulse, 6000);        // first pulse shortly after load
  setInterval(firePulse, 15000);      // steady cadence: every 15s
  (function randomPulse(){ const delay=10000+Math.random()*50000;   // second, independent emitter
    setTimeout(()=>{ firePulse(); randomPulse(); }, delay); })();
})();
function hexPolyPoints(cx,cy,r){
  const p=[]; for(let k=0;k<6;k++){ const a=Math.PI/180*(60*k-90);
    p.push((cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1)); }
  return p.join(' ');
}
function playLogoBloom(el, dir){
  if(!el || (typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const rect=el.getBoundingClientRect(); if(rect.width<=0) return;
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  const r=Math.max(rect.width,rect.height)/1.7320508*0.95;
  const sweep = dir==='left' ? (cx+rect.width) : (window.innerWidth - cx + rect.width);
  const svg=document.createElementNS(SVGNS,'svg');
  svg.setAttribute('class','logo-bloom');
  svg.setAttribute('width',window.innerWidth); svg.setAttribute('height',window.innerHeight);
  svg.setAttribute('viewBox',\`0 0 \${window.innerWidth} \${window.innerHeight}\`);
  svg.setAttribute('aria-hidden','true');
  [{d:0,op:0.85,ms:620},{d:100,op:0.6,ms:720},{d:200,op:0.45,ms:820}].forEach(ring=>{
    const poly=document.createElementNS(SVGNS,'polygon');
    poly.setAttribute('points',hexPolyPoints(cx,cy,r));
    poly.style.setProperty('--sweep', sweep+'px');
    poly.style.setProperty('--op', String(ring.op));
    poly.style.opacity=String(ring.op);
    poly.style.animation=\`logo-bloom-sweep-\${dir} \${ring.ms}ms cubic-bezier(0.16,0.84,0.44,1) \${ring.d}ms forwards\`;
    svg.appendChild(poly);
  });
  document.body.appendChild(svg);
  el.classList.add('logo-bloom-kick');
  setTimeout(()=>{ svg.remove(); el.classList.remove('logo-bloom-kick'); }, 1100);
}
/* Owner ruling 2026-09-01: adapted arrival wiring. The reference fires two
   logo blooms and one wave 260ms after the splash goes; this chrome has one
   brand mark on the left and the view pill on the right, so those anchor the
   blooms. Server rendered pages arrive per load, so when the boot scrawl is
   not playing this load the wave alone acknowledges the page change (the
   prompt's law: fire the wave on every screen change). */
window.gfWave=hcWave;
window.gfArrival=function(){
  playLogoBloom(document.querySelector('.brand'),'left');
  playLogoBloom(document.querySelector('.view-pill'),'right');
  hcWave();
};
</script>
<div id="boot-scrawl" hidden>
  <div class="boot-pad">
    <div class="boot-head"><span class="boot-name">CONTINUUM</span><span class="boot-sub">Digital Alchemy</span></div>
    <div class="boot-bezel">
      <div class="boot-screen">
        <div class="boot-slot">
          <span class="boot-mark boot-mark-plato boot-mark-continuum">${coMarkSvg("boot-co-mark")}<span class="boot-continuum-word">CONTINUUM</span></span>
          <span class="boot-mark boot-mark-grip boot-brand-frame" hidden>${gripMarkSvg("boot-grip-mark")}<span class="boot-plate-wrap"><img class="boot-plate" src="/brand/factory-plate.png" alt="FACTORY"><span class="boot-spray-lite">lite</span></span></span>
        </div>
      </div>
    </div>
    <div class="boot-keys"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><i class="boot-tag">GF-v0.1.0</i></div>
  </div>
</div>
<script>
(function(){
  var el=document.getElementById('boot-scrawl');
  if(!el) return;
  /* Owner ruling 2026-09-01: the boot scrawl plays once per browser session,
     Cerberus view only. Reduced motion skips it entirely; a storage failure
     skips it too, never blocking the page; a click anywhere skips it at once.
     The page content renders beneath regardless: the overlay only removes
     itself, it never gates the page. */
  var reduced=typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen=true;
  try{
    seen=sessionStorage.getItem('gf_boot_seen')==='1';
    if(!seen) sessionStorage.setItem('gf_boot_seen','1');
  }catch(err){ seen=true; }
  if(reduced || seen){
    el.remove();
    if(window.gfWave) setTimeout(window.gfWave,80);
    return;
  }
  el.hidden=false;
  var timers=[];
  var done=false;
  function at(ms,fn){ timers.push(setTimeout(fn,ms)); }
  function finish(){
    if(done) return;
    done=true;
    for(var i=0;i<timers.length;i++) clearTimeout(timers[i]);
    el.remove();
    if(window.gfArrival) setTimeout(window.gfArrival,260);
  }
  el.addEventListener('click',finish);
  requestAnimationFrame(function(){ el.classList.add('boot-on'); });
  /* The prompt's cumulative timeline: 300 hold, 2600 glitch, 2906 image swap
     (45% through), 3280 glitch ends, 4430 collapse, 4630 scanline, 4730 off,
     4830 chassis out, 4980 overlay removed. */
  at(300,function(){ el.classList.add('boot-hold'); });
  at(2600,function(){ el.classList.add('boot-glitch'); });
  at(2906,function(){
    var p=el.querySelector('.boot-mark-plato');
    var g=el.querySelector('.boot-mark-grip');
    if(p) p.hidden=true;
    if(g) g.hidden=false;
  });
  at(3280,function(){ el.classList.remove('boot-glitch'); });
  at(4430,function(){ el.classList.add('boot-collapse'); });
  at(4630,function(){ el.classList.add('boot-line'); });
  at(4730,function(){ el.classList.add('boot-off'); });
  at(4830,function(){ el.classList.add('boot-out'); });
  at(4980,finish);
})();
</script>`;
}

/** Owner ruling 2026-09-01: the hosted SalesHelper form's serve-time theme
 * injection. Runtime decoration only: this block is spliced before the served
 * HTML string's closing head tag when the gf_view cookie is not lite; the
 * vendored file NEVER changes on disk (its sha256 stands) and the owner
 * expects visual touch-up later. Conservative selectors: the form's own token
 * variables remap toward the Cerberus tokens (dark bg, panel surfaces, ink
 * text, gold accent), plus its four top-level hardcoded-light surfaces
 * (header, inputs, selects, the proposal panel). The id doubles as the smoke
 * and vitest marker for presence under cerberus and absence under lite. */
export function salesHelperCerberusSkin(): string {
  return `<style id="gf-cerberus-skin">
:root{
  --bg:#0c0c0e; --card:#15161a; --ink:#f4f4f5; --muted:#b6b8c0; --line:#2a2d35;
  --chip:#1c1e24; --accent:#f1c232; --green:#101116; --green2:#e9d57f;
  --warn:#e5c07b; --warnbg:#2c2312;
}
body{ color-scheme:dark; }
header{ background:linear-gradient(180deg,#15161a,#101116); border-bottom:1px solid #2a2d35; }
input,select{ background:#1c1e24; color:#f4f4f5; }
#proposal{ background:#15161a; }
</style>`;
}
