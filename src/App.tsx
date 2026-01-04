/**
 * App.tsx
 *
 * Main application routes.
 */

import { HashRouter, Routes, Route } from 'react-router'
import HomePage from './pages/Home'
import RegisterPage from './pages/Register'
import CreateCompanyPage from './pages/CreateCompany'
import DashboardPage from './pages/Dashboard'
import LoginPage from './pages/Login'
import SeedCitiesPage from './pages/SeedCities'
import { AuthProvider } from './context/AuthContext'

/**
 * App
 *
 * Defines application routes. Uses HashRouter for SPA routing inside the iframe environment.
 *
 * Note:
 * - AuthProvider must be inside a Router so it can use useNavigate.
 */
export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/create-company" element={<CreateCompanyPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
