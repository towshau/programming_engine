// ────────────────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────────────────

export interface MemberPhysicals {
  submission_date: string | null
  source: string | null
  squat: string | null
  hinge: string | null
  shoulder_flexion: string | null
  toe_touch: string | null
  grip_strength_value: number | null
  grip_strength_left: number | null
  grip_strength_right: number | null
  grip_strength_score: number | null
  chin_hold_value: number | null
  chin_hold_score: number | null
  vertical_jump_value: number | null
  vertical_jump_score: number | null
  rsi_value: number | null
  vo2_value: number | null
  vo2_score: number | null
  push_ups_value: number | null
  push_ups_score: number | null
  focus_program: string | null
  exercise_avoid: string | null
  picked_cardio: string | null
  bike_test_avg_watt: number | null
  run_test_meters: number | null
}

export interface HealthMetrics {
  weight: number | null
  bf: number | null
  smm: number | null
  inbody_score: number | null
  date_created: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// Movement screen labels
// ────────────────────────────────────────────────────────────────────────────

export const MOVEMENT_LABELS: Record<string, string> = {
  squat: 'Squat (ROM at Hip)',
  hinge: 'Hinge (Bodyweight Romanian)',
  shoulder_flexion: 'Shoulder Flexion (Lying Supine)',
  toe_touch: 'Toe Touch / Forward Flexion',
}

// ────────────────────────────────────────────────────────────────────────────
// RAG helpers — identical to what lived in Intake.tsx
// ────────────────────────────────────────────────────────────────────────────

export function getMovementRag(
  column: string,
  value: string | null,
): 'green' | 'amber' | 'red' | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (column === 'squat') {
    if (v === '100+' || v.startsWith('100')) return 'green'
    if (v === '60-100' || v.startsWith('60')) return 'amber'
    return 'red'
  }
  if (v === '100+' || v.startsWith('100') || v.includes('full') || v.includes('good'))
    return 'green'
  if (
    v === '60-100' ||
    v.startsWith('60') ||
    v.includes('moderate') ||
    v.includes('limited')
  )
    return 'amber'
  return 'red'
}

export function getBenchmarkRag(
  field: string,
  value: number | null,
): 'green' | 'amber' | 'red' | null {
  if (value == null) return null
  switch (field) {
    case 'grip_strength':
      return value >= 45 ? 'green' : value >= 35 ? 'amber' : 'red'
    case 'chin_hold':
      return value >= 20 ? 'green' : value >= 10 ? 'amber' : 'red'
    case 'vertical_jump':
      return value >= 40 ? 'green' : value >= 28 ? 'amber' : 'red'
    case 'rsi':
      return value >= 1.8 ? 'green' : value >= 1.2 ? 'amber' : 'red'
    case 'vo2':
      return value >= 40 ? 'green' : value >= 32 ? 'amber' : 'red'
    case 'push_ups':
      return value >= 20 ? 'green' : value >= 10 ? 'amber' : 'red'
    default:
      return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 0-100 normalisation helpers for radar chart
// ────────────────────────────────────────────────────────────────────────────

// "Green" threshold targets — the value at which a metric reaches 100%
export const BENCHMARK_TARGETS: Record<string, number> = {
  grip_strength: 45,
  chin_hold: 20,
  vertical_jump: 40,
  rsi: 1.8,
  vo2: 40,
  push_ups: 20,
}

// Normalise a raw numeric value to 0-100 against a "Green" target.
// Missing data (null) maps to 0 so it pulls the radar shape toward the center.
export function normalizeTo100(value: number | null | undefined, target: number): number {
  if (value == null) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

// Movement screen: 3-level text bands → 0 / 50 / 100
function movementRagToScore(rag: 'green' | 'amber' | 'red' | null): number {
  if (rag === 'green') return 100
  if (rag === 'amber') return 50
  return 0 // red or null
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

// ────────────────────────────────────────────────────────────────────────────
// Radar data
// ────────────────────────────────────────────────────────────────────────────

export interface RadarDataPoint {
  axis: string
  score: number
  fullMark: number
}

export function computeRadarData(p: MemberPhysicals | null): RadarDataPoint[] {
  const mobilityScore = avg([
    movementRagToScore(getMovementRag('squat', p?.squat ?? null)),
    movementRagToScore(getMovementRag('hinge', p?.hinge ?? null)),
    movementRagToScore(getMovementRag('shoulder_flexion', p?.shoulder_flexion ?? null)),
    movementRagToScore(getMovementRag('toe_touch', p?.toe_touch ?? null)),
  ])

  const strengthScore = avg([
    normalizeTo100(p?.grip_strength_value, BENCHMARK_TARGETS.grip_strength),
    normalizeTo100(p?.chin_hold_value, BENCHMARK_TARGETS.chin_hold),
    normalizeTo100(p?.push_ups_value, BENCHMARK_TARGETS.push_ups),
  ])

  const agilityScore = avg([
    normalizeTo100(p?.vertical_jump_value, BENCHMARK_TARGETS.vertical_jump),
    normalizeTo100(p?.rsi_value, BENCHMARK_TARGETS.rsi),
  ])

  // Use bike watts when that was the cardio test selected
  const cardioValue =
    p?.picked_cardio === 'bike' ? p?.bike_test_avg_watt ?? null : p?.vo2_value ?? null
  const cardioTarget = BENCHMARK_TARGETS.vo2
  const cardioScore = normalizeTo100(cardioValue, cardioTarget)

  return [
    { axis: 'Strength', score: strengthScore, fullMark: 100 },
    { axis: 'Cardio', score: cardioScore, fullMark: 100 },
    { axis: 'Mobility', score: mobilityScore, fullMark: 100 },
    { axis: 'Agility', score: agilityScore, fullMark: 100 },
    { axis: 'Bloods', score: 0, fullMark: 100 },
  ]
}

// ────────────────────────────────────────────────────────────────────────────
// Radar sub-metric breakdown
// ────────────────────────────────────────────────────────────────────────────

export interface BreakdownItem {
  label: string
  value: string | number | null | undefined
  unit: string
  rag?: 'green' | 'amber' | 'red' | null
}

export function getRadarBreakdown(p: MemberPhysicals | null): Record<string, BreakdownItem[]> {
  return {
    Strength: [
      { label: 'Grip', value: p?.grip_strength_value, unit: 'kg', rag: getBenchmarkRag('grip_strength', p?.grip_strength_value ?? null) },
      { label: 'Chin Hold', value: p?.chin_hold_value, unit: 'sec', rag: getBenchmarkRag('chin_hold', p?.chin_hold_value ?? null) },
      { label: 'Push-ups', value: p?.push_ups_value, unit: 'reps', rag: getBenchmarkRag('push_ups', p?.push_ups_value ?? null) },
    ],
    Cardio: [
      {
        label: p?.picked_cardio === 'bike' ? 'Bike' : 'VO2',
        value: p?.picked_cardio === 'bike' ? p?.bike_test_avg_watt : p?.vo2_value,
        unit: p?.picked_cardio === 'bike' ? 'W' : 'mL/kg/min',
        rag: getBenchmarkRag('vo2', p?.picked_cardio === 'bike' ? p?.bike_test_avg_watt ?? null : p?.vo2_value ?? null),
      },
    ],
    Mobility: [
      { label: 'Squat', value: p?.squat, unit: '', rag: getMovementRag('squat', p?.squat ?? null) },
      { label: 'Hinge', value: p?.hinge, unit: '', rag: getMovementRag('hinge', p?.hinge ?? null) },
      { label: 'Shoulder', value: p?.shoulder_flexion, unit: '', rag: getMovementRag('shoulder_flexion', p?.shoulder_flexion ?? null) },
      { label: 'Toe Touch', value: p?.toe_touch, unit: '', rag: getMovementRag('toe_touch', p?.toe_touch ?? null) },
    ],
    Agility: [
      { label: 'Jump', value: p?.vertical_jump_value, unit: 'cm', rag: getBenchmarkRag('vertical_jump', p?.vertical_jump_value ?? null) },
      { label: 'RSI', value: p?.rsi_value, unit: '', rag: getBenchmarkRag('rsi', p?.rsi_value ?? null) },
    ],
    Bloods: [],
  }
}
