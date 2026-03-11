import { useState, useRef, useEffect } from 'react'

/**
 * Manages open/close state for a dropdown, closing it when clicking outside.
 * Returns [isOpen, setIsOpen, ref] where ref must be attached to the dropdown container.
 */
export function useDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    function handleOutsideClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  return [isOpen, setIsOpen, ref]
}
