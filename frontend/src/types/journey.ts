export type ClientJourneyTemplate = {
  id: string
  name: string
  location: string
  journey_type: string
  description: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type JourneyAction = {
  text: string
  category: 'task' | 'note'
}

export type JourneyFormLink = {
  label: string
  url: string
  type: 'retool' | 'jotform' | 'canva' | 'whatsapp' | 'other'
}

export type ClientJourneyStep = {
  id: string
  journey_id: string
  step_number: number
  title: string
  description: string | null
  actions: JourneyAction[]
  assigned_role: string | null
  forms_links: JourneyFormLink[]
  color: string | null
  active: boolean
  days_from_start: number | null
  days_from_expiry: number | null
  min_membership_months: number | null
  created_at: string
  updated_at: string
}

export type ClientJourneyChangelog = {
  id: string
  journey_id: string
  step_id: string | null
  change_type: string
  field_changed: string | null
  old_value: any
  new_value: any
  changed_by: string
  notes: string | null
  created_at: string
}
