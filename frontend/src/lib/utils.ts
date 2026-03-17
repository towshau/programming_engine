import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

/**
 * Extracts the series group key from a label like "WU1" -> "WU", "A1" -> "A", "CD2" -> "CD".
 */
export function seriesGroup(label: string): string {
  if (label.startsWith('WU')) return 'WU'
  if (label.startsWith('CD')) return 'CD'
  return label.charAt(0)
}

const SERIES_SORT_ORDER: Record<string, number> = {
  WU: 0, A: 1, B: 2, C: 3, D: 4, CD: 5,
}

export function seriesSortKey(group: string): number {
  return SERIES_SORT_ORDER[group] ?? 99
}

export function seriesColor(seriesLetter: string): string {
  switch (seriesLetter) {
    case 'WU':
      return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
    case 'A':
      return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'B':
      return 'text-teal-400 bg-teal-400/10 border-teal-400/20'
    case 'C':
      return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    case 'D':
      return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
    case 'CD':
      return 'text-rose-400 bg-rose-400/10 border-rose-400/20'
    default:
      return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
  }
}

export function seriesGroupLabel(seriesLetter: string): string {
  switch (seriesLetter) {
    case 'WU':
      return 'Warm Up'
    case 'A':
      return 'Primary'
    case 'B':
      return 'Accessory'
    case 'CD':
      return 'Cool Down'
    default:
      return 'Additional'
  }
}
