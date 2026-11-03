# Spain Trains Tracker

Live and historical view of Renfe trains across Spain, built from Renfe's open data feeds.

## Network

**Service type**:
The commercial family a Run belongs to: Cercanías, AVE, Larga Distancia, Media Distancia, or Ancho métrico.
_Avoid_: Product, category

**Hub**:
A city-level Cercanías network (Madrid, Rodalies de Catalunya, Valencia…). Spanish alias: Núcleo.
_Avoid_: Region, network, city

**Line**:
A named commercial route that Runs operate on (C1, R2, AVE Madrid–Sevilla).
_Avoid_: Route (except when referring to the raw GTFS field)

**Station**:
A place where Runs stop, identified by Renfe's station code.
_Avoid_: Stop (except for the raw GTFS field), halt

**Track geometry**:
The drawn path of a Line between Stations, used to place and animate Runs on the map.
_Avoid_: Shape, polyline

## Movement

**Run**:
One concrete journey of a train number on a service date (the AVE 03063 on 2026-10-31). What users casually call "a train". Spanish alias: Circulación.
_Avoid_: Train, trip, journey

**Scheduled Run**:
A Run known only from the timetable, with no Sighting yet (it has not departed, or no feed has reported it). It becomes a Tracked Run when its first Sighting arrives. Station boards list Scheduled Runs and Tracked Runs alike.
_Avoid_: Planned run, future train

**Tracked Run**:
A Run with at least one Sighting, so it has a known position on the map.
_Avoid_: Live run, active train

**Train number**:
The commercial number that identifies a Run within its service date.
_Avoid_: Train ID, code

**Service date**:
The operating day a Run belongs to, which may differ from the calendar date for Runs past midnight.

**Rolling stock**:
The physical unit or coupled units operating a Run (for example an S-112 double unit). Spanish alias: Material.
_Avoid_: Train, vehicle, composition

**Sighting**:
One reported position and status of a Run at an instant, from one Source. Sightings make up the history.
_Avoid_: Position, ping, snapshot

**Service status**:
Whether a Run is going ahead as timetabled (`scheduled`) or has been called off (`cancelled`). Not to be confused with a Run's position status on the map.
_Avoid_: State

**Delay**:
How far a Run is behind its schedule at a given moment, in seconds.
_Avoid_: Lateness, retraso (in code)

**Delay band**:
The plain-language bucket a Delay falls into, used everywhere a Run's punctuality is shown: On time (under 5 minutes), Late (5 to under 15 minutes), Severely late (15 minutes or more). A cancelled Run, or one with no known Delay, has no band.
_Avoid_: Minor/major delay, badge

**On time**:
A Run whose Delay is under 5 minutes. The same threshold applies to a single Run and to Punctuality figures.
_Avoid_: Punctual (as a loose synonym with a different threshold)

**Punctuality**:
The share of Runs on a Line, over a period, that reached their destination On time.
_Avoid_: On-time percentage of observations

**Station board**:
The next 2 hours of scheduled departures and arrivals at a Station, with each Run's live Delay and Service status.
_Avoid_: Timetable, schedule (the board is the timetable joined with live data)

**Service alert**:
An official notice from Renfe about a disruption that affects one or more Lines.
_Avoid_: Incident, aviso (in code)

## Search

**Suggestion**:
A Run, Station or Line offered in the search panel before the user has typed anything.
_Avoid_: Recommendation, popular result

**Recent**:
A search result the user chose before, remembered only in their own browser.
_Avoid_: History (that word is the Sightings), favourite

## Data provenance

**Source**:
An upstream feed a Sighting comes from: an official GTFS-RT feed, or the unofficial visor.
_Avoid_: Provider, origin

**Official feed**:
Renfe's documented GTFS and GTFS-RT datasets on data.renfe.com. These are the primary Source.

**Visor feed**:
Renfe's undocumented JSON used by its own live viewer. This is an optional Source used only to enrich data.
_Avoid_: Unofficial API, scraper
