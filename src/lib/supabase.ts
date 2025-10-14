import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rpnwvaptbtpkislfxcbh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwbnd2YXB0YnRwa2lzbGZ4Y2JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MTgyMTAsImV4cCI6MjA3NDI5NDIxMH0.hRFtf0RRdFor9LOK7vedNeYGZp1lU2Btr6kuEcc3zvs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Member = {
  id: string
  email: string
  name: string
  current_cohort: string | null
  created_at: string
  updated_at: string
}

export type Circle = {
  circle_rep_whatsapp_contact: string
  circle_whatsapp_link: string
}

export type CurrentCohort = {
  id: number | null
  active: boolean
  nomenclature: string | null
  member_count: number | null
  taster_member_count: number | null
  main_group_link: string | null
  taster_group_link: string | null
  probation_page: string | null
  start_date: string | null
  end_date: string | null
  orientation_start_date: string | null
  taster_start_date: string | null
  taster_session_on: boolean
  circles: (Circle | string)[] | null
  created_at: string
  updated_at: string
  sermon_link: string | null
}

export type TasterMember = {
  id: string
  firstname: string | null
  lastname: string | null
  email: string | null
  satnumber: string | null
  current_cohort_id: number | null
  Gender: string | null
  Confirm_Phone_number: string | null
  Birthday: string | null
  total_submission: number | null
  sermon_submitted: boolean | null
}

export type MainMember = {
  id: string
  firstname: string | null
  lastname: string | null
  email: string | null
  phonenumber: string | null
  whatsapp: string | null
  bio: string | null
  fcmtoken: string | null
  partnerid: string | null
  repid: string | null
  role: string | null
  sanumber: string | null
  status: string | null
  circle_number: string | null
  probationvisits: number | null
  plancreated: boolean | null
  isincurrentcohort: boolean | null
  prevsanumbers: string[] | null
  previousgroups: string[] | null
  current_cohort_id: number | null
}

export type PlansMainAdventure = {
  id: string
  weeklytheme: string | null
  themeexposition: string | null
  theme: string | null
  resource1: string | null
  resource2: string | null
  resource3: string | null
  pauline: string | null
  confession: string | null
  meditation: string | null
  date: string | null
  created_at: string | null
  updated_at: string | null
  cohort_id: number | null
}

export type PlansTaster = {
  id: string
  confession: string | null
  date: string | null
  meditation: string | null
  pauline: string | null
  resource1: string | null
  resource2: string | null
  resource3: string | null
  theme: string | null
  themeexposition: string | null
  weeklytheme: string | null
  created_at: string | null
  updated_at: string | null
  cohort_id: number | null
}
