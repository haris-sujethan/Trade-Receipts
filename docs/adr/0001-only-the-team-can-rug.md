# Only the team can rug

A token is labeled rugged only when its team (the creator plus wallets linked to it, and likely-team wallets that sell alongside it) sells at least half of its peak holdings into buyers and the price falls at least 90% from its peak within the label window. Collapses caused by unlinked snipers are labeled faded, even though buyers lose money in them. Counting sniper dumps as rugs would teach the model to spot early bots, which are on almost every launch, instead of a team selling into its own buyers, which is the scam the rug check exists to catch. Sniper activity stays as a signal.

## Consequences

- Every label, the training data, and the model's receipt depend on this definition; changing it means relabeling and retraining.
- The starting thresholds (half of peak holdings, a 90% fall) are tuned on a development split and frozen before the final test.
- The label window is 24 hours, set from the data (Oct 31): 99.2% of rugs in the May launches landed within a day.
- On the bonding curve the price can't fall below its launch price, so the 90% fall is measured above that price (the share of the rise given back). After graduation this is close to the plain fall.
