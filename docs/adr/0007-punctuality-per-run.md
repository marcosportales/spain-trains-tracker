# Punctuality counts Runs, not Delay observations

Punctuality used to be the share of Delay observations at most 5 min late. A Run reporting every 30 s for three hours weighed hundreds of times more than a short Cercanías hop, and the figure could not be phrased as anything a traveller understands. The redesign's headline ("el 87 % de los trenes llegó a destino con menos de 5 min de retraso") needs a figure that counts trains.

Punctuality is now the share of **Runs** on a Line, over a period, that were **On time** (Delay under 5 min) at their destination. Each Run counts once, by its **final Delay**: the last Delay observed for that Run. The last observation is the closest data to its arrival, and the feeds give no explicit arrival event. Cancelled Runs are left out, since they never arrive. The average Delay shown beside it is the mean of final Delays.

The by-hour chart keeps pooling Delay observations by hour of day. It answers a different question ("when do trains run late?"), for which time spent late is the right weight.

## Alternatives rejected

- **Keep per-observation figures and reword the headline.** That is honest but unintuitive ("el 87 % del tiempo…"), and it is the bar the redesign set out to meet.
- **Delay at the destination Station only.** Many Runs stop reporting before the terminus, so this would drop a large and biased share of Runs. The last observation covers every Run that was seen.
- **Count cancellations as not On time.** This is defensible, but it mixes two questions; cancellations can get their own figure later.

## Consequences

- The `LinePunctuality` contract changes meaning and shape: it gains `runs`, and `onTimePct` / `avgSeconds` are per Run. This is a breaking change for its consumer, the Punctuality page.
- The **On time** threshold changes from ≤ 300 s to < 300 s, matching `GLOSSARY.md`.
- A Run still in progress counts with its latest Delay. The figure for the current day is therefore provisional.
