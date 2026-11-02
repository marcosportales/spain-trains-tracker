# Run detail includes Scheduled Runs

The Station board lists Scheduled Runs and Tracked Runs alike, but Run detail used to answer 404 for any Run without a Sighting. Opening a Scheduled Run from the board therefore led to a dead end.

Run detail now answers 200 for any Run in the timetable. `RunDetail.position` is optional: it is absent for a Scheduled Run and present once the Run has a Sighting. Run detail answers 404 only for a Run found in neither the timetable nor the live data.

## Alternatives rejected

- **Filter the Station board to Runs that already have a Sighting.** This hides most upcoming departures, which defeats the purpose of the board.
- **Keep the 404 and show a friendlier message.** The board would still link to Runs the user cannot open, and the timetable data we already hold would go unused.

## Consequences

- The `RunDetail` contract change is breaking: consumers can no longer assume `position` is present and must handle a Run without one.
- A Scheduled Run becomes a Tracked Run when its first Sighting arrives, with no change of identity (see ADR 0004).
