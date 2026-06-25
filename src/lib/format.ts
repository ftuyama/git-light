import { format, formatDistanceToNowStrict } from 'date-fns'

export function relativeTime(date: Date): string {
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export function fullTimestamp(date: Date): string {
  return format(date, 'MMM d, yyyy · HH:mm')
}
