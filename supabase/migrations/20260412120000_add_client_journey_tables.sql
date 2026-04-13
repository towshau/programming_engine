-- Migration: Add Client Journey Tables

-- 1. Create Tables
CREATE TABLE client_journey_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    journey_type TEXT NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE client_journey_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES client_journey_templates(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    actions JSONB DEFAULT '[]'::jsonb,
    assigned_role TEXT,
    forms_links JSONB DEFAULT '[]'::jsonb,
    color TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE client_journey_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id UUID NOT NULL REFERENCES client_journey_templates(id) ON DELETE CASCADE,
    step_id UUID REFERENCES client_journey_steps(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL,
    field_changed TEXT,
    old_value JSONB,
    new_value JSONB,
    changed_by TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_client_journey_steps_journey_id ON client_journey_steps(journey_id);
CREATE INDEX idx_client_journey_changelog_journey_id ON client_journey_changelog(journey_id);
CREATE INDEX idx_client_journey_changelog_step_id ON client_journey_changelog(step_id);

-- Updated_at Trigger setup
CREATE OR REPLACE FUNCTION update_client_journey_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_client_journey_templates_updated_at
BEFORE UPDATE ON client_journey_templates
FOR EACH ROW EXECUTE FUNCTION update_client_journey_updated_at();

CREATE TRIGGER trg_client_journey_steps_updated_at
BEFORE UPDATE ON client_journey_steps
FOR EACH ROW EXECUTE FUNCTION update_client_journey_updated_at();

-- Enable RLS
ALTER TABLE client_journey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_journey_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_journey_changelog ENABLE ROW LEVEL SECURITY;

-- Create Policies (allow full access for authenticated users/service role as per existing pattern)
CREATE POLICY "Allow read access to all users" ON client_journey_templates FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON client_journey_templates FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow read access to all users" ON client_journey_steps FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON client_journey_steps FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow read access to all users" ON client_journey_changelog FOR SELECT USING (true);
CREATE POLICY "Allow all access to authenticated users" ON client_journey_changelog FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 2. Seed Data
-- Insert Templates
INSERT INTO client_journey_templates (id, name, location, journey_type, description) VALUES
('00000000-0000-4000-a000-000000000001', 'Sydney New Member Journey', 'NSW', 'new_member', 'Standard 8-step journey for new members in Sydney'),
('00000000-0000-4000-a000-000000000002', 'Sydney Renewal Journey', 'NSW', 'renewal', 'Standard 4-step renewal journey for members in Sydney'),
('00000000-0000-4000-a000-000000000003', 'Melbourne New Member Journey', 'VIC', 'new_member', 'Standard 8-step journey for new members in Melbourne'),
('00000000-0000-4000-a000-000000000004', 'Melbourne Renewal Journey', 'VIC', 'renewal', 'Standard 4-step renewal journey for members in Melbourne');

-- Insert Steps
-- Sydney New Member (Journey 1)
INSERT INTO client_journey_steps (journey_id, step_number, title, assigned_role, actions, forms_links, color) VALUES
('00000000-0000-4000-a000-000000000001', 1, 'Point of Sale', 'Sales team; Head coach / programming team (for first program)', 
'[
  {"text": "In-body scan + consults form", "category": "task"},
  {"text": "#consults -> #programming-sydney -> first program", "category": "task"},
  {"text": "#clientworkbook -> coach notified", "category": "task"},
  {"text": "Within 24h: Coach video intro, WhatsApp (Penn), Team Builder, Wellness Living, Salto", "category": "task"}
]'::jsonb, 
'[{"label": "New Sales Form", "url": "https://lockeroomgym.retool.com/embedded/public/88a06e52-86dd-4412-93ff-797219a75a19", "type": "retool"}]'::jsonb, '#E2E8F0'),

('00000000-0000-4000-a000-000000000001', 2, 'Nutrition onboarding call', 'Relationship manager — Onboarding call, 12-week check-in; Head of admin — App set up', 
'[
  {"text": "RM / nutrition team call", "category": "task"},
  {"text": "Habits, expectations, WhatsApp group", "category": "task"},
  {"text": "Basic skills, book 12-week check-in (Google link)", "category": "task"},
  {"text": "Before first session", "category": "note"}
]'::jsonb, 
'[
  {"label": "Nutrition Onboarding Call Deck", "url": "https://www.canva.com/design/DAGhYq_VImM/uiiA1Iw8q8emwO-j4qHBlA/view?utm_content=DAGhYq_VImM&utm_campaign=designshare&utm_medium=link&utm_source=viewer", "type": "other"},
  {"label": "WhatsApp Tech Set Up", "url": "https://wa.me/61422983020", "type": "other"}
]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000001', 3, 'First session / physicals', 'Miscellaneous coach — Any coach on the gym floor', 
'[
  {"text": "Physical assessment (1:1)", "category": "task"},
  {"text": "Longevity fitness test, baseline", "category": "task"},
  {"text": "Summary -> RM, physicals, programming", "category": "task"},
  {"text": "Normal training begins", "category": "note"}
]'::jsonb, 
'[{"label": "First Physicals Form", "url": "https://lockeroomgym.retool.com/embedded/public/6e6ef0ca-577d-4778-9d1e-62934c5559d6", "type": "retool"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000001', 4, '30-day review call', 'Gym manager', 
'[
  {"text": "Gym manager review", "category": "task"},
  {"text": "End of cool-off / 30-day refund period", "category": "note"}
]'::jsonb, 
'[{"label": "30-Day Review Resources", "url": "https://lockeroomgym.retool.com/embedded/public/eba449a8-d38b-4121-b2e6-8d4675f2a872", "type": "retool"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000001', 5, '12-week check-in', 'Relationship manager', 
'[
  {"text": "Progress summary", "category": "task"},
  {"text": "2 in-body scans done by now", "category": "task"}
]'::jsonb, 
'[{"label": "12 Week Check In Call Deck", "url": "https://canva.link/xadzjehwq8qjn0v", "type": "other"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000001', 6, '6-week pre-renewal call', 'Renewal lead', 
'[
  {"text": "Pre-renewal call", "category": "task"},
  {"text": "Renewal lead", "category": "note"}
]'::jsonb, 
'[{"label": "Pre Renewal Call", "url": "https://lockeroomgym.retool.com/embedded/public/6540a4a2-0514-45d7-b019-826cbca4ecf1", "type": "retool"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000001', 7, 'Renewal sit down', 'Renewal lead', 
'[
  {"text": "Sit down, complete renewal (3-4 weeks before renewal date)", "category": "task"}
]'::jsonb, 
'[{"label": "Renewal Sit Down Resources", "url": "https://canva.link/oncl2raux8ss7ck", "type": "other"}]'::jsonb, '#DCFCE7'),

('00000000-0000-4000-a000-000000000001', 8, 'Renewed member', 'Relationship manager', 
'[
  {"text": "See Renewal client journey", "category": "note"}
]'::jsonb, 
'[]'::jsonb, '#DCFCE7');

-- Sydney Renewal (Journey 2)
INSERT INTO client_journey_steps (journey_id, step_number, title, assigned_role, actions, forms_links, color) VALUES
('00000000-0000-4000-a000-000000000002', 1, '3-month check-in call', 'Renewal assignee', 
'[
  {"text": "Only if member signed up for 6-month membership", "category": "note"}
]'::jsonb, 
'[{"label": "3 Month and 9 Month Check ins", "url": "https://lockeroomgym.retool.com/embedded/public/b4982ee9-0b0c-43d4-a816-7bd0b3c5e9ab", "type": "retool"}]'::jsonb, '#F3E8FF'),

('00000000-0000-4000-a000-000000000002', 2, '9-month check-in call', 'Renewal assignee', 
'[
  {"text": "Included if member purchases 12-month membership", "category": "note"}
]'::jsonb, 
'[{"label": "3 Month and 9 Month Check ins", "url": "https://lockeroomgym.retool.com/embedded/public/b4982ee9-0b0c-43d4-a816-7bd0b3c5e9ab", "type": "retool"}]'::jsonb, '#F3E8FF'),

('00000000-0000-4000-a000-000000000002', 3, '6-week pre-renewal call', 'Renewal lead', 
'[
  {"text": "Renewal lead", "category": "note"}
]'::jsonb, 
'[{"label": "Pre Renewal Call", "url": "https://lockeroomgym.retool.com/embedded/public/6540a4a2-0514-45d7-b019-826cbca4ecf1", "type": "retool"}]'::jsonb, '#F3E8FF'),

('00000000-0000-4000-a000-000000000002', 4, 'Sit down renewal', 'Renewal lead', 
'[
  {"text": "Complete renewal", "category": "task"}
]'::jsonb, 
'[{"label": "Renewal Form", "url": "https://lockeroomgym.retool.com/embedded/public/9356aaab-fc1e-4f87-a57f-026c0ef3f008", "type": "retool"}]'::jsonb, '#DCFCE7');

-- Melbourne New Member (Journey 3)
INSERT INTO client_journey_steps (journey_id, step_number, title, assigned_role, actions, forms_links, color) VALUES
('00000000-0000-4000-a000-000000000003', 1, 'Point of Sale', 'Sales team; Head coach / programming team (for first program)', 
'[
  {"text": "In-body scan + consults form", "category": "task"},
  {"text": "#consults -> #programming-melbourne -> first program", "category": "task"},
  {"text": "#clientworkbook -> coach notified", "category": "task"},
  {"text": "Within 24h: Coach video intro, WhatsApp (Penn), Team Builder, Wellness Living, Salto", "category": "task"}
]'::jsonb, 
'[{"label": "New Sales Form", "url": "https://lockeroomgym.retool.com/embedded/public/88a06e52-86dd-4412-93ff-797219a75a19", "type": "retool"}]'::jsonb, '#E2E8F0'),

('00000000-0000-4000-a000-000000000003', 2, 'Nutrition onboarding call', 'Relationship manager — Onboarding call, 12-week check-in; Head of admin — App set up', 
'[
  {"text": "RM / nutrition team call", "category": "task"},
  {"text": "Habits, expectations, WhatsApp group", "category": "task"},
  {"text": "Basic skills, book 12-week check-in (Google link)", "category": "task"},
  {"text": "Before first session", "category": "note"}
]'::jsonb, 
'[
  {"label": "Nutrition Onboarding Call Deck", "url": "https://www.canva.com/design/DAGhYq_VImM/uiiA1Iw8q8emwO-j4qHBlA/view?utm_content=DAGhYq_VImM&utm_campaign=designshare&utm_medium=link&utm_source=viewer", "type": "other"},
  {"label": "WhatsApp Tech Set Up", "url": "https://wa.me/61422983020", "type": "other"}
]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000003', 3, 'First session / physicals', 'Miscellaneous coach — Any coach on the gym floor', 
'[
  {"text": "Physical assessment (1:1)", "category": "task"},
  {"text": "Longevity fitness test, baseline", "category": "task"},
  {"text": "Summary -> RM, physicals, programming", "category": "task"},
  {"text": "Normal training begins", "category": "note"}
]'::jsonb, 
'[{"label": "First Physicals Form", "url": "https://lockeroomgym.retool.com/embedded/public/6e6ef0ca-577d-4778-9d1e-62934c5559d6", "type": "retool"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000003', 4, '30-day review call', 'Gym manager', 
'[
  {"text": "Gym manager review", "category": "task"},
  {"text": "End of cool-off / 30-day refund period", "category": "note"}
]'::jsonb, 
'[{"label": "30-Day Review Resources", "url": "https://lockeroomgym.retool.com/embedded/public/eba449a8-d38b-4121-b2e6-8d4675f2a872", "type": "retool"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000003', 5, '12-week check-in', 'Relationship manager', 
'[
  {"text": "Progress summary", "category": "task"},
  {"text": "2 in-body scans done by now", "category": "task"}
]'::jsonb, 
'[{"label": "12 Week Check In Call Deck", "url": "https://canva.link/xadzjehwq8qjn0v", "type": "other"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000003', 6, '6-week pre-renewal call', 'Renewal lead', 
'[
  {"text": "Pre-renewal call", "category": "task"},
  {"text": "Renewal lead", "category": "note"}
]'::jsonb, 
'[{"label": "Pre Renewal Call", "url": "https://lockeroomgym.retool.com/embedded/public/6540a4a2-0514-45d7-b019-826cbca4ecf1", "type": "retool"}]'::jsonb, '#FEF3C7'),

('00000000-0000-4000-a000-000000000003', 7, 'Renewal sit down', 'Renewal lead', 
'[
  {"text": "Sit down, complete renewal (3-4 weeks before renewal date)", "category": "task"}
]'::jsonb, 
'[{"label": "Renewal Sit Down Resources", "url": "https://canva.link/oncl2raux8ss7ck", "type": "other"}]'::jsonb, '#DCFCE7'),

('00000000-0000-4000-a000-000000000003', 8, 'Renewed member', 'Relationship manager', 
'[
  {"text": "See Renewal client journey", "category": "note"}
]'::jsonb, 
'[]'::jsonb, '#DCFCE7');

-- Melbourne Renewal (Journey 4)
INSERT INTO client_journey_steps (journey_id, step_number, title, assigned_role, actions, forms_links, color) VALUES
('00000000-0000-4000-a000-000000000004', 1, '3-month check-in call', 'Renewal assignee', 
'[
  {"text": "Only if member signed up for 6-month membership", "category": "note"}
]'::jsonb, 
'[{"label": "3 Month and 9 Month Check ins", "url": "https://lockeroomgym.retool.com/embedded/public/b4982ee9-0b0c-43d4-a816-7bd0b3c5e9ab", "type": "retool"}]'::jsonb, '#F3E8FF'),

('00000000-0000-4000-a000-000000000004', 2, '9-month check-in call', 'Renewal assignee', 
'[
  {"text": "Included if member purchases 12-month membership", "category": "note"}
]'::jsonb, 
'[{"label": "3 Month and 9 Month Check ins", "url": "https://lockeroomgym.retool.com/embedded/public/b4982ee9-0b0c-43d4-a816-7bd0b3c5e9ab", "type": "retool"}]'::jsonb, '#F3E8FF'),

('00000000-0000-4000-a000-000000000004', 3, '6-week pre-renewal call', 'Renewal lead', 
'[
  {"text": "Renewal lead", "category": "note"}
]'::jsonb, 
'[{"label": "Pre Renewal Call", "url": "https://lockeroomgym.retool.com/embedded/public/6540a4a2-0514-45d7-b019-826cbca4ecf1", "type": "retool"}]'::jsonb, '#F3E8FF'),

('00000000-0000-4000-a000-000000000004', 4, 'Sit down renewal', 'Renewal lead', 
'[
  {"text": "Complete renewal", "category": "task"}
]'::jsonb, 
'[{"label": "Renewal Form", "url": "https://lockeroomgym.retool.com/embedded/public/9356aaab-fc1e-4f87-a57f-026c0ef3f008", "type": "retool"}]'::jsonb, '#DCFCE7');