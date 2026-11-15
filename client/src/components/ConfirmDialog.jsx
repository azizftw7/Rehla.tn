import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FormAlert } from '../pages/auth/AuthLayout.jsx'
import Button from './Button.jsx'
import './ConfirmDialog.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Boîte de confirmation modale (role="dialog", aria-modal).
 * - le focus va sur « Annuler » (choix sans risque) et reste piégé dans la boîte ;
 * - Échap ou un clic sur le voile ferme la boîte (sauf pendant l'action) ;
 * - à la fermeture, le focus revient sur l'élément qui l'a ouverte s'il existe encore.
 */
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  confirmIcon,
  busy = false,
  busyLabel,
  error,
  onConfirm,
  onCancel,
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const busyRef = useRef(busy)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    busyRef.current = busy
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    const opener = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    cancelRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  // Pendant l'action, les boutons sont désactivés : le focus reste dans la boîte (sur le panneau).
  useEffect(() => {
    const panel = dialogRef.current
    const active = document.activeElement
    if (panel && (!panel.contains(active) || active.disabled)) panel.focus()
  }, [busy])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      if (!busyRef.current) onCancelRef.current?.()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const outside = !dialogRef.current.contains(document.activeElement)
    if (event.shiftKey && (document.activeElement === first || outside)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || outside)) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className="confirm-dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.()
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="titre-3 confirm-dialog__title">
          {title}
        </h2>
        <div id={descriptionId} className="texte confirm-dialog__text">
          {children}
        </div>
        <FormAlert>{error}</FormAlert>
        <div className="confirm-dialog__actions">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={confirmIcon}
            className="confirm-dialog__confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
