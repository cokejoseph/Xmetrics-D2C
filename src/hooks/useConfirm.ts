import { useState } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
}

let confirmCallback: ((options: ConfirmOptions) => Promise<boolean>) | null = null

export function setConfirmCallback(cb: (options: ConfirmOptions) => Promise<boolean>) {
  confirmCallback = cb
}

export function useConfirm() {
  return async (options: ConfirmOptions): Promise<boolean> => {
    if (!confirmCallback) {
      console.warn('Confirm dialog not initialized')
      return true
    }
    return confirmCallback(options)
  }
}
