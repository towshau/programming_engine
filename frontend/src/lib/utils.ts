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
  WU: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, CD: 7,
}

export function seriesSortKey(group: string): number {
  return SERIES_SORT_ORDER[group] ?? 99
}

export function seriesColor(seriesLetter: string): string {
  switch (seriesLetter) {
    case 'WU':
      return 'series-wu'
    case 'A':
      return 'series-a'
    case 'B':
      return 'series-b'
    case 'C':
      return 'series-c'
    case 'D':
      return 'series-d'
    case 'E':
      return 'series-e'
    case 'F':
      return 'series-f'
    case 'CD':
      return 'series-cd'
    default:
      return 'series-d'
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
    case 'E':
    case 'F':
      return 'Extra'
    case 'CD':
      return 'Cool Down'
    default:
      return 'Additional'
  }
}
