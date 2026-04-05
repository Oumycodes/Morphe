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

async function sendPhoto(uri: string, endpoint: string): Promise<any> {
  const formData = new FormData()
  formData.append('file', { uri, type: 'image/jpeg', name: 'scan.jpg' } as any)
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.detail || 'Scan failed')
  }
  return response.json()
}

export async function submitScan(
  frontUri: string,
  sideUri: string,
  isRetake = false
): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

  const [frontResult, sideResult] = await Promise.all([
    sendPhoto(frontUri, '/scan/front'),
    sendPhoto(sideUri, '/scan/side'),
  ])

  const measurements = {
    ...frontResult.measurements,
    ...sideResult.measurements,
  }

  const { data: allScans } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const realScans = allScans?.filter((s: any) => !s.is_retake) || []
  const lastRealScan = realScans[realScans.length - 1] || null
  const firstScan = realScans[0] || null

  const previousMeasurements = lastRealScan ? {
    shoulder_ratio: lastRealScan.shoulder_ratio,
    hip_ratio: lastRealScan.hip_ratio,
    waist_ratio: lastRealScan.waist_ratio,
    glute_projection_ratio: lastRealScan.glute_projection_ratio,
    waist_depth_ratio: lastRealScan.waist_depth_ratio,
  } : null

  const { data: profile } = await supabase
    .from('profiles')
    .select('goals')
    .eq('id', user.id)
    .single()

  const goals = profile?.goals || []

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

  const { data: savedScan, error } = await supabase
    .from('scans')
    .insert({
      user_id: user.id,
      week_number: scoreData.cycle_number,
      shoulder_ratio: measurements.shoulder_ratio,
      hip_ratio: measurements.hip_ratio,
      waist_ratio: measurements.waist_ratio,
      torso_px: measurements.torso_px,
      glute_projection_ratio: measurements.glute_projection_ratio,
      waist_depth_ratio: measurements.waist_depth_ratio,
      torso_px_side: measurements.torso_px_side,
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