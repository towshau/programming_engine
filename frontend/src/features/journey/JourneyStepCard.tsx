import { useState } from 'react'
import type { ClientJourneyStep } from '../../types/journey'
import { Badge } from '../../components/ui/Badge'
import { useJourneyStore } from '../../stores/journeyStore'
import { JourneyStepEditor } from './JourneyStepEditor'

export function JourneyStepCard({ step }: { step: ClientJourneyStep }) {
  const { editMode } = useJourneyStore()
  const [isEditing, setIsEditing] = useState(false)

  // Icons for link types
  const getLinkIcon = (type: string) => {
    switch (type) {
      case 'retool': return '📋'
      case 'canva': return '🎨'
      case 'whatsapp': return '💬'
      case 'jotform': return '📝'
      default: return '🔗'
    }
  }

  return (
    <>
      <div 
        className="flex flex-col flex-shrink-0 w-[280px] h-[340px] rounded-xl border bg-white overflow-hidden shadow-sm relative group"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div 
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)', backgroundColor: step.color || 'var(--bg3)' }}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-[var(--color-gold)] bg-[var(--color-gold-50)] border border-[var(--color-gold-100)] flex-shrink-0">
            {step.step_number}
          </div>
          <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }} title={step.title}>
            {step.title}
          </h3>

          {/* Edit Button overlay */}
          {editMode && (
            <button 
              onClick={() => setIsEditing(true)}
              className="absolute top-3 right-3 p-1.5 rounded-md bg-white border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
              style={{ borderColor: 'var(--border)' }}
              title="Edit Step"
            >
              <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          
          {/* Role */}
          {step.assigned_role && (
            <div className="pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] uppercase font-bold tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Assigned
              </div>
              <Badge variant="blue" className="w-full justify-center text-center font-semibold h-auto py-1">
                <span className="whitespace-normal leading-tight">{step.assigned_role}</span>
              </Badge>
            </div>
          )}

          {/* Actions */}
          {step.actions && step.actions.length > 0 && (
            <ul className="space-y-2">
              {step.actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-[var(--color-gold)] mt-0.5 flex-shrink-0">
                    {action.category === 'note' ? '→' : '•'}
                  </span>
                  <span 
                    style={{ color: action.category === 'note' ? 'var(--text-muted)' : 'var(--text)' }}
                    className={action.category === 'note' ? 'italic' : ''}
                  >
                    {action.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer Links */}
        {step.forms_links && step.forms_links.length > 0 && (
          <div className="p-3 border-t bg-[var(--bg3)] flex flex-wrap gap-2" style={{ borderColor: 'var(--border)' }}>
            {step.forms_links.map((link, idx) => (
              <a 
                key={idx} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border transition-colors hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                style={{ backgroundColor: 'white', borderColor: 'var(--border)', color: 'var(--text)' }}
                title={link.url}
              >
                <span>{getLinkIcon(link.type)}</span>
                <span className="truncate max-w-[180px]">{link.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {isEditing && <JourneyStepEditor step={step} onClose={() => setIsEditing(false)} />}
    </>
  )
}
