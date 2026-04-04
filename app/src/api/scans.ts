import { supabase } from '../lib/supabase'

const BACKEND_URL = 'http://172.20.10.3:8000'

export async function canScan(retake = false): Promise<{ allowed: boolean, reason: string, next_scan_in?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false, reason: 'not_logged_in' }

  const { data: lastScan } = await supabase
    .from('scans')
    .select('created_at')
    .eq('user_id', user.id)
    .eq('is_retake', false)
    .order('created_at', { ascending: false })
    .limit(1)

  const lastScanDate = lastScan?.[0]?.created_at || null

  const response = await fetch(`${BACKEND_URL}/can-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ last_scan_date: lastScanDate, retake }),
  })

  return response.json()
}

export async function submitScan(photoUri: string, isRetake = false): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

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

  // 2. Get all previous scans
  const { data: allScans } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const realScans = allScans?.filter(s => !s.is_retake) || []
  const lastRealScan = realScans[realScans.length - 1] || null
  const firstScan = realScans[0] || null

  const previousMeasurements = lastRealScan ? {
    shoulder_ratio: lastRealScan.shoulder_ratio,
    hip_ratio: lastRealScan.hip_ratio,
    waist_ratio: lastRealScan.waist_ratio,
  } : null

  // 3. Get user goals
  const { data: profile } = await supabase
    .from('profiles')
    .select('goals')
    .eq('id', user.id)
    .single()

  const goals = profile?.goals || []

  // 4. Calculate score with cycle number
  const scoreResponse = await fetch(`${BACKEND_URL}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current: measurements,
      previous: previousMeasurements,
      goals,
      first_scan_date: firstScan?.created_at || null,
      retake: isRetake,
    }),
  })

  const scoreData = await scoreResponse.json()

  // 5. Save scan — cycle number from backend, not total count
  const { data: savedScan, error } = await supabase
    .from('scans')
    .insert({
      user_id: user.id,
      week_number: scoreData.cycle_number,
      shoulder_ratio: measurements.shoulder_ratio,
      hip_ratio: measurements.hip_ratio,
      waist_ratio: measurements.waist_ratio,
      torso_px: measurements.torso_px,
      score: scoreData.score,
      is_retake: isRetake,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return {
    measurements,
    score: scoreData,
    cycleNumber: scoreData.cycle_number,
    isRetake,
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

export async function getLatestScore(): Promise<any | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_retake', false)
    .order('created_at', { ascending: false })
    .limit(1)

  return data?.[0] || null
}