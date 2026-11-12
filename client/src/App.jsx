import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import CrashTestPage from './pages/dev/CrashTestPage.jsx'
import HomePage from './pages/home/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ServiceDetailPage from './pages/services/ServiceDetailPage.jsx'
import ServicesPage from './pages/services/ServicesPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:id" element={<ServiceDetailPage />} />
        {import.meta.env.DEV && <Route path="test-erreur" element={<CrashTestPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}