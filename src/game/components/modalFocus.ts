import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

export function shouldTrapModalKey(key: string) {
  return key === 'Tab'
}

export function getModalTabTarget<T>(
  focusableElements: readonly T[],
  activeElement: T | null,
  backwards: boolean
): T | null {
  if (focusableElements.length === 0) return null
  const activeIndex = activeElement === null
    ? -1
    : focusableElements.indexOf(activeElement)
  if (activeIndex === -1) {
    return backwards
      ? focusableElements[focusableElements.length - 1]
      : focusableElements[0]
  }
  if (backwards && activeIndex === 0) {
    return focusableElements[focusableElements.length - 1]
  }
  if (!backwards && activeIndex === focusableElements.length - 1) {
    return focusableElements[0]
  }
  return null
}

export function useModalFocus() {
  const modalRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const modal = modalRef.current
    const title = titleRef.current
    if (!modal || !title) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const siblings = Array.from(modal.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => (
        element instanceof HTMLElement && element !== modal
      ))
      .map(element => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden')
      }))

    siblings.forEach(({ element }) => {
      element.inert = true
      element.setAttribute('aria-hidden', 'true')
    })
    title.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldTrapModalKey(event.key)) return
      const focusableElements = Array.from(
        modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      const activeElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      const target = getModalTabTarget(
        focusableElements,
        activeElement,
        event.shiftKey
      )
      if (!target) return
      event.preventDefault()
      target.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      siblings.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert
        if (ariaHidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', ariaHidden)
      })
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return { modalRef, titleRef }
}
