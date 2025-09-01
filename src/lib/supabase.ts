import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface ShoppingList {
  id: string
  user_id: string
  name: string
  original_list: string
  created_at: string
  updated_at: string
}

export interface ProcessedResult {
  id: string
  list_id: string
  result_data: any
  created_at: string
}