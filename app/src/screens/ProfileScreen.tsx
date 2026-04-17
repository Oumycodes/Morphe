import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Image, Dimensions } from 'react-native'
import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../lib/supabase'
import { getLatestScans } from '../api/scans'

const screenW = Dimensions.get('window').width

const c = {
  bg: '#0A0E17', card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.06)',
  primary: '#1746A2', primaryTint: 'rgba(23,70,162,0.12)', primaryBorder: 'rgba(23,70,162,0.2)',
  text: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', muted: 'rgba(255,255,255,0.4)',
  hint: 'rgba(255,255,255,0.25)', border: 'rgba(255,255,255,0.06)', red: '#DC2626',
}

const GOAL_LABELS: Record<string, string> = { fat_loss: 'Lose fat', muscle_gain: 'Build muscle', recomposition: 'Body recomposition' }
const MUSCLE_LABELS: Record<string, string> = { shoulders: 'Shoulders', hips: 'Hips', glutes: 'Glutes' }

function getWeightLabel(weights: any) {
  if (!weights) return 'Balanced'
  if (weights.fat === 0.6) return 'Fat focused'
  if (weights.muscle === 0.6) return 'Muscle focused'
  return 'Balanced'
}
function getScoreColor(score: number) {
  if (score >= 80) return '#16A34A'; if (score >= 60) return '#CA8A04'; if (score >= 40) return '#EA580C'; return '#DC2626'
}

// ── Photo comparison ─────────────────────────────────────────────────────────

function PhotoSection({ scans }: { scans: any[] }) {
  const withPhotos = scans.filter(s => !s.is_retake && s.front_photo_url).sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const [viewType, setViewType] = useState<'front' | 'side'>('front')
  const [compareIdx, setCompareIdx] = useState(0)

  const photoW = (screenW - 72) / 2

  // Empty state
  if (withPhotos.length < 2) {
    return (
      <View style={s.section}>
        <Text style={s.sectionLabel}>YOUR PHOTOS</Text>
        <View style={s.photoCard}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={[s.photoPlaceholder, { width: photoW, height: photoW * 1.3 }]}>
              {withPhotos.length >= 1 ? (
                <>
                  <Image source={{ uri: withPhotos[0].front_photo_url }} style={[s.photoImg, { width: photoW, height: photoW * 1.3 }]} resizeMode="cover" />
                  <View style={s.photoOverlayLabel}><Text style={s.photoOverlayText}>W{withPhotos[0].week_number || 1}</Text></View>
                </>
              ) : (
                <>
                  <View style={s.placeholderIcon}><Text style={{ fontSize: 24 }}>📷</Text></View>
                  <Text style={s.placeholderText}>Before</Text>
                </>
              )}
            </View>
            <View style={[s.photoPlaceholder, { width: photoW, height: photoW * 1.3 }]}>
              <View style={s.placeholderIcon}><Text style={{ fontSize: 24 }}>📷</Text></View>
              <Text style={s.placeholderText}>{withPhotos.length === 0 ? 'After' : 'Next scan'}</Text>
            </View>
          </View>
          <Text style={s.photoHint}>
            {withPhotos.length === 0
              ? 'Your scan photos will appear here for side-by-side comparison.'
              : 'One more scan to unlock before/after comparison.'}
          </Text>
        </View>
      </View>
    )
  }

  // Full comparison
  const baseline = withPhotos[0]
  const current = withPhotos[withPhotos.length - 1]
  const compareOptions = withPhotos.slice(0, -1)
  const compareScan = compareOptions[compareIdx] || baseline
  const photoKey = viewType === 'front' ? 'front_photo_url' : 'side_photo_url'
  const beforeUrl = compareScan[photoKey]
  const afterUrl = current[photoKey]

  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>YOUR PHOTOS</Text>
      <View style={s.photoCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={s.photoCardTitle}>Before / After</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity style={[s.viewToggle, viewType === 'front' && s.viewToggleActive]} onPress={() => setViewType('front')}>
              <Text style={[s.viewToggleText, viewType === 'front' && s.viewToggleTextActive]}>Front</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.viewToggle, viewType === 'side' && s.viewToggleActive]} onPress={() => setViewType('side')}>
              <Text style={[s.viewToggleText, viewType === 'side' && s.viewToggleTextActive]}>Side</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={s.photoWeekLabel}>WEEK {compareScan.week_number || 1}</Text>
            {beforeUrl ? (
              <Image source={{ uri: beforeUrl }} style={[s.photoImg, { width: photoW, height: photoW * 1.3 }]} resizeMode="cover" />
            ) : (
              <View style={[s.photoPlaceholder, { width: photoW, height: photoW * 1.3 }]}>
                <Text style={s.placeholderText}>No {viewType}</Text>
              </View>
            )}
            <Text style={s.photoSubLabel}>Before</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.photoWeekLabel, { color: c.primary }]}>WEEK {current.week_number || '?'}</Text>
            {afterUrl ? (
              <Image source={{ uri: afterUrl }} style={[s.photoImg, { width: photoW, height: photoW * 1.3, borderColor: c.primaryBorder }]} resizeMode="cover" />
            ) : (
              <View style={[s.photoPlaceholder, { width: photoW, height: photoW * 1.3 }]}>
                <Text style={s.placeholderText}>No {viewType}</Text>
              </View>
            )}
            <Text style={[s.photoSubLabel, { color: c.primary }]}>Current</Text>
          </View>
        </View>

        {compareOptions.length > 1 && (
          <View style={{ marginTop: 10, alignItems: 'center' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
              {compareOptions.map((scan: any, i: number) => (
                <TouchableOpacity key={i} style={[s.weekDot, compareIdx === i && s.weekDotActive]} onPress={() => setCompareIdx(i)}>
                  <Text style={[s.weekDotText, compareIdx === i && s.weekDotTextActive]}>W{scan.week_number || i + 1}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ fontSize: 10, color: c.hint, marginTop: 6 }}>Compare against</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

interface Props { onEditGoal: () => void }

export default function ProfileScreen({ onEditGoal }: Props) {
  const [email, setEmail] = useState('')
  const [goal, setGoal] = useState<any>(null)
  const [scans, setScans] = useState<any[]>([])
  const [scanCount, setScanCount] = useState(0)
  const [latestScore, setLatestScore] = useState<number | null>(null)
  const [firstScanDate, setFirstScanDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || '')
      const { data: profile } = await supabase.from('profiles').select('goal').eq('id', user.id).single()
      setGoal(profile?.goal || null)
      const allScans = await getLatestScans(50)
      setScans(allScans)
      const real = allScans.filter((s: any) => !s.is_retake)
      setScanCount(real.length)
      if (real.length > 0) {
        setLatestScore(real[0].score)
        setFirstScanDate(real[real.length - 1].created_at)
      }
    } catch (e) { console.log('Profile load error:', e) }
    finally { setLoading(false) }
  }

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }
  const handleDeleteData = () => {
    Alert.alert('Reset all data', 'This deletes all scans and your goal. Can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          await supabase.from('scans').delete().eq('user_id', user.id)
          await supabase.from('profiles').update({ goal: null }).eq('id', user.id)
          await supabase.auth.signOut()
        } catch (e) { console.log('Delete error:', e) }
      }},
    ])
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const weeksTracking = () => {
    if (!firstScanDate) return 0
    return Math.max(1, Math.ceil((Date.now() - new Date(firstScanDate).getTime()) / (7 * 24 * 60 * 60 * 1000)))
  }

  if (loading) return <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: c.muted }}>Loading...</Text></View>

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Profile</Text>

        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <View style={s.card}>
            <View style={s.avatar}><Text style={s.avatarLetter}>{(email[0] || 'M').toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.emailText}>{email}</Text>
              <Text style={s.memberSince}>{firstScanDate ? `Tracking since ${formatDate(firstScanDate)}` : 'No scans yet'}</Text>
            </View>
          </View>
        </View>

        {scanCount > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>STATS</Text>
            <View style={s.statsRow}>
              <View style={s.statCard}><Text style={s.statValue}>{scanCount}</Text><Text style={s.statLabel}>Scans</Text></View>
              <View style={s.statCard}><Text style={s.statValue}>{weeksTracking()}</Text><Text style={s.statLabel}>Weeks</Text></View>
              <View style={s.statCard}>
                <Text style={[s.statValue, latestScore != null && { color: getScoreColor(latestScore) }]}>{latestScore != null ? latestScore : '—'}</Text>
                <Text style={s.statLabel}>Score</Text>
              </View>
            </View>
          </View>
        )}

        <PhotoSection scans={scans} />

        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionLabel}>YOUR GOAL</Text>
            <TouchableOpacity onPress={onEditGoal}><Text style={s.editLink}>Edit</Text></TouchableOpacity>
          </View>
          {goal?.type ? (
            <View style={s.goalCard}>
              <View style={s.goalRow}><Text style={s.goalLabel}>Goal</Text><Text style={s.goalValue}>{GOAL_LABELS[goal.type] || goal.type}</Text></View>
              {goal.target_muscles?.length > 0 && <View style={s.goalRow}><Text style={s.goalLabel}>Target muscles</Text><Text style={s.goalValue}>{goal.target_muscles.map((m: string) => MUSCLE_LABELS[m] || m).join(', ')}</Text></View>}
              {(goal.type === 'fat_loss' || goal.type === 'recomposition') && <View style={s.goalRow}><Text style={s.goalLabel}>Fat loss target</Text><Text style={s.goalValue}>{goal.target_fat_loss_pct || 5}%</Text></View>}
              {(goal.type === 'muscle_gain' || goal.type === 'recomposition') && <View style={s.goalRow}><Text style={s.goalLabel}>Muscle growth</Text><Text style={s.goalValue}>{goal.target_muscle_gain_pct || 4}%</Text></View>}
              {goal.type === 'recomposition' && <View style={s.goalRow}><Text style={s.goalLabel}>Focus</Text><Text style={s.goalValue}>{getWeightLabel(goal.weights)}</Text></View>}
              <View style={s.goalRow}><Text style={s.goalLabel}>Timeline</Text><Text style={s.goalValue}>{goal.timeline_weeks || 8} weeks</Text></View>
            </View>
          ) : (
            <TouchableOpacity style={s.emptyGoalCard} onPress={onEditGoal}>
              <Text style={s.emptyGoalText}>No goal set yet</Text>
              <Text style={s.emptyGoalSub}>Tap to set your goal</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>SETTINGS</Text>
          <View style={s.actionsCard}>
            <TouchableOpacity style={s.actionRow} onPress={handleLogout}><Text style={s.actionText}>Log out</Text></TouchableOpacity>
            <View style={s.actionDivider} />
            <TouchableOpacity style={s.actionRow} onPress={handleDeleteData}><Text style={[s.actionText, { color: c.red }]}>Reset all data</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={s.version}>Morphe v0.1</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 120 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -1, marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: c.muted, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  editLink: { fontSize: 13, fontWeight: '700', color: c.primary },
  card: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: c.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '800', color: 'white' },
  emailText: { fontSize: 14, fontWeight: '700', color: c.text },
  memberSince: { fontSize: 12, color: c.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: c.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: c.cardBorder },
  statValue: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', color: c.muted },
  // Photos
  photoCard: { backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: c.cardBorder },
  photoCardTitle: { fontSize: 12, fontWeight: '700', color: c.text },
  photoPlaceholder: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: c.cardBorder, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  placeholderIcon: { marginBottom: 6 },
  placeholderText: { fontSize: 11, color: c.hint, fontWeight: '600' },
  photoOverlayLabel: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  photoOverlayText: { fontSize: 9, fontWeight: '700', color: 'white', letterSpacing: 0.3 },
  photoHint: { fontSize: 11, color: c.hint, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  photoImg: { borderRadius: 12, borderWidth: 1, borderColor: c.cardBorder, marginTop: 6 },
  photoWeekLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: c.muted },
  photoSubLabel: { fontSize: 10, color: c.hint, marginTop: 4 },
  viewToggle: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  viewToggleActive: { backgroundColor: c.primaryTint },
  viewToggleText: { fontSize: 10, fontWeight: '700', color: c.muted },
  viewToggleTextActive: { color: c.primary },
  weekDot: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: c.border },
  weekDotActive: { backgroundColor: c.primaryTint, borderColor: c.primary },
  weekDotText: { fontSize: 10, fontWeight: '700', color: c.muted },
  weekDotTextActive: { color: c.primary },
  // Goal
  goalCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: c.cardBorder, gap: 12 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalLabel: { fontSize: 12, color: c.muted },
  goalValue: { fontSize: 13, fontWeight: '700', color: c.text, textAlign: 'right', flexShrink: 1 },
  emptyGoalCard: { backgroundColor: c.primaryTint, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 0.5, borderColor: c.primaryBorder },
  emptyGoalText: { fontSize: 15, fontWeight: '700', color: c.primary, marginBottom: 4 },
  emptyGoalSub: { fontSize: 12, color: c.muted, textAlign: 'center' },
  // Actions
  actionsCard: { backgroundColor: c.card, borderRadius: 14, borderWidth: 0.5, borderColor: c.cardBorder, overflow: 'hidden' },
  actionRow: { padding: 16 },
  actionDivider: { height: 0.5, backgroundColor: c.border },
  actionText: { fontSize: 14, fontWeight: '600', color: c.text },
  version: { fontSize: 11, color: c.hint, textAlign: 'center', marginTop: 8 },
})