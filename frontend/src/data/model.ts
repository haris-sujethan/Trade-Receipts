/**
 * The rug model's own numbers, as the backend measured them (SPEC.md 7.8, and the backend session's Nov 2 results).
 * Fair AUC ranks rugs above non-rugs within the same mode and age; 0.5 is a coin flip.
 */
export const modelFacts = {
  /** pump.fun launches pulled for May 11–16, 2026 (Aug 12 and Sep 15 were pulled for the later checks). */
  launches: 41956,
  trainTokens: 7849,
  trainSnapshots: 20848,
  tuneTokens: 2001,
  testTokens: 854,
  testSnapshots: 2210,
  signals: 81,
  /** Fair AUC on May 16, the held-out test day. Glimmer's is on 300 snapshots, the others on every snapshot. */
  auc: { trees: 0.71, glimmer: 0.74, checklist: 0.44 },
};
