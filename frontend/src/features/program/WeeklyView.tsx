import { useState, useMemo } from 'react'
import type { GeneratedProgram, ProgramSession, ProgramExercise, CoachEdit } from '../../types'
import { ExerciseCategoryGroup } from './ExerciseCategoryGroup'
import { AddExerciseButton } from './AddExerciseButton'
import { cn, seriesGroup, seriesSortKey } from '../../lib/utils'
import { useEditorStore } from '../../stores/editorStore'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface WeeklyViewProps {
  program: GeneratedProgram
  previousProgram: GeneratedProgram | null
  nextEditedSessions: ProgramSession[]
  lastEditedSessions: ProgramSession[]
  onDayClick: (day: number) => void
  nextEdits: CoachEdit[]
  lastEdits: CoachEdit[]
  coachId: string | null
  nextProgram?: GeneratedProgram | null
}

function groupBySeries(exercises: ProgramExercise[]) {
  const groups: Record<string, ProgramExercise[]> = {}
  for (const ex of exercises) {
    const group = seriesGroup(ex.series_label)
    if (!groups[group]) groups[group] = []
    groups[group].push(ex)
  }
  for (const group of Object.keys(groups)) {
    groups[group].sort((a, b) =>
      a.series_label.localeCompare(b.series_label, undefined, { numeric: true })
    )
  }
  return Object.entries(groups).sort(([a], [b]) => seriesSortKey(a) - seriesSortKey(b))
}

function EditableDayColumn({
  session,
  label,
  accent,
  onDayClick,
  edits,
  programId,
  memberId,
  coachId,
  readOnly,
  dragHandleProps,
  dragRef,
  dragStyle,
  isDragging,
}: {
  session: ProgramSession
  label: string
  accent: 'gold' | 'blue' | 'purple'
  onDayClick: (day: number) => void
  edits: CoachEdit[]
  programId: string
  memberId: string
  coachId: string | null
  readOnly: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  dragRef?: (node: HTMLElement | null) => void
  dragStyle?: React.CSSProperties
  isDragging?: boolean
}) {
  const grouped = useMemo(() => groupBySeries(session.exercises), [session.exercises])
  const borderColor = accent === 'gold' ? 'var(--color-gold-100)' : accent === 'purple' ? '#c4b5fd' : 'var(--blue-border)'
  const headerBg = accent === 'gold' ? 'rgba(184,134,11,0.07)' : accent === 'purple' ? 'rgba(139,92,246,0.07)' : 'rgba(219,234,254,0.4)'

  return (
    <div
      ref={dragRef}
      className="flex-shrink-0 rounded-xl border overflow-hidden flex flex-col"
      style={{ borderColor, minWidth: 320, maxWidth: 400, width: '100%', opacity: isDragging ? 0.4 : 1, ...dragStyle }}
    >
      <div
        className="w-full flex items-center justify-between px-3 py-2 group"
        style={{ background: headerBg }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {!readOnly && (
            <button
              {...dragHandleProps}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing rounded p-0.5 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)', touchAction: 'none' }}
              title="Drag to swap days"
              tabIndex={-1}
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onDayClick(session.day)}
            className="flex items-center gap-1.5 flex-1 text-left"
            title="Click to switch to Day View for this day"
          >
            <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
              {label}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {session.exercises.length} exercises
            </span>
          </button>
        </div>
        <svg
          className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: 'var(--text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </div>

      <div className="px-3 py-2 space-y-4 bg-white flex-1">
        {grouped.map(([seriesLetter, exercises]) => (
          <ExerciseCategoryGroup
            key={seriesLetter}
            seriesLetter={seriesLetter}
            exercises={exercises}
            sessionDay={session.day}
            edits={edits}
            programId={programId}
            memberId={memberId}
            coachId={coachId}
            readOnly={readOnly}
            compact
          />
        ))}
        {!readOnly && (
          <AddExerciseButton
            sessionDay={session.day}
            programId={programId}
            memberId={memberId}
            coachId={coachId}
            existingExercises={session.exercises}
          />
        )}
        {session.exercises.length === 0 && (
          <p className="text-[11px] py-2 text-center" style={{ color: 'var(--text-muted)' }}>
            No exercises
          </p>
        )}
      </div>
    </div>
  )
}

function SortableDayColumn({
  session,
  label,
  accent,
  onDayClick,
  edits,
  programId,
  memberId,
  coachId,
}: {
  session: ProgramSession
  label: string
  accent: 'gold' | 'blue' | 'purple'
  onDayClick: (day: number) => void
  edits: CoachEdit[]
  programId: string
  memberId: string
  coachId: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.day })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <EditableDayColumn
      session={session}
      label={label}
      accent={accent}
      onDayClick={onDayClick}
      edits={edits}
      programId={programId}
      memberId={memberId}
      coachId={coachId}
      readOnly={false}
      dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
      dragRef={setNodeRef}
      dragStyle={style}
      isDragging={isDragging}
    />
  )
}

function ReadOnlyDayColumn({
  session,
  label,
  accent,
  onDayClick,
  edits,
  programId,
  memberId,
}: {
  session: ProgramSession
  label: string
  accent: 'gold' | 'blue' | 'purple'
  onDayClick: (day: number) => void
  edits: CoachEdit[]
  programId: string
  memberId: string
}) {
  const grouped = useMemo(() => groupBySeries(session.exercises), [session.exercises])
  const borderColor = accent === 'gold' ? 'var(--color-gold-100)' : accent === 'purple' ? '#c4b5fd' : 'var(--blue-border)'
  const headerBg = accent === 'gold' ? 'rgba(184,134,11,0.07)' : accent === 'purple' ? 'rgba(139,92,246,0.07)' : 'rgba(219,234,254,0.4)'

  return (
    <div
      className="flex-shrink-0 rounded-xl border overflow-hidden"
      style={{ borderColor, minWidth: 200, maxWidth: 260, width: '100%' }}
    >
      <button
        onClick={() => onDayClick(session.day)}
        className="w-full flex items-center justify-between px-3 py-2 text-left group"
        style={{ background: headerBg }}
        title="Click to switch to Day View for this day"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>
            {label}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {session.exercises.length} exercises
          </span>
        </div>
        <svg
          className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: 'var(--text-muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      <div className="px-3 py-2 space-y-3 bg-white">
        {grouped.map(([seriesLetter, exercises]) => (
          <ExerciseCategoryGroup
            key={seriesLetter}
            seriesLetter={seriesLetter}
            exercises={exercises}
            sessionDay={session.day}
            edits={edits}
            programId={programId}
            memberId={memberId}
            coachId={null}
            readOnly
            compact
          />
        ))}
        {session.exercises.length === 0 && (
          <p className="text-[11px] py-2 text-center" style={{ color: 'var(--text-muted)' }}>
            No exercises
          </p>
        )}
      </div>
    </div>
  )
}

function ProgramWeekGrid({
  sessions,
  accent,
  programLabel,
  onDayClick,
  editable,
  edits,
  programId,
  memberId,
  coachId,
}: {
  sessions: ProgramSession[]
  accent: 'gold' | 'blue' | 'purple'
  programLabel: string
  onDayClick: (day: number) => void
  editable?: boolean
  edits?: CoachEdit[]
  programId?: string
  memberId?: string
  coachId?: string | null
}) {
  const { swapDays } = useEditorStore()
  const [activeDayId, setActiveDayId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const dayIds = sessions.map((s) => s.day)

  function handleDragStart(event: DragStartEvent) {
    setActiveDayId(Number(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDayId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    void swapDays(Number(active.id), Number(over.id))
  }

  const labelColor = accent === 'gold' ? 'var(--color-gold)' : accent === 'purple' ? '#7c3aed' : 'var(--blue)'
  const labelBg = accent === 'gold' ? 'var(--color-gold-50)' : accent === 'purple' ? 'rgba(139,92,246,0.1)' : 'var(--blue-bg)'
  const labelBorder = accent === 'gold' ? 'var(--color-gold-100)' : accent === 'purple' ? '#c4b5fd' : 'var(--blue-border)'

  const activeSession = activeDayId !== null ? sessions.find((s) => s.day === activeDayId) ?? null : null

  if (editable && edits && programId && memberId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: labelBg, color: labelColor, border: `1px solid ${labelBorder}` }}
          >
            {programLabel}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {sessions.length} day{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={dayIds} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {sessions.map((session) => (
                <SortableDayColumn
                  key={session.day}
                  session={session}
                  label={`Day ${session.day}`}
                  accent={accent}
                  onDayClick={onDayClick}
                  edits={edits}
                  programId={programId}
                  memberId={memberId}
                  coachId={coachId ?? null}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeSession && (
              <div className="opacity-90 shadow-xl rotate-1">
                <EditableDayColumn
                  session={activeSession}
                  label={`Day ${activeSession.day}`}
                  accent={accent}
                  onDayClick={() => undefined}
                  edits={edits}
                  programId={programId}
                  memberId={memberId}
                  coachId={coachId ?? null}
                  readOnly
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: labelBg, color: labelColor, border: `1px solid ${labelBorder}` }}
        >
          {programLabel}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {sessions.length} day{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {sessions.map((session) => (
          <ReadOnlyDayColumn
            key={session.day}
            session={session}
            label={`Day ${session.day}`}
            accent={accent}
            onDayClick={onDayClick}
            edits={edits ?? []}
            programId={programId ?? ''}
            memberId={memberId ?? ''}
          />
        ))}
      </div>
    </div>
  )
}

export function WeeklyView({
  program,
  previousProgram,
  nextEditedSessions,
  lastEditedSessions,
  onDayClick,
  nextEdits,
  lastEdits,
  coachId,
  nextProgram,
}: WeeklyViewProps) {
  const [showNext, setShowNext] = useState(true)
  const [showLast, setShowLast] = useState(false)
  const [showFuture, setShowFuture] = useState(false)

  const hasLast = !!previousProgram && lastEditedSessions.length > 0
  const hasFuture = !!nextProgram && (nextProgram.payload?.sessions?.length ?? 0) > 0

  const nextScheme = program.scheme_name ?? 'Program'
  const nextRepRange = program.rep_range ?? ''
  const nextLabel = [nextScheme, nextRepRange].filter(Boolean).join(' \u00B7 ')

  const lastScheme = previousProgram?.scheme_name ?? 'Last Program'
  const lastRepRange = previousProgram?.rep_range ?? ''
  const lastLabel = [lastScheme, lastRepRange].filter(Boolean).join(' \u00B7 ')

  const futureScheme = nextProgram?.scheme_name ?? 'Future'
  const futureRepRange = nextProgram?.rep_range ?? ''
  const futureLabel = [futureScheme, futureRepRange].filter(Boolean).join(' \u00B7 ')

  const futureSessions: ProgramSession[] = useMemo(() => {
    return nextProgram?.payload?.sessions ?? []
  }, [nextProgram])

  return (
    <div className="space-y-5">
      {/* Toggle checkboxes */}
      <div
        className="flex items-center gap-5 px-4 py-3 rounded-xl border"
        style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}
      >
        <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Show:</p>
        <label className={cn('flex items-center gap-2 cursor-pointer select-none', !hasLast && 'opacity-40 cursor-not-allowed')}>
          <input
            type="checkbox"
            checked={showLast && hasLast}
            disabled={!hasLast || (showLast && !showNext)}
            onChange={(e) => setShowLast(e.target.checked)}
            className="rounded accent-[var(--blue)]"
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
            Last Program
          </span>
          {!hasLast && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(none)</span>
          )}
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showNext}
            disabled={showNext && !showLast && !showFuture}
            onChange={(e) => setShowNext(e.target.checked)}
            className="rounded accent-[var(--color-gold)]"
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
            Next Program
          </span>
        </label>
        <label className={cn('flex items-center gap-2 cursor-pointer select-none', !hasFuture && 'opacity-40 cursor-not-allowed')}>
          <input
            type="checkbox"
            checked={showFuture && hasFuture}
            disabled={!hasFuture}
            onChange={(e) => setShowFuture(e.target.checked)}
            className="rounded"
            style={{ accentColor: '#7c3aed' }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
            Future Program
          </span>
          {!hasFuture && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(none)</span>
          )}
        </label>
      </div>

      {/* Program grids */}
      {showLast && hasLast && previousProgram && (
        <ProgramWeekGrid
          sessions={lastEditedSessions}
          accent="blue"
          programLabel={`Last: ${lastLabel}`}
          onDayClick={onDayClick}
          edits={lastEdits}
          programId={previousProgram.id}
          memberId={previousProgram.member_id}
          coachId={coachId}
        />
      )}

      {showNext && (
        <ProgramWeekGrid
          sessions={nextEditedSessions}
          accent="gold"
          programLabel={`Next: ${nextLabel}`}
          onDayClick={onDayClick}
          editable
          edits={nextEdits}
          programId={program.id}
          memberId={program.member_id}
          coachId={coachId}
        />
      )}

      {showFuture && hasFuture && nextProgram && (
        <ProgramWeekGrid
          sessions={futureSessions}
          accent="purple"
          programLabel={`Future: ${futureLabel}`}
          onDayClick={onDayClick}
          edits={[]}
          programId={nextProgram.id}
          memberId={nextProgram.member_id}
          coachId={coachId}
        />
      )}

      {!showNext && !showLast && (
        <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">Select at least one program to display.</p>
        </div>
      )}
    </div>
  )
}
