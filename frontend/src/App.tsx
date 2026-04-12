import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ClientQueue } from './pages/ClientQueue'
import { Intake } from './pages/Intake'
import { ProgrammingEngine } from './pages/ProgrammingEngine'
import { HolidayPrograms } from './pages/HolidayPrograms'
import { Workbook } from './pages/Workbook'
import { FormsPage } from './pages/FormsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ClientJourneyPage } from './pages/ClientJourneyPage'
import { ThreeSixtyPage } from './pages/ThreeSixtyPage'
import { ChurnRiskPage } from './pages/ChurnRiskPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<ClientQueue />} />
          <Route path="/intake" element={<Intake />} />
          <Route path="/intake/:memberId" element={<Intake />} />
          <Route path="/program" element={<ProgrammingEngine />} />
          <Route path="/program/:memberId" element={<ProgrammingEngine />} />
          <Route path="/holiday" element={<HolidayPrograms />} />
          <Route path="/workbook" element={<Workbook />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/client-journey" element={<ClientJourneyPage />} />
          <Route path="/360" element={<ThreeSixtyPage />} />
          <Route path="/churn-risk" element={<ChurnRiskPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
