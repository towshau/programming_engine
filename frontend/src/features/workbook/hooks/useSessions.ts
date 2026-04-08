/**
 * Loads real attendance from `member_daily_sessions_attended`.
 * Last wk = Mon–Sun of the week before the current week.
 * Month = previous calendar month.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

interface SessionStats {
  lastWeekActual: number
  monthActual: number
}

function getPreviousWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() - diffToMonday)
  thisMonday.setHours(0, 0, 0, 0)

  const prevMonday = new Date(thisMonday)
  prevMonday.setDate(thisMonday.getDate() - 7)
  const prevSunday = new Date(prevMonday)
  prevSunday.setDate(prevMonday.getDate() + 6)

  return {
    start: prevMonday.toISOString().split('T')[0],
    end: prevSunday.toISOString().split('T')[0],
  }
}

function getPreviousMonthRange(): { start: string; end: string; fullWeeks: number } {
  const now = new Date()
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  let fullWeeks = 0
  const d = new Date(firstOfPrevMonth)
  while (d <= lastOfPrevMonth) {
    if (d.getDay() === 1) fullWeeks++
    d.setDate(d.getDate() + 1)
  }

  return {
    start: firstOfPrevMonth.toISOString().split('T')[0],
    end: lastOfPrevMonth.toISOString().split('T')[0],
    fullWeeks: Math.max(fullWeeks, 1),
  }
}

export function useSessions(memberIds: string[]) {
  const [statsMap, setStatsMap] = useState<Map<string, SessionStats>>(new Map())
  const [monthFullWeeks, setMonthFullWeeks] = useState(4)
  const [loading, setLoading] = useState(false)

  const memberKey = memberIds.join(',')

  useEffect(() => {
    if (memberIds.length === 0) {
      setStatsMap(new Map())
      return
    }

    async function load() {
      setLoading(true)
      const weekRange = getPreviousWeekRange()
      const monthRange = getPreviousMonthRange()
      setMonthFullWeeks(monthRange.fullWeeks)

      const [weekRes, monthRes] = await Promise.all([
        supabase
          .from('member_daily_sessions_attended')
          .select('member_id, session_date')
          .in('member_id', memberIds)
          .gte('session_date', weekRange.start)
          .lte('session_date', weekRange.end),
        supabase
          .from('member_daily_sessions_attended')
          .select('member_id, session_date')
          .in('member_id', memberIds)
          .gte('session_date', monthRange.start)
          .lte('session_date', monthRange.end),
      ])

      const map = new Map<string, SessionStats>()

      for (const id of memberIds) {
        map.set(id, { lastWeekActual: 0, monthActual: 0 })
      }

      for (const row of weekRes.data ?? []) {
        const s = map.get(row.member_id as string)
        if (s) s.lastWeekActual++
      }

      for (const row of monthRes.data ?? []) {
        const s = map.get(row.member_id as string)
        if (s) s.monthActual++
      }

      setStatsMap(map)
      setLoading(false)
    }

    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey])

  return { statsMap, monthFullWeeks, loading }
}
