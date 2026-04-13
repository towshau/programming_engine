import { useState } from 'react'
import type { ClientJourneyStep, JourneyAction, JourneyFormLink } from '../../types/journey'
import { Button } from '../../components/ui/Button'
import { useJourneyStore } from '../../stores/journeyStore'

interface JourneyStepEditorProps {
  step: ClientJourneyStep
  onClose: () => void
}

export function JourneyStepEditor({ step, onClose }: JourneyStepEditorProps) {
  const { updateStepField } = useJourneyStore()
  const [title, setTitle] = useState(step.title)
  const [assignedRole, setAssignedRole] = useState(step.assigned_role || '')
  const [actions, setActions] = useState<JourneyAction[]>(step.actions || [])
  const [formLinks, setFormLinks] = useState<JourneyFormLink[]>(step.forms_links || [])
  const [isSaving, setIsSaving] = useState(false)

  // Assuming admin name is hardcoded for now as per plan
  const adminName = 'Admin'

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (title !== step.title) await updateStepField(step.id, 'title', title, adminName)
      if (assignedRole !== step.assigned_role) await updateStepField(step.id, 'assigned_role', assignedRole, adminName)
      if (JSON.stringify(actions) !== JSON.stringify(step.actions)) await updateStepField(step.id, 'actions', actions, adminName)
      if (JSON.stringify(formLinks) !== JSON.stringify(step.forms_links)) await updateStepField(step.id, 'forms_links', formLinks, adminName)
      onClose()
    } catch (err) {
      console.error('Failed to save step:', err)
      alert('Failed to save step. See console for details.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)', borderWidth: 1 }}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Edit Step {step.step_number}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full p-2 border rounded-md"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Assigned Role</label>
            <input 
              type="text" 
              value={assignedRole} 
              onChange={e => setAssignedRole(e.target.value)}
              className="w-full p-2 border rounded-md"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--text)' }}>Actions</label>
              <button 
                onClick={() => setActions([...actions, { text: '', category: 'task' }])}
                className="text-xs text-[var(--color-gold)] font-medium hover:underline"
              >
                + Add Action
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((action, idx) => (
                <div key={idx} className="flex gap-2">
                  <select 
                    value={action.category}
                    onChange={e => {
                      const newActions = [...actions]
                      newActions[idx].category = e.target.value as 'task' | 'note'
                      setActions(newActions)
                    }}
                    className="p-2 border rounded-md text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                  >
                    <option value="task">Task</option>
                    <option value="note">Note</option>
                  </select>
                  <input 
                    type="text" 
                    value={action.text} 
                    onChange={e => {
                      const newActions = [...actions]
                      newActions[idx].text = e.target.value
                      setActions(newActions)
                    }}
                    className="flex-1 p-2 border rounded-md text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                    placeholder="Action description..."
                  />
                  <button 
                    onClick={() => setActions(actions.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:text-red-700 px-2"
                  >&times;</button>
                </div>
              ))}
              {actions.length === 0 && <div className="text-sm italic text-gray-400">No actions added.</div>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--text)' }}>Forms & Links</label>
              <button 
                onClick={() => setFormLinks([...formLinks, { label: '', url: '', type: 'other' }])}
                className="text-xs text-[var(--color-gold)] font-medium hover:underline"
              >
                + Add Link
              </button>
            </div>
            <div className="space-y-3">
              {formLinks.map((link, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-3 border rounded-md" style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={link.label} 
                      onChange={e => {
                        const newLinks = [...formLinks]
                        newLinks[idx].label = e.target.value
                        setFormLinks(newLinks)
                      }}
                      className="flex-1 p-2 border rounded-md text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                      placeholder="Link Label"
                    />
                    <select 
                      value={link.type}
                      onChange={e => {
                        const newLinks = [...formLinks]
                        newLinks[idx].type = e.target.value as any
                        setFormLinks(newLinks)
                      }}
                      className="p-2 border rounded-md text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                    >
                      <option value="retool">Retool</option>
                      <option value="jotform">Jotform</option>
                      <option value="canva">Canva</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="other">Other</option>
                    </select>
                    <button 
                      onClick={() => setFormLinks(formLinks.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 px-2"
                    >&times;</button>
                  </div>
                  <input 
                    type="url" 
                    value={link.url} 
                    onChange={e => {
                      const newLinks = [...formLinks]
                      newLinks[idx].url = e.target.value
                      setFormLinks(newLinks)
                    }}
                    className="w-full p-2 border rounded-md text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
                    placeholder="https://..."
                  />
                </div>
              ))}
              {formLinks.length === 0 && <div className="text-sm italic text-gray-400">No links added.</div>}
            </div>
          </div>
        </div>

        <div className="p-5 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} isLoading={isSaving}>Save Changes</Button>
        </div>
      </div>
    </div>
  )
}
