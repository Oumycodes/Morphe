import { supabase } from '../lib/supabase'

const BACKEND_URL = 'http://172.20.10.4:8000'
const SUPABASE_URL = 'https://znhvstcaltamvxqrlboe.supabase.co'

export async function canScan(retake = false): Promise<{ allowed: boolean, reason: string, next_scan_in?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { allowed: false, reason: 'not_logged_in' }
  const { data: lastScan } = await supabase
    .from('scans').select('created_at').eq('user_id', user.id).eq('is_retake', false)
    .order('created_at', { ascending: false }).limit(1)
  const response = await fetch(`${BACKEND_URL}/can-scan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ last_scan_date: lastScan?.[0]?.created_at || null, retake }),
  })
  return response.json()
}

async function sendBothPhotos(frontUri: string, sideUri: string): Promise<any> {
  const formData = new FormData()
  formData.append('front', { uri: frontUri, type: 'image/jpeg', name: 'front.jpg' } as any)
  formData.append('side', { uri: sideUri, type: 'image/jpeg', name: 'side.jpg' } as any)
  const response = await fetch(`${BACKEND_URL}/scan/both`, {
    method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' },
  })
  if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Scan failed') }
  return response.json()
}

async function uploadPhoto(userId: string, uri: string, label: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { console.log('No auth session for upload'); return null }

    const path = `${userId}/${label}_${Date.now()}.jpg`
    const formData = new FormData()
    formData.append('', { uri, type: 'image/jpeg', name: `${label}.jpg` } as any)

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/scan-photos/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'false',
      },
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      console.log(`Upload ${label} error (${res.status}):`, errText)
      return null
    }

    const { data } = supabase.storage.from('scan-photos').getPublicUrl(path)
    console.log(`Upload ${label} OK:`, data.publicUrl)
    return data.publicUrl
  } catch (e: any) {
    console.log(`Upload ${label} failed:`, e?.message)
    return null
  }
}

function goalToStrings(profile: any): string[] {
  const goalObj = profile?.goal
  if (goalObj?.type) {
    const map: Record<string, string> = { fat_loss: 'fat', muscle_gain: 'muscle', recomposition: 'recomp', general: 'overall' }
    return [map[goalObj.type] || '']
  }
  return profile?.goals || []
}

export async function submitScan(frontUri: string, sideUri: string, isRetake = false): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')

  const [bothResult, frontPhotoUrl, sidePhotoUrl] = await Promise.all([
    sendBothPhotos(frontUri, sideUri),
    uploadPhoto(user.id, frontUri, 'front'),
    uploadPhoto(user.id, sideUri, 'side'),
  ])
  const measurements = bothResult.measurements

  const { data: allScans } = await supabase
    .from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
  const realScans = allScans?.filter((s: any) => !s.is_retake) || []
  const firstScan = realScans[0] || null
  const lastRealScan = realScans[realScans.length - 1] || null

  const toMeasurements = (s: any) => s ? {
    shoulder_ratio: s.shoulder_ratio, hip_ratio: s.hip_ratio, waist_ratio: s.waist_ratio,
    glute_projection_ratio: s.glute_projection_ratio, waist_depth_ratio: s.waist_depth_ratio,
  } : null

  const previousMeasurements = toMeasurements(lastRealScan)
  const previousScore = lastRealScan?.score ?? null

  const { data: profile } = await supabase
    .from('profiles').select('goals, goal').eq('id', user.id).single()
  const goals = goalToStrings(profile)

  const scoreResponse = await fetch(`${BACKEND_URL}/score`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current: measurements, previous: previousMeasurements, goals,
      first_scan_date: firstScan?.created_at || null, retake: isRetake,
      previous_score: previousScore,
    }),
  })
  const scoreData = await scoreResponse.json()

  const { data: savedScan, error } = await supabase
    .from('scans').insert({
      user_id: user.id, week_number: scoreData.cycle_number,
      shoulder_ratio: measurements.shoulder_ratio, hip_ratio: measurements.hip_ratio,
      waist_ratio: measurements.waist_ratio, torso_px: measurements.torso_px,
      glute_projection_ratio: measurements.glute_projection_ratio,
      waist_depth_ratio: measurements.waist_depth_ratio,
      torso_px_side: measurements.torso_px_side || null,
      score: scoreData.score, narration: scoreData.narration || null,
      front_photo_url: frontPhotoUrl, side_photo_url: sidePhotoUrl,
      is_retake: isRetake,
    }).select().single()

  if (error) throw new Error(error.message)
  return { measurements, score: scoreData, cycleNumber: scoreData.cycle_number, isRetake, scan: savedScan }
}

export async function getLatestScans(limit = 10): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit)
  return data || []
}

export async function getLatestScore(): Promise<any | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('scans').select('*').eq('user_id', user.id).eq('is_retake', false)
    .order('created_at', { ascending: false }).limit(1)
  return data?.[0] || null
}