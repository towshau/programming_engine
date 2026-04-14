import { BenchmarkCard, RagBadge } from '../../components/ui/IntakeCards'
import { getMovementRag, MOVEMENT_LABELS } from '../../lib/scoring'
import type { MemberPhysicals } from '../../lib/scoring'

export function MovementBenchmarksSection({
  physicals,
}: {
  physicals: MemberPhysicals | null
}) {
  return (
    <div className="space-y-8">
      <div>
        <p
          className="text-xs font-bold uppercase tracking-wide mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Movement Screen
        </p>
        {!physicals ? (
          <div
            className="bg-white rounded-xl border p-8 text-center"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No physicals data on record for this member.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {(['squat', 'hinge', 'shoulder_flexion', 'toe_touch'] as const).map((col) => {
              const val = physicals[col]
              const rag = getMovementRag(col, val)
              return (
                <div
                  key={col}
                  className="bg-white rounded-xl border p-5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {MOVEMENT_LABELS[col]}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {val ?? '—'}
                    </span>
                    <RagBadge
                      rag={rag}
                      label={
                        rag === 'green'
                          ? 'Good range'
                          : rag === 'amber'
                            ? 'Limited range'
                            : rag === 'red'
                              ? 'Restricted'
                              : 'No data'
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <p
          className="text-xs font-bold uppercase tracking-wide mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Benchmarks
        </p>
        <div className="grid grid-cols-3 gap-4">
          <BenchmarkCard
            label="Grip Strength"
            value={physicals?.grip_strength_value ?? null}
            unit="kg"
            field="grip_strength"
            sub={
              physicals?.grip_strength_left != null
                ? `L: ${physicals.grip_strength_left}kg · R: ${physicals.grip_strength_right}kg`
                : undefined
            }
          />
          <BenchmarkCard
            label="Chin-over-bar Hold"
            value={physicals?.chin_hold_value ?? null}
            unit="sec"
            field="chin_hold"
            sub="Upper body pulling capacity"
          />
          <BenchmarkCard
            label="Vertical Jump"
            value={physicals?.vertical_jump_value ?? null}
            unit="cm"
            field="vertical_jump"
            sub="Power benchmark"
          />
          <BenchmarkCard
            label="RSI"
            value={physicals?.rsi_value ?? null}
            unit=""
            field="rsi"
            sub="Reactive strength index"
          />
          <BenchmarkCard
            label={
              physicals?.picked_cardio === 'bike' ? 'Bike Test (avg watts)' : 'VO₂ Max'
            }
            value={
              physicals?.picked_cardio === 'bike'
                ? (physicals.bike_test_avg_watt ?? null)
                : (physicals?.vo2_value ?? null)
            }
            unit={physicals?.picked_cardio === 'bike' ? 'W' : 'mL/kg/min'}
            field="vo2"
            sub="Cardiorespiratory fitness"
          />
          <BenchmarkCard
            label="Push-up Max"
            value={physicals?.push_ups_value ?? null}
            unit="reps"
            field="push_ups"
            sub="Upper body strength endurance"
          />
        </div>
      </div>
    </div>
  )
}
