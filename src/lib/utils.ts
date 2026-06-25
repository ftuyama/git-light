import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const LANE_COLORS = [
  'var(--color-lane-0)',
  'var(--color-lane-1)',
  'var(--color-lane-2)',
  'var(--color-lane-3)',
  'var(--color-lane-4)',
  'var(--color-lane-5)',
  'var(--color-lane-6)',
  'var(--color-lane-7)',
] as const

export function laneColor(lane: number): string {
  return LANE_COLORS[((lane % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length]
}

export const LANE_COUNT = LANE_COLORS.length
