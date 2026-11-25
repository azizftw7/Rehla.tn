import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import RequireApprovedProvider from './components/RequireApprovedProvider.jsx'
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminUsersPage from './pages/admin/AdminUsersPage.jsx'
import ChangePasswordPage from './pages/account/ChangePasswordPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import CrashTestPage from './pages/dev/CrashTestPage.jsx'
import DestinationPage from './pages/destinations/DestinationPage.jsx'
import DestinationsPage from './pages/destinations/DestinationsPage.jsx'
import HomePage from './pages/home/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import EditServicePage from './pages/provider/EditServicePage.jsx'
import MyServicesPage from './pages/provider/MyServicesPage.jsx'
import NewServicePage from './pages/provider/NewServicePage.jsx'
import ProviderPendingPage from './pages/provider/ProviderPendingPage.jsx'
import ServiceDetailPage from './pages/services/ServiceDetailPage.jsx'
import ServicesPage from './pages/services/ServicesPage.jsx'
import TripSharePage from './pages/tripShare/TripSharePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="destinations" element={<DestinationsPage />} />
        <Route path="destinations/:slug" element={<DestinationPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:id" element={<ServiceDetailPage />} />
        <Route path="connexion" element={<LoginPage />} />
        <Route path="inscription" element={<RegisterPage />} />
        <Route
          path="mon-compte/mot-de-passe"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route element={<ProtectedRoute roles={['prestataire']} />}>
          <Route path="prestataire/en-attente" element={<ProviderPendingPage />} />
          {/* Espace prestataire : ouvert seulement après validation par l'administrateur. */}
          <Route element={<RequireApprovedProvider />}>
            <Route path="prestataire/services" element={<MyServicesPage />} />
            <Route path="prestataire/services/nouveau" element={<NewServicePage />} />
            <Route path="prestataire/services/:id/modifier" element={<EditServicePage />} />
          </Route>
        </Route>
        {/* US5.3 / US5.4 : un visiteur est envoyé vers la connexion, puis ramené ici. */}
        <Route
          path="partage"
          element={
            <ProtectedRoute roles={['voyageur']}>
              <TripSharePage />
            </ProtectedRoute>
          }
        />
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/utilisateurs" element={<AdminUsersPage />} />
        </Route>
        {import.meta.env.DEV && <Route path="test-erreur" element={<CrashTestPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}