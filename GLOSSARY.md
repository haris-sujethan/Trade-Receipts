# Trade Receipts

An agent-native IDE for financial research and automated backtesting. Its main feature, the rug check, scores new pump.fun tokens for the chance that their team rugs.

## Rug check

**Token**:
A crypto asset launched on pump.fun, the thing the rug check scores.
_Avoid_: coin, memecoin

**Mint**:
The on-chain address that identifies a token.
_Avoid_: contract, CA, token address

**Creator**:
The wallet that launched the token.
_Avoid_: dev, deployer

**Team**:
The creator plus every wallet linked to it: funded by the creator or the same funder within two hops, sending tokens or SOL to or from the creator's wallets, or buying in the creator's launch bundle.
_Avoid_: dev, devs, insiders

**Likely team**:
Wallets funded from the same exchange with the same amount within minutes of each other, with no on-chain link to the team. They count as team for a rug only when they also sell alongside the team.

**Sniper**:
A wallet outside the team that buys in the first seconds after launch.
_Avoid_: insider

**Independent buyer**:
A buyer who isn't team, likely team, a sniper or a wash trader, and whose wallet has its own history or outside funding.
_Avoid_: real buyer, organic buyer

**Bonding curve**:
pump.fun's launch stage, where a token trades against pump.fun itself until it graduates.

**Graduate**:
To leave the bonding curve for the token's own trading pool.
_Avoid_: migrate, bond

**Rug**:
The team selling most of its holdings into buyers while the price collapses, at any stage of the token. Only the team can rug.
_Avoid_: soft rug, hard rug, dump (when the seller isn't known)

**Faded**:
A token whose trading died out without a rug, including collapses caused by snipers.
_Avoid_: dead, rugged (for these)

**Survived**:
A token still trading at the end of the label window without collapsing.

**Label window**:
The time after launch in which a rug counts toward a token's label (24 hours); a rug after it doesn't.

**Snapshot**:
A token as it stood at a fixed age after launch, built only from what had happened by then. A token is scored only from snapshots taken before any rug, and only within its first day.

**Rug chance**:
The model's probability that the team rugs within the label window, as of when the token is checked.
_Avoid_: risk score, rug score

**Verdict**:
The word that leads a token's report, Likely rug, Possible rug or Unlikely rug, shown with the rug chance. It never says safe.

**Token Facts**:
The label that closes a token's report as its receipt.
_Avoid_: Coin Facts

**Already rugged**:
The verdict for a token whose team has rugged by the time it's checked, shown instead of a rug chance.

**Activity floor**:
The minimum activity a token needs before it's scored; below it, the rug check says there's too little activity to score.
