import { useEffect } from 'react'
import { useJourneyStore } from '../stores/journeyStore'
import { JourneyFilters } from '../features/journey/JourneyFilters'
import { JourneyPipeline } from '../features/journey/JourneyPipeline'
import { JourneyChangelog } from '../features/journey/JourneyChangelog'
import { JourneyTimeline } from '../features/journey/JourneyTimeline'

export function ClientJourneyPage() {
  const {
    fetchJourneys,
    loading,
    error,
    templates,
    selectedLocation,
    selectedType,
    headerCollapsed,
    toggleHeader,
  } = useJourneyStore()

  useEffect(() => {
    fetchJourneys()
  }, [fetchJourneys])

  const filteredTemplates = templates.filter(t => {
    if (selectedLocation !== 'All' && t.location !== selectedLocation) return false
    if (selectedType !== 'All' && t.journey_type !== selectedType) return false
    return true
  })

  return (
    <div className="h-full flex overflow-hidden bg-[var(--bg)]">

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">

        {/* Top header bar */}
        <div
          className="bg-white rounded-xl border shadow-sm mb-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold whitespace-nowrap" style={{ color: 'var(--text)' }}>
                Client Journey
              </h1>
              <JourneyFilters />
            </div>
          </div>
        </div>

        {/* Timeline section */}
        {!loading && !error && filteredTemplates.length > 0 && (
          <JourneyTimeline templates={filteredTemplates} />
        )}

        {/* Pipeline cards */}
        <div
          className="bg-white rounded-xl border shadow-sm p-6 flex-1 flex flex-col"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-gold)] mr-3" />
                Loading journeys...
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
                Failed to load journeys: {error}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="font-medium">No journeys found</p>
                <p className="text-sm mt-1">Try adjusting your filters to see more results.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {filteredTemplates.map(template => (
                  <JourneyPipeline key={template.id} journeyId={template.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Changelog */}
      <JourneyChangelog />

    </div>
  )
}
