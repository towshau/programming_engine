import { useJourneyStore } from '../../stores/journeyStore'
import { JourneyStepCard } from './JourneyStepCard'

export function JourneyPipeline({ journeyId }: { journeyId: string }) {
  const { templates, steps } = useJourneyStore()
  
  const journey = templates.find(t => t.id === journeyId)
  const journeySteps = steps
    .filter(s => s.journey_id === journeyId)
    .sort((a, b) => a.step_number - b.step_number)

  if (!journey) return null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4 px-1">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          {journey.name}
        </h2>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-[var(--bg3)] border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          {journeySteps.length} Steps
        </span>
      </div>

      <div className="relative">
        <div 
          className="flex gap-8 overflow-x-auto pb-6 pt-2 px-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin' }}
        >
          {journeySteps.map((step, index) => (
            <div key={step.id} className="relative flex items-center snap-start">
              <JourneyStepCard step={step} />
              
              {/* Connector arrow */}
              {index < journeySteps.length - 1 && (
                <div className="absolute right-[-32px] w-8 flex items-center justify-center pointer-events-none z-10 text-gray-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              )}
            </div>
          ))}

          {journeySteps.length === 0 && (
            <div className="p-8 text-center text-sm italic rounded-xl border border-dashed w-full" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
              No steps found for this journey.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
