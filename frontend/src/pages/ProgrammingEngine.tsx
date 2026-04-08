import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditorStore } from '../stores/editorStore'
import { ProgramViewer } from '../components/layout/ProgramViewer'
import { MemberSidebar } from '../components/layout/MemberSidebar'

export function ProgrammingEngine() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { members, selectedMember, selectMember, loading } = useEditorStore()

  // When navigating here with a memberId in the URL, auto-select that member
  useEffect(() => {
    if (!memberId) return
    if (selectedMember?.member_id === memberId) return

    // Wait for members to load before selecting
    if (loading.members) return

    const match = members.find((m) => m.member_id === memberId)
    if (match) {
      selectMember(match)
    }
  }, [memberId, members, selectedMember, selectMember, loading.members])

  // When a member is selected in the sidebar, update the URL
  function handleSelectMember(member: Parameters<typeof selectMember>[0]) {
    selectMember(member)
    if (member) {
      navigate(`/program/${member.member_id}`, { replace: true })
    } else {
      navigate('/program', { replace: true })
    }
  }

  return (
    <div className="flex h-full">
      <MemberSidebar onSelectMember={handleSelectMember} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ProgramViewer />
      </div>
    </div>
  )
}
