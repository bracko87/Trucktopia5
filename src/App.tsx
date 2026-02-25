/**
 * App.tsx
 *
 * Main application routes.
 *
 * Defines top-level routes used by the SPA. Uses HashRouter for SPA routing
 * inside the iframe environment.
 *
 * Note:
 * - AuthProvider must be inside a Router so it can use useNavigate.
 */

import React from 'react'
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
import StagingAreaPage from './pages/StagingAreaPage'
import NewTrucksMarketPage from './pages/NewTrucksMarket'
import MyJobsPage from './pages/MyJobs'
import FinancesPage from './pages/Finances'
import MapPage from './pages/Map'
import FacilitiesPage from './pages/Facilities'
import ContractJobsPage from './pages/ContractJobs'

/* Settings pages */
import SettingsProfilePage from './pages/Settings/Profile'
import SettingsInboxPage from './pages/Settings/Inbox'
import SettingsCustomizePage from './pages/Settings/CustomizeCompany'
import SettingsPreferencesPage from './pages/Settings/Preferences'
import SettingsHelpPage from './pages/Settings/Help'
import SettingsContactPage from './pages/Settings/Contact'
import SettingsInvitePage from './pages/Settings/Invite'
import SettingsProPage from './pages/Settings/Pro'

import { AuthProvider, useAuth } from './context/AuthContext'
import { GameTimeProvider } from './lib/time'
import { StaffFilterProvider } from './context/StaffFilterContext'

import CargoIconSizeStyle from './components/CargoIconSizeStyle'
import PopupCleaner from './components/PopupCleaner'
import LocalizationPatch from './components/LocalizationPatch'
import ReturnToTrucksButtonInjector from './components/common/ReturnToTrucksButtonInjector'
import CityModal from './components/city/CityModal'
import CityClickHandler from './components/city/CityClickHandler'
import OpenAbortModalListener from './components/market/OpenAbortModalListener'
import AbortJobModal from './components/market/AbortJobModal'
/* Note: StaffCategoryInfoInjector import removed because the file was not resolvable
   If you want the injector re-enabled, restore the component file at:
   src/components/staff/StaffCategoryInfoInjector.tsx and re-add the import below. */

/**
 * InstallmentCostEmphasis
 *
 * Global DOM patcher used to emphasize installment cost text across the app.
 * It is intentionally mounted at the app root so it can operate on all pages.
 */
import InstallmentCostEmphasis from './components/finances/InstallmentCostEmphasis'

/**
 * LeaseTruckButtonHider
 *
 * Global helper that hides any button with aria-label="Lease Truck".
 */
import LeaseTruckButtonHider from './components/leases/LeaseTruckButtonHider'

/**
 * RemoveAssemblerBox
 *
 * Small runtime DOM patcher to remove an unwanted assembler summary box injected
 * by legacy UI code. See src/components/patches/RemoveAssemblerBox.tsx
 */
import RemoveAssemblerBox from './components/patches/RemoveAssemblerBox'

/**
 * HideQuickCreateButton
 *
 * Runtime DOM patcher to hide "Quick Create" buttons (preserves layout).
 */
import HideQuickCreateButton from './components/patches/HideQuickCreateButton'

import './lib/safeInsertPatch'
import './lib/removeChildSafePatch'
import './services/abortRpcPatch'
import './lib/globalCityHelper'
import './lib/legacyFixes'

/* Import small class color overrides (non-layout CSS only) */
import './styles/classColorOverrides.css'

/**
 * AppTimeWrapper
 *
 * Wraps children with GameTimeProvider using user's timezone or local preferences.
 *
 * @param props children React nodes to render within the time provider.
 * @returns JSX.Element
 */
function AppTimeWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  const localPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem('app_preferences_v1') || '{}')
    } catch {
      return {}
    }
  })()

  const tz = (user as any)?.timeZone || (localPrefs as any)?.timeZone || 'UTC'

  return <GameTimeProvider timeZone={tz}>{children}</GameTimeProvider>
}

/**
 * RouteTypographyPatch
 *
 * Runtime patch that upgrades route rows' typography and flag sizes to improve
 * visual hierarchy. Implemented as a separate patch component under
 * src/components/patches so we can keep the small changes non-invasive.
 */
import RouteTypographyPatch from './components/patches/RouteTypographyPatch'
import DeadlineColorPatch from './components/patches/DeadlineColorPatch'
import CountryOptionCasePatch from './components/patches/CountryOptionCasePatch'

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
        <StaffFilterProvider>
          <AppTimeWrapper>
            {/* Slight global style override for cargo icons (keeps layout unchanged) */}
            <CargoIconSizeStyle />

            {/* Apply runtime UI text replacement for a single confusing label */}
            <InstallmentCostEmphasis />

            {/* Hide any stray "Lease Truck" buttons globally */}
            <LeaseTruckButtonHider />

            {/* Remove unwanted assembler summary box */}
            <RemoveAssemblerBox />

            {/* Hide any dynamically-inserted "Quick Create" buttons (preserves layout) */}
            <HideQuickCreateButton />

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
              <Route path="/staging" element={<StagingAreaPage />} />
              <Route path="/facilities" element={<FacilitiesPage />} />
              <Route path="/contract-jobs" element={<ContractJobsPage />} />
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

            {/* Route typography/flag size patch */}
            <RouteTypographyPatch />
            {/* Patch legacy green timestamp spans globally (keeps layout unchanged) */}
            <DeadlineColorPatch />
            {/* Normalize fully-uppercase country options like "SERBIA" to "Serbia" */}
            <CountryOptionCasePatch />

            <PopupCleaner />
          </AppTimeWrapper>
        </StaffFilterProvider>
      </AuthProvider>
    </HashRouter>
  )
}