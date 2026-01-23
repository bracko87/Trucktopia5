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
import StaffMarketPage from './pages/StaffMarket'
import MarketPage from './pages/Market'
import NewTrucksMarketPage from './pages/NewTrucksMarket'
import MyJobsPage from './pages/MyJobs'
import FinancesPage from './pages/Finances'
import MapPage from './pages/Map'

/* Settings pages (new) */
import SettingsProfilePage from './pages/Settings/Profile'
import SettingsInboxPage from './pages/Settings/Inbox'
import SettingsCustomizePage from './pages/Settings/CustomizeCompany'
import SettingsPreferencesPage from './pages/Settings/Preferences'
import SettingsHelpPage from './pages/Settings/Help'
import SettingsContactPage from './pages/Settings/Contact'
import SettingsInvitePage from './pages/Settings/Invite'
import SettingsProPage from './pages/Settings/Pro'
import { AuthProvider, useAuth } from './context/AuthContext'
import CargoIconSizeStyle from './components/CargoIconSizeStyle'
import PopupCleaner from './components/PopupCleaner'
import LocalizationPatch from './components/LocalizationPatch'
import ReturnToTrucksButtonInjector from './components/common/ReturnToTrucksButtonInjector'
import { GameTimeProvider } from './lib/time'
import React from 'react'
import './lib/safeInsertPatch'
import './lib/globalCityHelper'
import CityModal from './components/city/CityModal'
import CityClickHandler from './components/city/CityClickHandler'

/**
 * AppTimeWrapper
 *
 * Wraps children with GameTimeProvider using user's timezone or local preferences.
 *
 * @param props children React nodes to render within the time provider.
 * @returns JSX.Element
 */
function AppTimeWrapper({ children }: { children: React.ReactNode }) {
  // must be called inside AuthProvider
  const { user } = useAuth()
  const localPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem('app_preferences_v1') || '{}')
    } catch {
      return {}
    }
  })()
  const tz = user?.timeZone || localPrefs?.timeZone || 'UTC'
  return <GameTimeProvider timeZone={tz}>{children}</GameTimeProvider>
}

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
        <AppTimeWrapper>
          {/* Slight global style override for cargo icons (keeps layout unchanged) */}
          <CargoIconSizeStyle />

          {/* Apply runtime UI text replacement for a single confusing label */}
          <LocalizationPatch />

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/create-company" element={<CreateCompanyPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/trucks" element={<TrucksPage />} />
            <Route path="/trailers" element={<TrailersPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/staff-market" element={<StaffMarketPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/new-trucks-market" element={<NewTrucksMarketPage />} />
            <Route path="/my-jobs" element={<MyJobsPage />} />
            <Route path="/finances" element={<FinancesPage />} />
            <Route path="/map" element={<MapPage />} />

            {/* Settings pages */}
            <Route path="/settings/profile" element={<SettingsProfilePage />} />
            <Route path="/settings/inbox" element={<SettingsInboxPage />} />
            <Route path="/settings/customize" element={<SettingsCustomizePage />} />
            <Route path="/settings/preferences" element={<SettingsPreferencesPage />} />
            <Route path="/settings/help" element={<SettingsHelpPage />} />
            <Route path="/settings/contact" element={<SettingsContactPage />} />
            <Route path="/settings/invite" element={<SettingsInvitePage />} />
            <Route path="/settings/pro" element={<SettingsProPage />} />
          </Routes>

          {/* Global city click delegator (no UI) */}
          <CityClickHandler />

          {/* Global city modal (mounted once at app root) */}
          <CityModal />

          {/* Global helper to inject "Return to Trucks" buttons in some screens */}
          <ReturnToTrucksButtonInjector />

          <PopupCleaner />
        </AppTimeWrapper>
      </AuthProvider>
    </HashRouter>
  )
}