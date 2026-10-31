# A Run is identified by train number + service date, across Sources

Some Catalan regionals appear in both the Cercanías and the LD feeds, and the visor uses its own codes. We therefore identify a Run by train number + service date, never by a feed's `tripId`.

Sightings from different Sources for the same Run are merged into one Run, and each Sighting keeps its Source.
