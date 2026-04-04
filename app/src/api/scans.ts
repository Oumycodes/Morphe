import { supabase } from '../lib/supabase'

const BACKEND_URL = 'http://172.20.10.3:8000'

export async function submitScan(photoUri: string): Promise<any> {
  // 1. Send photo to backend for CV measurement
  const formData = new FormData()
  formData.append('file', { uri: photoUri, type: 'image/jpeg', name: 'scan.jpg' } as any)

  const response = await fetch(`${BACKEND_URL}/scan`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.detail || 'Scan failed')
  }

  const { measurements } = await response.json()

  // 2. Get user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

  // 3. Get previous scan for delta calculation
  const { data: prevScans } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const previousMeasurements = prevScans?.[0] ? {
    shoulder_ratio: prevScans[0].shoulder_ratio,
    hip_ratio: prevScans[0].hip_ratio,
    waist_ratio: prevScans[0].waist_ratio,
  } : null

  // 4. Get user goals
  const { data: profile } = await supabase
    .from('profiles')
    .select('goals')
    .eq('id', user.id)
    .single()

  const goals = profile?.goals || []

  // 5. Calculate score
  const scoreResponse = await fetch(`${BACKEND_URL}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current: measurements,
      previous: previousMeasurements,
      goals,
    }),
  })

  const scoreData = await scoreResponse.json()

  // 6. Save scan to Supabase
  const weekNumber = (prevScans?.length || 0) + 1

  const { data: savedScan, error } = await supabase
    .from('scans')
    .insert({
      user_id: user.id,
      week_number: weekNumber,
      shoulder_ratio: measurements.shoulder_ratio,
      hip_ratio: measurements.hip_ratio,
      waist_ratio: measurements.waist_ratio,
      torso_px: measurements.torso_px,
      score: scoreData.score,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return {
    measurements,
    score: scoreData,
    weekNumber,
    scan: savedScan,
  }
}

export async function getLatestScans(limit = 10): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data || []
}