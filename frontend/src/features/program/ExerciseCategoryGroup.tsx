import type { ProgramExercise, CoachEdit } from '../../types'
import { ExerciseRow } from './ExerciseRow'
import { cn, seriesColor, seriesGroupLabel } from '../../lib/utils'
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

interface ExerciseCategoryGroupProps {
  seriesLetter: string
  exercises: ProgramExercise[]
  sessionDay: number
  edits: CoachEdit[]
  programId: string
  memberId: string
  coachId: string | null
  readOnly?: boolean
  compact?: boolean
}

function SortableExerciseRow({
  exercise,
  sessionDay,
  edits,
  programId,
  memberId,
  coachId,
  readOnly,
  compact,
  isDragging,
}: {
  exercise: ProgramExercise
  sessionDay: number
  edits: CoachEdit[]
  programId: string
  memberId: string
  coachId: string | null
  readOnly: boolean
  compact: boolean
  isDragging?: boolean
}) {
  const id = exercise.row_id ?? `${exercise.series_label}-${exercise.exercise_id}`
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSelfDragging,
  } = useSortable({ id, disabled: readOnly })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSelfDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-1 group/sortable">
      {!readOnly && (
        <button
          {...attributes}
          {...listeners}
          className={cn(
            'flex-shrink-0 mt-2 rounded p-0.5 cursor-grab active:cursor-grabbing transition-opacity',
            isDragging ? 'opacity-60' : 'opacity-0 group-hover/sortable:opacity-40 hover:!opacity-80'
          )}
          style={{ color: 'var(--text-muted)', touchAction: 'none' }}
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
          </svg>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <ExerciseRow
          exercise={exercise}
          sessionDay={sessionDay}
          edits={edits}
          programId={programId}
          memberId={memberId}
          coachId={coachId}
          readOnly={readOnly}
          compact={compact}
        />
      </div>
    </div>
  )
}

export function ExerciseCategoryGroup({
  seriesLetter,
  exercises,
  sessionDay,
  edits,
  programId,
  memberId,
  coachId,
  readOnly = false,
  compact = false,
}: ExerciseCategoryGroupProps) {
  const colorClasses = seriesColor(seriesLetter)
  const label = seriesGroupLabel(seriesLetter)
  const { addPendingEdit } = useEditorStore()

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const ids = exercises.map(
    (ex) => ex.row_id ?? `${ex.series_label}-${ex.exercise_id}`
  )

  const activeExercise = activeId
    ? exercises.find((ex) => (ex.row_id ?? `${ex.series_label}-${ex.exercise_id}`) === activeId) ?? null
    : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeEx = exercises.find(
      (ex) => (ex.row_id ?? `${ex.series_label}-${ex.exercise_id}`) === active.id
    )
    const overEx = exercises.find(
      (ex) => (ex.row_id ?? `${ex.series_label}-${ex.exercise_id}`) === over.id
    )
    if (!activeEx || !overEx) return

    // Swap labels: active gets over's label, over gets active's label
    addPendingEdit({
      session_day: sessionDay,
      series_label: activeEx.series_label,
      exercise_id: activeEx.exercise_id,
      edit_type: 'series_change',
      old_value: { series_label: activeEx.series_label },
      new_value: { series_label: overEx.series_label },
      row_id: activeEx.row_id,
    })
    addPendingEdit({
      session_day: sessionDay,
      series_label: overEx.series_label,
      exercise_id: overEx.exercise_id,
      edit_type: 'series_change',
      old_value: { series_label: overEx.series_label },
      new_value: { series_label: activeEx.series_label },
      row_id: overEx.row_id,
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold border',
            colorClasses
          )}
        >
          {seriesLetter}
        </span>
        {!compact && (
          <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {exercises.map((exercise) => (
              <SortableExerciseRow
                key={exercise.row_id ?? `${exercise.series_label}-${exercise.exercise_id}`}
                exercise={exercise}
                sessionDay={sessionDay}
                edits={edits}
                programId={programId}
                memberId={memberId}
                coachId={coachId}
                readOnly={readOnly}
                compact={compact}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeExercise && (
            <div className="opacity-90 shadow-lg">
              <ExerciseRow
                exercise={activeExercise}
                sessionDay={sessionDay}
                edits={edits}
                programId={programId}
                memberId={memberId}
                coachId={coachId}
                readOnly
                compact={compact}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
