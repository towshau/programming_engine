/**
 * Coach-facing copy for the Churn Risk "Model Explanation" panel.
 * Source: Lockeroom churn pipeline (Supabase + n8n). Weights are reviewed over time.
 */

export const MODEL_SIGNALS_DISCLAIMER =
  'Signal weights and caps are reviewed over time (roughly quarterly, from outcome data). The nine dimensions below describe what feeds the score; exact weightings change as we calibrate.'

export const NINE_SIGNALS: { name: string; description: string }[] = [
  { name: 'Attendance ratio', description: 'Sessions attended vs sessions allocated in the last 4 weeks.' },
  { name: 'Days since last visit', description: 'How long since they physically came into the gym.' },
  { name: 'Renewal proximity', description: 'How close their membership end date is.' },
  { name: 'Late cancel / no-show rate', description: 'How often they book but do not show (last 8 weeks).' },
  { name: 'Hold frequency', description: 'How often they pause their membership over a year.' },
  { name: 'Body scan recency', description: 'How recently they completed an InBody scan.' },
  { name: 'Manager pipeline flag', description: 'Whether a manager has flagged them as a save priority.' },
  { name: 'Previous churn history', description: 'Whether they have been through a not-renewing conversation before.' },
  { name: 'New member window', description: 'Whether they are in the highest-risk first 90 days.' },
]

export const WEEKLY_CYCLE_STEPS: { label: string; body: string }[] = [
  {
    label: 'Step 1 — 11:00pm — Scoring',
    body:
      'PostgreSQL function score_member_churn_risk() runs inside Supabase. It reads each active member’s raw data — attendance, hold history, late cancels, body scan dates, renewal proximity, manager flags, and more — and calculates a risk score from 0 to 100. The member_churn_risk table is fully replaced with fresh scores. Before replacing, the previous week’s rows are copied to member_churn_risk_history so trend data is preserved. The whole process runs in a single database transaction; scoring has no external dependency.',
  },
  {
    label: 'Step 2 — 11:30pm — AI explanations',
    body:
      'An n8n workflow runs. It selects every member who scored 60 or above and does not yet have an explanation. For each, it sends risk data, attendance signals, renewal team notes, and staff context to the Claude API. Claude writes a 2–3 sentence plain-English brief explaining why that member is at risk and who should act; it is saved to member_churn_risk. Members under 60 skip this step — AI runs only where human action is warranted.',
  },
]

export const WEEKLY_CYCLE_INTRO =
  'Every Sunday night (AEST), two steps run automatically in sequence:'

export const EXCLUSIONS_TEXT =
  'Members with journey_stage = not_renewing (confirmed leaving) and test accounts are excluded. The model only scores genuinely active members where the outcome is still unknown.'

export const SELF_IMPROVE_PARAGRAPHS: string[] = [
  'When a membership reaches its end date, the actual outcome is recorded against the last risk score: renewed → actual_outcome = renewed; left → actual_outcome = churned. That is compared to predicted_outcome from scoring time.',
  'After roughly three months of outcome data, view_churn_model_accuracy summarises prediction accuracy by risk tier — what share of members the model got right in each band.',
  'That accuracy review drives manual weight changes inside the scoring function (for example, trimming dimensions that over-predict churn, or strengthening signals that missed real churn). Weights are updated deliberately — roughly quarterly once enough data exists — not by the Coach OS app.',
  'The model began with weights calibrated from first principles and industry patterns. The first major calibration is expected around July 2026 once three months of outcomes exist; after that, quarterly reviews keep scores aligned to Lockeroom’s real member behaviour.',
  'The AI explanation layer does not self-train automatically, but explanations improve indirectly: better-calibrated scores give Claude more accurate inputs, so briefs stay relevant.',
]
