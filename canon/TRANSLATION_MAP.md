# THE TRANSLATION MAP (canon 0.30.391, draft for his markup)

The principle, his, 2026-10-04 (canon 0.30.390), verbatim: "I want it to translate real life into METRC and give us real life back--METRC is a state-mandated obstacle." So gripfactory keeps three things apart:

1. THE FLOOR: what physically happened, in the floor's words (a tote weighed, a silo loaded, a lot moved to Cold Storage A).
2. THE TRANSLATOR: what METRC must be told because of it (today Pending Data Uploads, one CSV kind per event; `metrcapi.ts` holds the API's shape with its write switch off).
3. THE MIRROR: what METRC says back (`metrc_plants`, `metrc_packages`, read by sweeps). The mirror confirms a translation landed; where it disagrees with the floor, the app shows the difference.

Read the table as: the floor does this, so the translator owes that, and the mirror proves it with this. Read on the live tree `ea557ac9390d821e` (L2 at `00811dcfb247ec3b` adds nothing to the translator).

## The map

| # | Real life (the floor records) | The METRC action owed (the translator) | The mirror's proof | Today |
|---|---|---|---|---|
| 1 | Harvest: plants cut, totes weighed wet, by HBN | Create harvest from plants: Wet Weights CSV (`wet_weights`: Plant, Weight, DryingLocation, HarvestName, ActualDate) | `metrc_plants.harvested` and `phase` per tag | Translated. Proof by plant only: the mirror holds no harvests, so the harvest's name, wet weight and location are never read back |
| 2 | Load a silo (Barn to Silo n) | Harvest location change (`location_change`, the dry space's `location_name`) | none (no harvest mirror) | Translated, unconfirmed |
| 3 | Change Location setup's moves | Location move (`location_move`, one file per Execute) | `metrc_packages.location` where the move names packages; none for harvests | Translated |
| 4 | Unload: dry weigh, the over and under reconcile | Bucked: package from harvest (`package_from_harvest`); silo or a reconcile choice: package adjust (`package_adjust`) | `metrc_packages` with `source_harvests` naming the HBN; `quantity` | Translated, confirmable (not compared) |
| 5 | Cure: unloaded lands in Cold Storage A; a scheduled trim moves it to Cold Storage B (V7, automatic) | A location change to Cold Storage A, then B | the harvest's or package's location | GAP 1: nothing pends; METRC can still say Barn while the floor says Cold Storage A |
| 6 | Trim: the trim reconcile | Package adjust (`package_adjust`, the queue_adjust choice) | `metrc_packages.quantity` | Translated |
| 7 | Split a package (children of a parent) | Package split (`package_split`) | the children's tags with `source_packages` naming the parent | Translated |
| 8 | Freeze: a finished cryo run's outputs | New packages, the T3 autofill (`new_packages`) | the outputs' tags with their source harvest | Translated |
| 9 | Prepack line finished | New packages and finish (stamped `new_packages`, `package_finish`) | the prepack tags | Translated |
| 10 | Ship and receive between our licenses | Manifest; receive (`manifest`, `receive_manifest`) | `metrc_packages.license_value` and `gone_at` | Translated |
| 11 | Pull a compliance sample | New package for the sample (`test_sample`; the API POST shaped, not sent) | `metrc_packages.lab_test_status` releases the queue (0.30.193) | Translated, confirmed |
| 12 | Lab result | none owed (the lab posts it) | `lab_test_status`; the station's potency | Read back |
| 13 | Print a label (L1 to L3) | none owed | reads back the harvest date and THC (L2) | Read back. GAP 4: the harvest name decoder sits in `labeldata.ts` |
| 14 | Sensor readings in the cure rooms | none owed | none | No METRC counterpart, by design |
| 15 | Processing (extraction, carts, pooled retail goods) | Packages from packages with ingredients | the strangers in `metrc_packages`, read only | GAP 3: not modeled; only seen in the mirror |
| 16 | Destroy waste, plant moves in veg and flower | Plant waste, plant location and phase changes | `metrc_plants.phase`, `location` | GAP 5: not recorded in the app today |

## The gaps, by what each needs

1. CURE LOCATION. The cure panes know where every lot is; the translator should pend a location change on the CSA landing and on the move to CSB, the same as Load Silo (row 2). Small, and the cure spaces already carry their `location_name`.
2. THE MIRROR HOLDS NO HARVESTS. Rows 1, 2 and 5 can be sent but never proved. A harvests sweep (name, dates, wet weight, location, state) is the missing third leg; it is also where a harvest's real date comes from, so the name decoder of gap 4 becomes the fallback, not the source.
3. PROCESSING. Not done in house today. When it is, the floor records a run (inputs weighed out, outputs weighed in, waste), and the translator owes one package from packages per output with its ingredients. The mixed harvest label reads the earliest harvest date (his pick, 2026-10-04), which METRC derives from those ingredients.
4. DECODERS BELONG TO THE METRC LAYER. The harvest name's coded date (three shapes, 0.30.389), the lot token, location words like 832 Barn: METRC's encodings are read in one module and handed to the floor as plain facts.
5. THE FLOOR VS METRC REPORT. No screen compares what the floor says with what the mirror says. The next brief (his "Sounds good"): per lot and per package, the floor's location, weight and state against the mirror's, each difference named with the translation that would clear it or the reason it cannot.

## The rules this map proposes

- R1. Every floor event names its translation or says "none owed" (this table is the list; a new event joins it in its brief).
- R2. Every translation names its proof in the mirror, or the gap that keeps it unproved.
- R3. The floor's records never hold a METRC encoding; the translator and the mirror hold them.
- R4. When the write switch turns on, the files become calls; the map does not change, only the delivery.

Marks welcome on any row: a wrong pairing, a missing event, or the order to close the gaps.
