import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog.jsx'

function Harness({ onConfirm = () => {}, busy = false }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Ouvrir
      </button>
      <button type="button">Derrière la boîte</button>
      {open && (
        <ConfirmDialog
          title="Supprimer ce service ?"
          confirmLabel="Supprimer"
          busy={busy}
          onConfirm={onConfirm}
          onCancel={() => setOpen(false)}
        >
          <p>Cette action est définitive.</p>
        </ConfirmDialog>
      )}
    </>
  )
}

describe('ConfirmDialog', () => {
  it('est une boîte modale nommée et décrite, avec le focus sur « Annuler »', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))

    const dialog = screen.getByRole('dialog', { name: 'Supprimer ce service ?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Cette action est définitive.')
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('piège le focus : Tab et Maj+Tab restent dans la boîte', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))

    const cancel = screen.getByRole('button', { name: 'Annuler' })
    const confirm = screen.getByRole('button', { name: 'Supprimer' })

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it('se ferme avec Échap et rend le focus au bouton d’ouverture', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Ouvrir' })
    await user.click(opener)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
  })

  it('appelle onConfirm et ignore Échap pendant l’action', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const { rerender } = render(<Harness onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Ouvrir' }))

    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    rerender(<Harness onConfirm={onConfirm} busy />)
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeDisabled()
    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
