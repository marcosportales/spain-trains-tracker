# The visor feed is optional enrichment behind a flag

Renfe's undocumented visor JSON adds continuous GPS for LD trains, Rolling stock, and per-Station estimates. It has no license and no stability guarantee.

We use it only to enrich data, behind a feature flag. The app must stay fully functional on Official feeds alone.

The signed Adif API is out of scope, because it requires keys extracted from Adif's app.
