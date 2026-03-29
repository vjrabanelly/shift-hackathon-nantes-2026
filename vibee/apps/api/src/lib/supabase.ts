import { createClient } from '@supabase/supabase-js'
import { loadEnvFromProjectRoot } from '../env'

loadEnvFromProjectRoot()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
