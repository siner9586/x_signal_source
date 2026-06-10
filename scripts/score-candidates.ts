// Candidate scoring module boundary.
// Runtime entrypoint: node scripts/pipeline.mjs score
// Total score = source 20% + density 20% + originality 15% + trend 15% + evidence 10% + heat 10% + site fit 10%.
export const command = 'score-candidates';
export const weights = {
  source_score: 0.20,
  information_density_score: 0.20,
  originality_score: 0.15,
  trend_score: 0.15,
  evidence_score: 0.10,
  heat_score: 0.10,
  site_fit_score: 0.10
};
