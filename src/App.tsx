/**
 * App.tsx
 *
 * Main application routes.
 *
 * Defines top-level routes used by the SPA. Uses HashRouter for SPA routing inside the iframe environment.
 *
 * Note:
 * - AuthProvider must be inside a Router so it can use useNavigate.
 */

import { HashRouter, Routes, Route } from 'react-router'
import HomePage from './pages/Home'
import RegisterPage from './pages/Register'
import CreateCompanyPage from './pages/CreateCompany'
import DashboardPage from './pages/Dashboard'
import LoginPage from './pages/Login'
import TrucksPage from './pages/Trucks'
import TrailersPage from './pages/Trailers'
import StaffPage from './pages/Staff'
import MarketPage from './pages/Market'
import NewTrucksMarketPage from './pages/NewTrucksMarket'
import MyJobsPage from './pages/MyJobs'
import FinancesPage from './pages/Finances'
import MapPage from './pages/Map'
import { AuthProvider } from './context/AuthContext'

/**
 * App
 *
 * Defines application routes. Uses HashRouter for SPA routing inside the iframe environment.
 *
 * @returns The application router with routes for available pages.
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
          <Route path="/trucks" element={<TrucksPage />} />
          <Route path="/trailers" element={<TrailersPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/new-trucks-market" element={<NewTrucksMarketPage />} />
          <Route path="/my-jobs" element={<MyJobsPage />} />
          <Route path="/finances" element={<FinancesPage />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
