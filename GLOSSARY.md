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

**Delay**:
How far a Run is behind its schedule at a given moment, in seconds.
_Avoid_: Lateness, retraso (in code)

**Service alert**:
An official notice from Renfe about a disruption that affects one or more Lines.
_Avoid_: Incident, aviso (in code)

## Data provenance

**Source**:
An upstream feed a Sighting comes from: an official GTFS-RT feed, or the unofficial visor.
_Avoid_: Provider, origin

**Official feed**:
Renfe's documented GTFS and GTFS-RT datasets on data.renfe.com. These are the primary Source.

**Visor feed**:
Renfe's undocumented JSON used by its own live viewer. This is an optional Source used only to enrich data.
_Avoid_: Unofficial API, scraper
