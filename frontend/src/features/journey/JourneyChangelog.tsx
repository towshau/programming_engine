import { useState } from 'react'
import { useJourneyStore } from '../../stores/journeyStore'
import type { ClientJourneyChangelog } from '../../types/journey'

export function JourneyChangelog() {
  const { changelog, steps, templates } = useJourneyStore()
  const [isOpen, setIsOpen] = useState(true)

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-white border-l border-y px-2 py-4 rounded-l-xl shadow-md flex items-center justify-center transition-transform hover:-translate-x-1"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="vertical-text text-sm font-bold tracking-widest text-[var(--color-gold)]">
          CHANGELOG
        </span>
      </button>
    )
  }

  // Group changelog by day, then by step + changed_by
  const groupedChangelog = changelog.reduce((acc, log) => {
    const date = new Date(log.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    let dateStr = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    if (date.toDateString() === today.toDateString()) dateStr = 'Today'
    else if (date.toDateString() === yesterday.toDateString()) dateStr = 'Yesterday'

    if (!acc[dateStr]) acc[dateStr] = {}
    
    const stepKey = `${log.step_id || 'unknown'}_${log.changed_by}`
    if (!acc[dateStr][stepKey]) acc[dateStr][stepKey] = []
    
    acc[dateStr][stepKey].push(log)
    return acc
  }, {} as Record<string, Record<string, ClientJourneyChangelog[]>>)

  return (
    <div 
      className="w-[320px] flex-shrink-0 flex flex-col bg-white border-l h-full shadow-sm"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="p-4 border-b flex items-center justify-between bg-[var(--bg3)]" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-bold text-[var(--text)] flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Changelog
        </h2>
        <button 
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-md hover:bg-gray-200 text-gray-500"
          title="Collapse Changelog"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {changelog.length === 0 ? (
          <p className="text-sm italic text-center mt-10" style={{ color: 'var(--text-muted)' }}>
            No edits recorded yet.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedChangelog).map(([dateStr, stepGroups]) => (
              <div key={dateStr} className="mb-6">
                {/* Day Header */}
                <div className="sticky top-0 z-10 bg-white py-1.5 mb-3 border-b border-dashed" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {dateStr}
                  </h3>
                </div>
                
                {/* Step Groups for the day */}
                <div className="space-y-4">
                  {Object.entries(stepGroups).map(([stepKey, logs]) => {
                    const firstLog = logs[0]
                    const step = steps.find(s => s.id === firstLog.step_id)
                    const template = templates.find(t => t.id === firstLog.journey_id)
                    
                    return (
                      <div key={stepKey} className="bg-[var(--bg2)] rounded-lg p-3 border shadow-sm" style={{ borderColor: 'var(--border)' }}>
                        {/* Step Header */}
                        <div className="flex flex-col gap-0.5 mb-3 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex items-start justify-between">
                            <div className="font-semibold text-sm text-[var(--text)]">
                              📍 {step?.title || 'General Journey Edit'}
                            </div>
                            <div className="text-[10px] bg-[var(--bg3)] px-1.5 py-0.5 rounded text-[var(--text-muted)] whitespace-nowrap border" style={{ borderColor: 'var(--border)' }}>
                              {logs.length} change{logs.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] mt-1">
                            <span>in</span>
                            <span className="font-medium max-w-[120px] truncate" title={template?.name}>{template?.name || 'Unknown Journey'}</span>
                            <span className="mx-1">•</span>
                            <span>by <span className="font-medium">{firstLog.changed_by}</span></span>
                          </div>
                        </div>
                        
                        {/* List of changes */}
                        <ul className="space-y-2.5">
                          {logs.map(log => (
                            <li key={log.id} className="flex flex-col gap-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-xs font-medium text-[var(--text)] flex items-start gap-1.5">
                                  <span className="text-[var(--color-gold)] mt-0.5">•</span>
                                  <span>{log.notes || `Updated ${log.field_changed}`}</span>
                                </div>
                                <span className="text-[10px] text-[var(--text-muted)] mt-0.5 whitespace-nowrap">
                                  {new Date(log.created_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                              
                              {/* Diff details if available */}
                              {log.field_changed && !log.notes?.startsWith('Corrected') && (
                                <div className="ml-3 pl-2 border-l-2 py-0.5" style={{ borderColor: 'var(--border)' }}>
                                  <div className="flex items-center gap-1.5 opacity-80 flex-wrap text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    <span className="line-through truncate max-w-[90px]" title={JSON.stringify(log.old_value)}>
                                      {JSON.stringify(log.old_value) || 'empty'}
                                    </span>
                                    <span>→</span>
                                    <span className="text-[var(--green)] font-medium truncate max-w-[90px]" title={JSON.stringify(log.new_value)}>
                                      {JSON.stringify(log.new_value)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* CSS for vertical text */}
      <style>{`
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
        }
      `}</style>
    </div>
  )
}
