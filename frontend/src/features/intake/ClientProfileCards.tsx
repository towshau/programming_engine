import { FormField } from '../../components/ui/IntakeCards'
import type { MemberProfile } from '../../lib/intakeTypes'
import type { MemberPhysicals, HealthMetrics } from '../../lib/scoring'

export function ClientProfileCards({
  profile,
  physicals,
  health,
  physicalsFormDate,
}: {
  profile: MemberProfile | null
  physicals: MemberPhysicals | null
  health: HealthMetrics | null
  physicalsFormDate: string | null
}) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <div
        className="bg-white rounded-xl border p-5"
        style={{ borderColor: 'var(--border)' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wide mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          Membership & Logistics
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <FormField label="Primary membership" value={profile?.primary_membership} />
          <FormField
            label="Secondary membership"
            value={
              profile?.secondary_memberships.length
                ? profile.secondary_memberships.join(', ')
                : null
            }
          />
        </div>
        <FormField label="Gym" value={profile?.gym_string} />
        <FormField label="Status" value={profile?.current_status} />
        <FormField
          label="Next due date"
          value={
            profile?.end_date
              ? new Date(profile.end_date).toLocaleDateString('en-AU')
              : null
          }
        />
      </div>

      <div
        className="bg-white rounded-xl border p-5"
        style={{ borderColor: 'var(--border)' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wide mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          Health Screening
        </p>
        <FormField label="Previous injuries" value={profile?.injuries} />
        <FormField label="Goals" value={profile?.goals} />
        <FormField label="Focus program" value={physicals?.focus_program} />
        <FormField label="Exercises to avoid" value={physicals?.exercise_avoid} />
      </div>

      <div
        className="bg-white rounded-xl border p-5"
        style={{ borderColor: 'var(--border)' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wide mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          Body Composition (Latest Scan)
        </p>
        <FormField label="Weight" value={health?.weight ? `${health.weight} kg` : null} />
        <FormField label="Body fat %" value={health?.bf ? `${health.bf}%` : null} />
        <FormField label="Muscle mass" value={health?.smm ? `${health.smm} kg` : null} />
        <FormField
          label="InBody score"
          value={health?.inbody_score ? `${health.inbody_score}` : null}
        />
        <FormField
          label="Scan date"
          value={
            health?.date_created
              ? new Date(health.date_created).toLocaleDateString('en-AU')
              : null
          }
        />
      </div>

      <div
        className="bg-white rounded-xl border p-5"
        style={{ borderColor: 'var(--border)' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wide mb-4"
          style={{ color: 'var(--text-muted)' }}
        >
          Assessment Date
        </p>
        <FormField
          label="Physicals date"
          value={
            physicalsFormDate
              ? new Date(physicalsFormDate).toLocaleDateString('en-AU')
              : null
          }
        />
        <FormField label="Cardio test" value={physicals?.picked_cardio} />
      </div>
    </div>
  )
}
