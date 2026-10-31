-- WG1, THE WORKSGIVING POLL (the owner, 2026-10-30): the public poll at /special/worksgiving26.
-- Additive: two new tables and their seed row; nothing else changes. 0124 is LD1's (the distillate ledger) and 0125
-- is FB1's (the prepack bags), so this takes 0126.
--
-- potluck_events: the event's words, typed at /admin/special/worksgiving26 behind the Admin PIN, so no name rides
-- in a repo file. The seed carries the date, a neutral time note, no place, and the close: Tuesday 2026-11-17 at
-- 5:00 PM farm time (22:00Z), three days before the event.
-- potluck_responses: one live answer per email per event (the partial unique index); a removed answer (deleted_at)
-- frees the email to answer again. No caps on the categories (his pick: "No caps, show live counts").
-- Yes +1 (his word, 2026-10-30: "add a "Yes +1" option to the RSVP") is its own answer and counts two people.

CREATE TABLE potluck_events (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  when_note TEXT NOT NULL DEFAULT '',
  where_text TEXT NOT NULL DEFAULT '',
  contact_text TEXT NOT NULL DEFAULT '',
  closes_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE potluck_responses (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL REFERENCES potluck_events(key),
  email TEXT NOT NULL CHECK (email = lower(trim(email)) AND length(email) BETWEEN 3 AND 254),
  attending TEXT NOT NULL CHECK (attending IN ('yes', 'yes_plus_one', 'no', 'maybe')),
  category TEXT CHECK (category IS NULL OR category IN ('main', 'hot_side', 'cold_side', 'bread', 'dessert', 'drinks')),
  dish TEXT CHECK (dish IS NULL OR length(dish) BETWEEN 2 AND 80),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'potluck_form',
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  deleted_at TEXT,
  deleted_by TEXT,
  CHECK ((category IS NULL) = (dish IS NULL)),
  CHECK (attending <> 'no' OR category IS NULL)
);

CREATE UNIQUE INDEX potluck_responses_one_per_email ON potluck_responses (event_key, email) WHERE deleted_at IS NULL;
CREATE INDEX potluck_responses_event_live ON potluck_responses (event_key, deleted_at, category);

INSERT INTO potluck_events (key, name, event_date, when_note, where_text, contact_text, closes_at, created_at, created_by, updated_at, updated_by)
VALUES ('worksgiving26', 'Worksgiving Potluck', '2026-11-20', 'after your shift', '', '', '2026-11-17T22:00:00.000Z',
        '2026-10-30T00:00:00.000Z', 'migration', '2026-10-30T00:00:00.000Z', 'migration');
