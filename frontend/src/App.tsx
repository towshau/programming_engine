import { TopBar } from './components/layout/TopBar'
import { MemberSidebar } from './components/layout/MemberSidebar'
import { ProgramViewer } from './components/layout/ProgramViewer'

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <MemberSidebar />
        <ProgramViewer />
      </div>
    </div>
  )
}
