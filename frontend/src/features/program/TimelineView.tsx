import { useMemo } from 'react'
import type { GeneratedProgram, MemberHold } from '../../types'

interface TimelineViewProps {
  pastPrograms: GeneratedProgram[]
  currentProgram: GeneratedProgram | null
  subsequentPrograms: GeneratedProgram[]
  holidayPrograms: GeneratedProgram[]
  memberHolds: MemberHold[]
}

const PX_PER_DAY = 15
const DAYS_BACK = 60
const DAYS_FORWARD = 120
const TOTAL_DAYS = DAYS_BACK + DAYS_FORWARD

export function TimelineView({
  pastPrograms,
  currentProgram,
  subsequentPrograms,
  holidayPrograms,
  memberHolds,
}: TimelineViewProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const startDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - DAYS_BACK)
    return d
  }, [today])

  const endDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + DAYS_FORWARD)
    return d
  }, [today])

  const totalWidth = TOTAL_DAYS * PX_PER_DAY

  function getPosition(startStr: string | null, endStr: string | null, durationWeeks: number, fallbackStartStr?: string) {
    let start = startStr ? new Date(startStr) : (fallbackStartStr ? new Date(fallbackStartStr) : new Date())
    start.setHours(0, 0, 0, 0)
    
    let end = endStr ? new Date(endStr) : new Date(start)
    if (!endStr) {
      end.setDate(start.getDate() + durationWeeks * 7)
    }
    end.setHours(0, 0, 0, 0)

    const leftDays = (start.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const widthDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)

    return {
      left: `${leftDays * PX_PER_DAY}px`,
      width: `${Math.max(widthDays, 1) * PX_PER_DAY}px`, // Minimum 1 day width
      rawStart: start,
      rawEnd: end,
    }
  }

  const months = useMemo(() => {
    const m = []
    let curr = new Date(startDate)
    curr.setDate(1) // Start of month
    while (curr < endDate) {
      const monthEnd = new Date(curr.getFullYear(), curr.getMonth() + 1, 0)
      const startDraw = curr < startDate ? startDate : curr
      const endDraw = monthEnd > endDate ? endDate : monthEnd
      const days = (endDraw.getTime() - startDraw.getTime()) / (1000 * 60 * 60 * 24) + 1
      
      const leftDays = (startDraw.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      
      m.push({
        label: curr.toLocaleString('default', { month: 'short', year: 'numeric' }),
        left: `${leftDays * PX_PER_DAY}px`,
        width: `${days * PX_PER_DAY}px`,
      })
      curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1)
    }
    return m
  }, [startDate, endDate])

  const todayLeft = DAYS_BACK * PX_PER_DAY

  const renderProgramBlock = (prog: GeneratedProgram, type: 'past' | 'current' | 'future') => {
    const pos = getPosition(prog.start_date, prog.end_date, prog.duration_weeks, prog.created_at)
    
    // Don't render if completely outside the view
    if (pos.rawEnd < startDate || pos.rawStart > endDate) return null

    let bg = 'var(--bg3)'
    let border = 'var(--border)'
    let text = 'var(--text-muted)'

    if (type === 'current') {
      bg = 'rgba(184,134,11,0.1)'
      border = 'var(--color-gold)'
      text = 'var(--color-gold)'
    } else if (type === 'future') {
      bg = 'rgba(139,92,246,0.1)'
      border = '#c4b5fd'
      text = '#7c3aed'
    }

    return (
      <div
        key={prog.id}
        className="absolute top-0 bottom-0 rounded-md border flex flex-col justify-center px-2 overflow-hidden cursor-default transition-colors hover:opacity-90"
        style={{
          left: pos.left,
          width: pos.width,
          background: bg,
          borderColor: border,
        }}
        title={`${prog.scheme_name || 'GPP'} (${prog.rep_range || '?'})\n${pos.rawStart.toLocaleDateString('en-AU')} - ${pos.rawEnd.toLocaleDateString('en-AU')}`}
      >
        <span className="text-xs font-semibold truncate" style={{ color: text }}>
          {prog.scheme_name || 'GPP'}
        </span>
        <span className="text-[10px] truncate opacity-80" style={{ color: text }}>
          {prog.rep_range || '?'} reps
        </span>
      </div>
    )
  }

  const renderHolidayBlock = (prog: GeneratedProgram) => {
    const pos = getPosition(prog.holiday_start_date, prog.holiday_end_date, prog.duration_weeks, prog.created_at)
    if (pos.rawEnd < startDate || pos.rawStart > endDate) return null

    return (
      <div
        key={prog.id}
        className="absolute top-0 bottom-0 rounded-md border border-blue-200 bg-blue-50 flex items-center justify-center overflow-hidden"
        style={{
          left: pos.left,
          width: pos.width,
        }}
        title={`Holiday Program\n${pos.rawStart.toLocaleDateString('en-AU')} - ${pos.rawEnd.toLocaleDateString('en-AU')}`}
      >
        <span className="text-[10px] font-semibold text-blue-600 truncate px-1">
          Holiday
        </span>
      </div>
    )
  }

  const renderHoldBlock = (hold: MemberHold) => {
    const pos = getPosition(hold.hold_start, hold.hold_end, 0)
    if (pos.rawEnd < startDate || pos.rawStart > endDate) return null

    return (
      <div
        key={hold.id}
        className="absolute top-0 bottom-0 rounded-md flex items-center justify-center overflow-hidden"
        style={{
          left: pos.left,
          width: pos.width,
          background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.02), rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px)',
          border: '1px solid rgba(0,0,0,0.1)',
        }}
        title={`Hold: ${hold.travel_programming_notes || 'No notes'}\n${pos.rawStart.toLocaleDateString('en-AU')} - ${pos.rawEnd.toLocaleDateString('en-AU')}`}
      >
        <span className="text-[10px] font-medium text-gray-500 truncate px-1 bg-white/50 rounded backdrop-blur-sm">
          Hold
        </span>
      </div>
    )
  }

  // Scroll to 'today' marker on mount
  const scrollRef = (node: HTMLDivElement | null) => {
    if (node && node.scrollLeft === 0) {
      // Center 'today' in the view
      const clientWidth = node.clientWidth
      node.scrollLeft = Math.max(0, todayLeft - clientWidth / 2)
    }
  }

  return (
    <div className="w-full bg-white rounded-xl border flex flex-col" style={{ borderColor: 'var(--border)' }}>
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Program Timeline</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>6-month rolling view</p>
      </div>
      
      <div 
        className="relative overflow-x-auto overflow-y-hidden"
        ref={scrollRef}
        style={{ height: '240px' }}
      >
        <div className="absolute top-0 bottom-0" style={{ width: `${totalWidth}px` }}>
          
          {/* Months header */}
          <div className="absolute top-0 left-0 right-0 h-8 border-b flex" style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}>
            {months.map((m, i) => (
              <div 
                key={i} 
                className="absolute top-0 bottom-0 border-r px-2 py-1 text-[10px] font-medium uppercase tracking-wider"
                style={{ left: m.left, width: m.width, borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Today line */}
          <div 
            className="absolute top-8 bottom-0 border-l-2 border-dashed z-10 pointer-events-none"
            style={{ left: `${todayLeft}px`, borderColor: 'var(--color-gold)' }}
          >
            <div className="absolute -left-3 top-2 bg-[var(--color-gold)] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
              Today
            </div>
          </div>

          {/* Main Programs Track */}
          <div className="absolute top-12 h-16 left-0 right-0">
            {pastPrograms.map(p => renderProgramBlock(p, 'past'))}
            {currentProgram && renderProgramBlock(currentProgram, 'current')}
            {subsequentPrograms.map(p => renderProgramBlock(p, 'future'))}
          </div>

          {/* Holiday Programs Track */}
          <div className="absolute top-32 h-8 left-0 right-0">
            {holidayPrograms.map(p => renderHolidayBlock(p))}
          </div>

          {/* Holds Track */}
          <div className="absolute top-44 h-8 left-0 right-0">
            {memberHolds.map(h => renderHoldBlock(h))}
          </div>

        </div>
      </div>
    </div>
  )
}
