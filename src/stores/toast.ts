import { defineStore } from 'pinia'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

let nextId = 1

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [] as Toast[],
  }),
  actions: {
    push(message: string, tone: ToastTone = 'success'): void {
      const id = nextId++
      this.toasts.push({ id, message, tone })
      setTimeout(() => this.dismiss(id), 2600)
    },
    dismiss(id: number): void {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
