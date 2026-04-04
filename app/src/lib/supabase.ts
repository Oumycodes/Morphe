import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://znhvstcaltamvxqrlboe.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuaHZzdGNhbHRhbXZ4cXJsYm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTY3MTgsImV4cCI6MjA5MDg3MjcxOH0.zMRfFCUQhXTxmPUGWNBqx3stIpf3la36vKtzBZ55IDw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})