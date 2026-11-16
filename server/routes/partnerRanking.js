import express from 'express';
import { verifyToken, verifyAdmin, verifyDeliveryPartner } from '../middleware/auth.js';
import { loadWeeklyRanking, summariseForPartner } from '../services/partnerWeeklyRank.js';

/**
 * Weekly partner leaderboard endpoints.
 *
 * Two consumers with different needs: the desk wants the whole board
 * (`/api/admin/partner-weekly-ranks`), and a partner wants to know where they
 * stand and why, not how everyone else is paid (`/api/delivery-partner/rank/current`
 * returns their own row only). A partner reading other partners' ranks would be
 * a privacy leak dressed as a feature, and the numbers behind a queue decision
 * are not public data.
 *
 * `week` accepts an ISO label (2026-W47) so the desk can review a past week
 * after it has closed; an impossible label is a 400 that says what the year's
 * real last week is, because otherwise a typo looks like a quiet empty week.
 */
const router = express.Router();

const readWindow = (req) => {
  const week = String(req.query.week ?? '').trim();
  const offset = Number(process.env.PARTNER_RANK_TZ_OFFSET_MINUTES ?? 330);
  return Number.isFinite(offset) ? week : undefined;
};

router.get('/admin/partner-weekly-ranks', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const week = String(req.query.week ?? '').trim();
    if (week && !/^\d{4}-W\d{2}$/i.test(week)) {
      return res.status(400).json({ success: false, message: 'week must look like 2026-W47' });
    }
    const data = await loadWeeklyRanking(week ? { weekLabel: week.toUpperCase() } : {});
    res.json({
      success: true,
      week: data.window.label,
      previousWeek: data.previousWindow.label,
      windowStart: new Date(data.window.start).toISOString(),
      windowEnd: new Date(data.window.end).toISOString(),
      weights: data.weights,
      codToleranceRupe: data.toleranceRupe,
      unansweredPenalty: data.unansweredPenalty,
      rankedPartners: data.rankedCount,
      totalPartners: data.partnerCount,
      rows: data.rows.map((row) => ({
        rank: row.rank,
        /*
         * `position` and `excludedFromLeaderboard` are not decoration. The
         * difference between "ranked 4th" and "not ranked, listed 4th" is the
         * whole content of the leaderboard's honesty claim, and a client can
         * only render that difference if the API sends it. Dropping them here
         * is how a projection quietly turns an exclusion back into a rank.
         */
        position: row.position, of: row.of,
        excludedFromLeaderboard: row.excludedFromLeaderboard === true,
        rankLabel: row.rankLabel || null,
        partner: row.partner, partnerId: row.partnerId,
        score: row.score, components: row.components, dataQuality: row.dataQuality,
        notes: row.notes, isNewEntrant: row.isNewEntrant,
        previousRank: row.previousRank, rankDelta: row.rankDelta,
        measured: {
          completedRuns: row.events.completed, rejections: row.events.rejections,
          expiredOffers: row.events.expiries, unanswered: row.events.unanswered,
          cancellationsWhileAssigned: row.events.cancellationsWhileAssigned,
          cashDeliveries: row.events.codDeliveries,
          cashChecked: row.events.codChecked,
          cashDiscrepancies: row.events.codDiscrepancies,
          cashUnrecorded: row.events.codUnrecorded
        },
        weightsApplied: row.weightsApplied, missingComponents: row.missingComponents
      }))
    });
  } catch (error) {
    if (error instanceof RangeError) return res.status(400).json({ success: false, message: error.message });
    console.error('Weekly partner ranking error:', error.message.slice(0, 200));
    res.status(500).json({ success: false, message: 'The weekly ranking could not be built.' });
  }
});

router.get('/delivery-partner/rank/current', verifyDeliveryPartner, async (req, res) => {
  try {
    const data = await loadWeeklyRanking({});
    const own = summariseForPartner(data.rows, req.partner._id);
    res.json({
      success: true,
      week: data.window.label,
      previousWeek: data.previousWindow.label,
      weights: data.weights,
      leaderboard: own.found && typeof own.rank === 'number'
        ? { rank: own.rank, of: own.of, percentile: own.percentile }
        : null,
      own,
      message: own.found ? undefined : 'Your week starts counting from your first completed run.'
    });
  } catch (error) {
    console.error('Partner self ranking error:', error.message.slice(0, 200));
    res.status(500).json({ success: false, message: 'Your weekly standing could not be read.' });
  }
});

export default router;
