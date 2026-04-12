import { useState, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { AttendanceWeek } from './types'

export function useChurnDetail() {
  const cacheRef = useRef(new Map<string, AttendanceWeek[]>())
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceWeek[]>>(new Map())
  const loadingRef = useRef(new Set<string>())

  const fetchAttendance = useCallback(async (memberId: string) => {
    if (cacheRef.current.has(memberId) || loadingRef.current.has(memberId)) return
    loadingRef.current.add(memberId)

    const twelveWeeksAgo = new Date()
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
    const dateStr = twelveWeeksAgo.toISOString().split('T')[0]

    const { data } = await supabase
      .from('member_batch_attendance')
      .select('date, sessions_attended, late_cancel, no_shows')
      .eq('member_id', memberId)
      .gte('date', dateStr)
      .order('date', { ascending: true })

    if (data) {
      cacheRef.current.set(memberId, data as AttendanceWeek[])
      setAttendanceMap(new Map(cacheRef.current))
    }
    loadingRef.current.delete(memberId)
  }, [])

  return { attendanceMap, fetchAttendance }
}
