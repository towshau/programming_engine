import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Note, NoteType } from '../types'

export function useNotes(memberIds: string[], coachIds: string[]) {
  const [notesMap, setNotesMap] = useState<Map<string, Map<NoteType, Note>>>(new Map())
  const [loading, setLoading] = useState(false)

  const memberKey = memberIds.join(',')
  const coachKey = coachIds.join(',')

  const fetchNotes = useCallback(async () => {
    if (memberIds.length === 0 || coachIds.length === 0) {
      setNotesMap(new Map())
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from('member_coach_notes')
      .select('*')
      .in('member_id', memberIds)
      .in('coach_id', coachIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notes:', error)
      setLoading(false)
      return
    }

    const map = new Map<string, Map<NoteType, Note>>()

    for (const row of (data ?? []) as Note[]) {
      const noteType = row.note_type as NoteType
      if (!['general notes', 'team', 'goal', 'habits'].includes(noteType)) continue

      let memberNotes = map.get(row.member_id)
      if (!memberNotes) {
        memberNotes = new Map<NoteType, Note>()
        map.set(row.member_id, memberNotes)
      }
      if (!memberNotes.has(noteType)) {
        memberNotes.set(noteType, row)
      }
    }

    setNotesMap(map)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey, coachKey])

  useEffect(() => {
    void fetchNotes()
  }, [fetchNotes])

  const updateNote = useCallback(
    async (noteId: string, content: string) => {
      const { error } = await supabase
        .from('member_coach_notes')
        .update({ note_content: content, updated_at: new Date().toISOString() })
        .eq('id', noteId)

      if (error) console.error('Error updating note:', error)
      else await fetchNotes()
    },
    [fetchNotes]
  )

  const createNote = useCallback(
    async (memberId: string, coachId: string, noteType: NoteType, content: string) => {
      const { error } = await supabase.from('member_coach_notes').insert({
        member_id: memberId,
        coach_id: coachId,
        note_type: noteType,
        note_content: content,
        checkin_1: false,
        checkin_2: false,
        checkin_3: false,
      })

      if (error) console.error('Error creating note:', error)
      else await fetchNotes()
    },
    [fetchNotes]
  )

  const catalogAndCreate = useCallback(
    async (memberId: string, coachId: string, noteType: NoteType, content: string) => {
      await createNote(memberId, coachId, noteType, content)
    },
    [createNote]
  )

  const createAndCheckin = useCallback(
    async (memberId: string, coachId: string) => {
      const { error } = await supabase.from('member_coach_notes').insert({
        member_id: memberId,
        coach_id: coachId,
        note_type: 'general notes',
        note_content: '',
        checkin_1: true,
        checkin_2: false,
        checkin_3: false,
      })

      if (error) console.error('Error creating checkin note:', error)
      else await fetchNotes()
    },
    [fetchNotes]
  )

  const toggleCheckin = useCallback(
    async (noteId: string, current: boolean) => {
      const { error } = await supabase
        .from('member_coach_notes')
        .update({ checkin_1: !current })
        .eq('id', noteId)

      if (error) console.error('Error toggling checkin:', error)
      else await fetchNotes()
    },
    [fetchNotes]
  )

  const clearAllCheckins = useCallback(
    async (noteIds: string[]) => {
      if (noteIds.length === 0) return
      const { error } = await supabase
        .from('member_coach_notes')
        .update({ checkin_1: false })
        .in('id', noteIds)

      if (error) console.error('Error clearing checkins:', error)
      else await fetchNotes()
    },
    [fetchNotes]
  )

  return {
    notesMap,
    loading,
    updateNote,
    createNote,
    catalogAndCreate,
    createAndCheckin,
    toggleCheckin,
    clearAllCheckins,
    refetch: fetchNotes,
  }
}
