import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { jsonResponse, LocationDisplay, mockApi } from '../../test/utils.jsx'
import AdminDashboardPage from './AdminDashboardPage.jsx'

const STATS = {
  users: { voyageur: 12, prestataire: 4, admin: 1, total: 17 },
  suspended: 2,
  pendingProviders: 3,
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminDashboardPage', () => {
  it('affiche les statistiques ; « Demandes en attente » mène à la liste filtrée', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /admin/stats': () => jsonResponse(STATS) })
    renderDashboard()

    expect(screen.getByText('Administration')).toHaveClass('surtitre')
    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Voyageurs : 12' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prestataires : 4' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Comptes suspendus : 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Demandes en attente : 3' }))
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/utilisateurs?approval=en_attente',
    )
  })

  it('erreur puis « Réessayer »', async () => {
    const user = userEvent.setup()
    let calls = 0
    mockApi({
      'GET /admin/stats': () => {
        calls += 1
        return calls === 1
          ? jsonResponse({ message: 'Service momentanément indisponible.' }, 503)
          : jsonResponse(STATS)
      },
    })
    renderDashboard()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les statistiques',
    )
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('link', { name: 'Voyageurs : 12' })).toBeInTheDocument()
  })
})
