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

export function seriesColor(seriesLetter: string): string {
  switch (seriesLetter) {
    case 'A':
      return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'B':
      return 'text-teal-400 bg-teal-400/10 border-teal-400/20'
    case 'C':
      return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    case 'D':
      return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
    default:
      return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'
  }
}

export function seriesGroupLabel(seriesLetter: string): string {
  switch (seriesLetter) {
    case 'A':
      return 'Primary'
    case 'B':
      return 'Accessory'
    default:
      return 'Additional'
  }
}
