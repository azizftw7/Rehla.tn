import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import CrashTestPage from './pages/dev/CrashTestPage.jsx'
import DestinationPage from './pages/destinations/DestinationPage.jsx'
import DestinationsPage from './pages/destinations/DestinationsPage.jsx'
import HomePage from './pages/home/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import NewServicePage from './pages/provider/NewServicePage.jsx'
import ServiceDetailPage from './pages/services/ServiceDetailPage.jsx'
import ServicesPage from './pages/services/ServicesPage.jsx'

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
        <Route element={<ProtectedRoute roles={['prestataire']} />}>
          <Route path="prestataire/services/nouveau" element={<NewServicePage />} />
        </Route>
        {import.meta.env.DEV && <Route path="test-erreur" element={<CrashTestPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}