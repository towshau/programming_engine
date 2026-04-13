import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { AttendanceWeek } from './types'

interface AttendanceChartProps {
  data: AttendanceWeek[]
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function AttendanceChart({ data }: AttendanceChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No attendance data available.</p>
    )
  }

  const chartData = data.map((w) => ({
    week: formatWeekLabel(w.date),
    sessions: w.sessions_attended,
    lateCancel: w.late_cancel,
    noShows: w.no_shows,
  }))

  return (
    <div>
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
        Attendance (last 12 weeks)
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} barGap={0} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={24}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="sessions" stackId="a" fill="var(--green)" radius={[0, 0, 0, 0]} name="Sessions" />
          <Bar dataKey="lateCancel" stackId="a" fill="var(--orange)" name="Late Cancel" />
          <Bar dataKey="noShows" stackId="a" fill="var(--red)" radius={[2, 2, 0, 0]} name="No Shows" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
