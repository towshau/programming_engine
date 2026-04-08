import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { WorkbookCoach } from '../types'

const COACHING_ROLES = [
  'Coach',
  'Advanced Coach',
  'Senior Coach',
  'Gym Manager',
  'Head of Exercise',
]

export function useWorkbookCoaches() {
  const [coaches, setCoaches] = useState<WorkbookCoach[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('staff_database')
        .select('id, first_name, last_name, coach_name, role, staff_status, home_gym')
        .in('role', COACHING_ROLES)
        .eq('staff_status', 'active')
        .order('first_name')

      if (error) {
        console.error('Error fetching coaches:', error)
      } else {
        setCoaches((data ?? []) as WorkbookCoach[])
      }
      setLoading(false)
    }
    void load()
  }, [])

  return { coaches, loading }
}
