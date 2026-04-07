import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ClientQueue } from './pages/ClientQueue'
import { Intake } from './pages/Intake'
import { ProgrammingEngine } from './pages/ProgrammingEngine'
import { HolidayPrograms } from './pages/HolidayPrograms'

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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
