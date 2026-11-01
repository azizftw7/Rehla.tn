import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import CrashTestPage from './pages/dev/CrashTestPage.jsx'
import HomePage from './pages/home/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        {import.meta.env.DEV && <Route path="test-erreur" element={<CrashTestPage />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
