import { defineStore } from 'pinia'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface PromptOptions {
  title: string
  message?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface PromptState {
  open: boolean
  mode: 'confirm' | 'prompt'
  title: string
  message: string
  placeholder: string
  value: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  resolver: ((result: boolean | string | null) => void) | null
}

export const usePromptStore = defineStore('prompt', {
  state: (): PromptState => ({
    open: false,
    mode: 'confirm',
    title: '',
    message: '',
    placeholder: '',
    value: '',
    confirmLabel: 'OK',
    cancelLabel: 'Cancel',
    danger: false,
    resolver: null,
  }),
  actions: {
    confirm(options: ConfirmOptions): Promise<boolean> {
      return new Promise((resolve) => {
        this.open = true
        this.mode = 'confirm'
        this.title = options.title
        this.message = options.message
        this.confirmLabel = options.confirmLabel ?? 'Confirm'
        this.cancelLabel = options.cancelLabel ?? 'Cancel'
        this.danger = options.danger ?? false
        this.resolver = (result) => resolve(result === true)
      })
    },

    prompt(options: PromptOptions): Promise<string | null> {
      return new Promise((resolve) => {
        this.open = true
        this.mode = 'prompt'
        this.title = options.title
        this.message = options.message ?? ''
        this.placeholder = options.placeholder ?? ''
        this.value = options.defaultValue ?? ''
        this.confirmLabel = options.confirmLabel ?? 'OK'
        this.cancelLabel = options.cancelLabel ?? 'Cancel'
        this.danger = false
        this.resolver = (result) => resolve(typeof result === 'string' ? result : null)
      })
    },

    submit(): void {
      const resolve = this.resolver
      this.resolver = null
      this.open = false
      if (!resolve) return
      if (this.mode === 'confirm') resolve(true)
      else resolve(this.value.trim() || null)
    },

    cancel(): void {
      const resolve = this.resolver
      this.resolver = null
      this.open = false
      if (!resolve) return
      resolve(this.mode === 'confirm' ? false : null)
    },
  },
})
