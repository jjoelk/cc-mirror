/**
 * Consensus calculation for multiple worker verdicts
 */

import type { WorkerVerdict, ConsensusResult, Verdict } from './types.js';

/**
 * Calculate consensus from multiple worker verdicts
 */
export function calculateConsensus(verdicts: WorkerVerdict[]): ConsensusResult {
  if (verdicts.length === 0) {
    return {
      finalVerdict: 'mixed',
      confidence: 0,
      agreement: 0,
      summary: 'No worker verdicts available',
      allConcerns: [],
      allRecommendations: [],
      dissenting: [],
    };
  }

  // Count verdicts by type
  const counts: Record<Verdict, number> = {
    approve: 0,
    reject: 0,
    concern: 0,
    neutral: 0,
  };

  for (const v of verdicts) {
    if (v.verdict in counts) {
      counts[v.verdict]++;
    }
  }

  // Determine final verdict
  let finalVerdict: ConsensusResult['finalVerdict'];

  // Any reject triggers overall rejection (unless significantly outvoted)
  if (counts.reject > 0 && counts.reject >= counts.approve) {
    finalVerdict = 'reject';
  } else if (counts.approve > counts.concern + counts.reject) {
    finalVerdict = 'approve';
  } else if (counts.concern > 0 || counts.reject > 0) {
    finalVerdict = 'concern';
  } else {
    finalVerdict = 'mixed';
  }

  // Calculate agreement percentage
  const maxCount = Math.max(...Object.values(counts));
  const agreement = Math.round((maxCount / verdicts.length) * 100);

  // Calculate weighted confidence
  const avgConfidence = verdicts.reduce((sum, v) => sum + v.confidence, 0) / verdicts.length;
  const confidence = Math.round(avgConfidence * (agreement / 100));

  // Aggregate concerns and recommendations (dedupe)
  const allConcerns = [...new Set(verdicts.flatMap((v) => v.concerns))];
  const allRecommendations = [...new Set(verdicts.flatMap((v) => v.recommendations))];

  // Find dissenting verdicts (those that don't match the final verdict)
  const dissenting = verdicts.filter((v) => {
    if (finalVerdict === 'approve') return v.verdict !== 'approve';
    if (finalVerdict === 'reject') return v.verdict !== 'reject';
    if (finalVerdict === 'concern') return v.verdict !== 'concern' && v.verdict !== 'reject';
    return false;
  });

  // Generate summary
  const summaryParts: string[] = [];

  if (verdicts.length === 1) {
    summaryParts.push(`Single worker analysis: ${finalVerdict.toUpperCase()}.`);
  } else {
    summaryParts.push(`${verdicts.length} workers analyzed this session.`);
    if (agreement === 100) {
      summaryParts.push(`Unanimous verdict: ${finalVerdict.toUpperCase()}.`);
    } else {
      summaryParts.push(`${agreement}% agreement on verdict: ${finalVerdict.toUpperCase()}.`);
    }
  }

  if (allConcerns.length > 0) {
    summaryParts.push(`${allConcerns.length} concern${allConcerns.length > 1 ? 's' : ''} raised.`);
  }

  return {
    finalVerdict,
    confidence,
    agreement,
    summary: summaryParts.join(' '),
    allConcerns,
    allRecommendations,
    dissenting,
  };
}
