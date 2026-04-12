import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { ClientJourneyTemplate, ClientJourneyStep, ClientJourneyChangelog } from '../types/journey'

export type MembershipLength = 3 | 6 | 12

type JourneyState = {
  // Data
  templates: ClientJourneyTemplate[]
  steps: ClientJourneyStep[]
  changelog: ClientJourneyChangelog[]
  
  // UI State
  loading: boolean
  error: string | null
  selectedLocation: string
  selectedType: string
  editMode: boolean
  selectedMembershipLength: MembershipLength
  headerCollapsed: boolean
  showTimeline: boolean
  
  // Actions
  fetchJourneys: () => Promise<void>
  setLocationFilter: (location: string) => void
  setTypeFilter: (type: string) => void
  setEditMode: (mode: boolean) => void
  setMembershipLength: (length: MembershipLength) => void
  toggleHeader: () => void
  toggleTimeline: () => void
  
  // Mutations
  updateStepField: (stepId: string, field: keyof ClientJourneyStep, newValue: any, adminName: string) => Promise<void>
}

export const useJourneyStore = create<JourneyState>((set, get) => ({
  templates: [],
  steps: [],
  changelog: [],
  
  loading: false,
  error: null,
  selectedLocation: 'All',
  selectedType: 'All',
  editMode: false,
  selectedMembershipLength: 6,
  headerCollapsed: true,
  showTimeline: true,
  
  setLocationFilter: (location) => set({ selectedLocation: location }),
  setTypeFilter: (type) => set({ selectedType: type }),
  setEditMode: (mode) => set({ editMode: mode }),
  setMembershipLength: (length) => set({ selectedMembershipLength: length }),
  toggleHeader: () => set((s) => ({ headerCollapsed: !s.headerCollapsed })),
  toggleTimeline: () => set((s) => ({ showTimeline: !s.showTimeline })),
  
  fetchJourneys: async () => {
    set({ loading: true, error: null })
    try {
      // 1. Fetch templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('client_journey_templates')
        .select('*')
        .order('created_at', { ascending: true })
      
      if (templatesError) throw templatesError

      // 2. Fetch steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('client_journey_steps')
        .select('*')
        .order('step_number', { ascending: true })
      
      if (stepsError) throw stepsError

      // 3. Fetch changelog
      const { data: changelogData, error: changelogError } = await supabase
        .from('client_journey_changelog')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (changelogError) throw changelogError

      set({
        templates: templatesData as ClientJourneyTemplate[],
        steps: stepsData as ClientJourneyStep[],
        changelog: changelogData as ClientJourneyChangelog[],
        loading: false
      })
    } catch (err: any) {
      console.error('Error fetching journey data:', err)
      set({ error: err.message, loading: false })
    }
  },
  
  updateStepField: async (stepId, field, newValue, adminName) => {
    const { steps, changelog } = get()
    const step = steps.find(s => s.id === stepId)
    if (!step) return

    const oldValue = step[field]
    
    // Check if value actually changed (simple check)
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return

    try {
      // 1. Update the step
      const { error: updateError } = await supabase
        .from('client_journey_steps')
        .update({ [field]: newValue })
        .eq('id', stepId)

      if (updateError) throw updateError

      // 2. Insert changelog
      const changeEntry = {
        journey_id: step.journey_id,
        step_id: step.id,
        change_type: 'step_updated',
        field_changed: field,
        old_value: oldValue,
        new_value: newValue,
        changed_by: adminName,
        notes: `Updated ${field}`
      }

      const { data: newChangelogRow, error: logError } = await supabase
        .from('client_journey_changelog')
        .insert([changeEntry])
        .select()
        .single()

      if (logError) throw logError

      // 3. Update local state
      const updatedSteps = steps.map(s => 
        s.id === stepId ? { ...s, [field]: newValue } : s
      )
      
      set({ 
        steps: updatedSteps,
        changelog: [newChangelogRow as ClientJourneyChangelog, ...changelog] 
      })

    } catch (err: any) {
      console.error('Error updating step:', err)
      // Could set error state here, but for now just throw or ignore
      throw err
    }
  }
}))
