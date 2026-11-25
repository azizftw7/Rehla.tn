import { Send } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { FormAlert } from '../pages/auth/AuthLayout.jsx'
import { splitApiError } from '../pages/auth/authForm.js'
import { MAX_REPLY_LENGTH } from '../lib/reviewsApi.js'
import Button from './Button.jsx'
import './ReviewForm.css'

/**
 * Réponse du prestataire à un avis (US6.4) : texte obligatoire, 1000 caractères au plus.
 * - initial : texte de la réponse existante (modification)
 * - onSubmit(text) : promesse ; une erreur de l'API s'affiche sous le champ
 * - onCancel : ferme le formulaire
 */
export default function ReplyForm({
  label = 'Votre réponse',
  initial = '',
  submitLabel = 'Publier la réponse',
  busyLabel = 'Publication…',
  onSubmit,
  onCancel,
}) {
  const id = useId()
  const textareaRef = useRef(null)
  const [text, setText] = useState(initial)
  const [error, setError] = useState(null)
  const [general, setGeneral] = useState(null)
  const [busy, setBusy] = useState(false)

  const ids = { text: `${id}-texte`, counter: `${id}-compteur`, error: `${id}-erreur` }

  // Le formulaire s'ouvre sur demande : le focus va directement dans la zone de texte.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = text.trim()
    let message = null
    if (!value) message = 'Écrivez votre réponse.'
    else if (value.length > MAX_REPLY_LENGTH) {
      message = `La réponse ne peut pas dépasser ${MAX_REPLY_LENGTH} caractères.`
    }
    setError(message)
    setGeneral(null)
    if (message) {
      textareaRef.current?.focus()
      return
    }

    setBusy(true)
    try {
      await onSubmit(value)
    } catch (err) {
      const split = splitApiError(err, ['text'])
      setError(split.fieldErrors.text || null)
      setGeneral(split.general)
      setBusy(false)
    }
  }

  return (
    <form className="review-form review-form--reply" onSubmit={handleSubmit} noValidate>
      <FormAlert>{general}</FormAlert>
      <div className="review-form__field">
        <label htmlFor={ids.text} className="label">
          {label}
        </label>
        <textarea
          ref={textareaRef}
          id={ids.text}
          className="services-page__input texte-s review-form__textarea"
          rows={3}
          maxLength={MAX_REPLY_LENGTH}
          placeholder="Remerciez le voyageur, apportez une précision…"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            if (error) setError(null)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={[ids.counter, error && ids.error].filter(Boolean).join(' ')}
        />
        <p id={ids.counter} className="legende review-form__counter">
          {text.trim().length} / {MAX_REPLY_LENGTH} caractères
        </p>
        {error && (
          <p id={ids.error} className="services-page__field-error legende">
            {error}
          </p>
        )}
      </div>
      <div className="review-form__actions">
        <Button type="submit" variant="primary" size="sm" icon={Send} disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
