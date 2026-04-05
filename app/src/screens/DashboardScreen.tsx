import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import { getLatestScore, getLatestScans, canScan } from '../api/scans'
import { supabase } from '../lib/supabase'

const colors = {
  primary: '#1746A2',
  primaryTint: '#EFF6FF',
  background: '#FAFAF8',
  surface: '#FFFFFF',
  ink: '#0E0E10',
  body: '#3E3E44',
  muted: '#6A6A72',
  hint: '#A8A8B2',
  border: '#E8E7E3',
  score: {
    green: '#16A34A', greenTint: '#DCFCE7',
    yellow: '#CA8A04', yellowTint: '#FEF9C3',
    orange: '#EA580C', orangeTint: '#FFEDD5',
    red: '#DC2626', redTint: '#FEE2E2',
  },
}

// Cache persists between navigation — no loading flicker
let cachedData: any = null

function getScoreColor(score: number) {
  if (score >= 80) return { color: colors.score.green, tint: colors.score.greenTint, label: 'Crushing it' }
  if (score >= 60) return { color: colors.score.yellow, tint: colors.score.yellowTint, label: 'Steady progress' }
  if (score >= 40) return { color: colors.score.orange, tint: colors.score.orangeTint, label: 'Slow week' }
  return { color: colors.score.red, tint: colors.score.redTint, label: 'Needs a push' }
}

function getHour() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardScreen({
  onScan,
  onResults,
}: {
  onScan: () => void
  onResults: () => void
}) {
  const [latestScan, setLatestScan] = useState<any>(cachedData?.latestScan || null)
  const [scans, setScans] = useState<any[]>(cachedData?.scans || [])
  const [scanAllowed, setScanAllowed] = useState<any>(cachedData?.scanAllowed || { allowed: false, next_scan_in: '5 days' })
  const [name, setName] = useState<string>(cachedData?.name || '')
  const [ready, setReady] = useState(!!cachedData)

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [latest, allScans, scanCheck, profileRes] = await Promise.all([
        getLatestScore(),
        getLatestScans(10),
        canScan(),
        supabase.from('profiles').select('name').eq('id', user.id).single(),
      ])

      const firstName = profileRes.data?.name?.split(' ')[0] || user.email?.split('@')[0] || 'there'

      cachedData = {
        latestScan: latest,
        scans: allScans,
        scanAllowed: scanCheck,
        name: firstName,
      }

      setLatestScan(latest)
      setScans(allScans)
      setScanAllowed(scanCheck)
      setName(firstName)
    } catch (e) {
      console.log('Dashboard load error:', e)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  const score = latestScan?.score || 0
  const sc = getScoreColor(score)
  const cycleNumber = latestScan?.week_number || 1
  const realScans = scans.filter((s: any) => !s.is_retake)
  const current = realScans[0]
  const previous = realScans[1]

  const muscleDeltas = current && previous ? [
    { id: 'shoulders', label: 'Shoulders', pct: ((current.shoulder_ratio - previous.shoulder_ratio) / previous.shoulder_ratio * 100), weeks: cycleNumber },
    { id: 'hips', label: 'Hips', pct: ((current.hip_ratio - previous.hip_ratio) / previous.hip_ratio * 100), weeks: cycleNumber },
    { id: 'waist', label: 'Waist', pct: ((current.waist_ratio - previous.waist_ratio) / previous.waist_ratio * 100), weeks: cycleNumber },
  ] : []

  const streak = realScans.length

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getHour()},</Text>
            <Text style={s.name}>{name || '...'}</Text>
          </View>
          <View style={s.streakPill}>
            <View style={[s.streakDot, { backgroundColor: colors.primary }]} />
            <Text style={s.streakText}>{streak} scan streak</Text>
          </View>
        </View>

        {!ready ? (
          <View style={[s.scoreCard, { opacity: 0.4 }]}>
            <View style={[s.scoreRing, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={s.scoreNum}>—</Text>
            </View>
            <View style={s.scoreInfo}>
              <Text style={s.scoreTitle}>Loading...</Text>
              <Text style={s.scoreSub}>Fetching your arc</Text>
            </View>
          </View>
        ) : latestScan ? (
          <View style={s.scoreCard}>
            <View style={[s.scoreRing, { borderColor: sc.color, backgroundColor: sc.tint }]}>
              <Text style={s.scoreNum}>{score}</Text>
              <Text style={[s.scoreLabel, { color: sc.color }]}>SCORE</Text>
            </View>
            <View style={s.scoreInfo}>
              <Text style={s.scoreTitle}>{sc.label}</Text>
              <Text style={s.scoreSub}>Cycle {cycleNumber}</Text>
              {scanAllowed?.allowed ? (
                <TouchableOpacity style={s.scanBtn} onPress={onScan}>
                  <Text style={s.scanBtnText}>SCAN NOW</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.scanBtn, { backgroundColor: colors.hint }]}>
                  <Text style={s.scanBtnText}>
                    NEXT SCAN IN {scanAllowed?.next_scan_in?.toUpperCase() || '5 DAYS'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={s.firstScanCard}>
            <Text style={s.firstScanTitle}>Take your first scan</Text>
            <Text style={s.firstScanSub}>
              Set your baseline and start tracking your body arc
            </Text>
            <TouchableOpacity style={s.firstScanBtn} onPress={onScan}>
              <Text style={s.firstScanBtnText}>Start scan →</Text>
            </TouchableOpacity>
          </View>
        )}

        {muscleDeltas.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Muscle tracking</Text>
            <View style={s.grid}>
              {muscleDeltas.map(m => (
                <MuscleCard key={m.id} {...m} />
              ))}
              <TouchableOpacity style={s.scanNowCard} onPress={onResults}>
                <Text style={s.scanNowWeek}>Cycle {cycleNumber}</Text>
                <Text style={s.scanNowLabel}>Results</Text>
                <Text style={s.scanNowArrow}>View now →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {ready && muscleDeltas.length === 0 && latestScan && (
          <View style={s.needMoreScans}>
            <Text style={s.needMoreScansTitle}>
              Next scan in {scanAllowed?.next_scan_in || '5 days'}
            </Text>
            <Text style={s.needMoreScansSub}>
              Muscle deltas appear after your second scan
            </Text>
          </View>
        )}

        {ready && !latestScan && (
          <View style={s.needMoreScans}>
            <Text style={s.needMoreScansTitle}>No scans yet</Text>
            <Text style={s.needMoreScansSub}>
              Take your first scan to set your baseline
            </Text>
          </View>
        )}

      </ScrollView>

      <View style={s.nav}>
        <NavItem label="Home" active />
        <NavItem
          label="Scan"
          onPress={scanAllowed?.allowed ? onScan : undefined}
          disabled={!scanAllowed?.allowed}
        />
        <NavItem label="Progress" onPress={onResults} />
        <NavItem label="Profile" />
      </View>
    </View>
  )
}

function MuscleCard({ label, pct, weeks }: { label: string; pct: number; weeks: number }) {
  const positive = pct >= 0
  const barColor = positive ? colors.primary : colors.score.red
  const barWidth = Math.min(Math.abs(pct) * 8, 100)
  return (
    <View style={s.muscleCard}>
      <Text style={s.muscleLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.musclePct, { color: positive ? colors.primary : colors.score.red }]}>
        {positive ? '+' : ''}{pct.toFixed(1)}%
      </Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${barWidth}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={s.muscleWeeks}>cycle {weeks}</Text>
    </View>
  )
}

function NavItem({ label, active, onPress, disabled }: {
  label: string; active?: boolean; onPress?: () => void; disabled?: boolean
}) {
  return (
    <TouchableOpacity style={s.navItem} onPress={onPress} disabled={disabled}>
      <Text style={[s.navLabel, active && s.navLabelActive, disabled && s.navLabelDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  greeting: { fontSize: 13, color: colors.muted },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryTint, borderWidth: 0.5,
    borderColor: '#BFDBFE', borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 11,
  },
  streakDot: { width: 6, height: 6, borderRadius: 3 },
  streakText: { fontSize: 11, fontWeight: '700', color: '#0F2D6B' },
  scoreCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 0.5, borderColor: colors.border,
    padding: 16, flexDirection: 'row',
    alignItems: 'center', gap: 16, marginBottom: 24,
  },
  scoreRing: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  scoreNum: { fontSize: 22, fontWeight: '800', color: colors.ink, lineHeight: 24 },
  scoreLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 3 },
  scoreSub: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  scanBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 12, alignSelf: 'flex-start',
  },
  scanBtnText: { fontSize: 10, fontWeight: '800', color: 'white', letterSpacing: 0.4 },
  firstScanCard: {
    backgroundColor: colors.primaryTint, borderRadius: 16,
    borderWidth: 0.5, borderColor: '#BFDBFE',
    padding: 20, marginBottom: 24, alignItems: 'center',
  },
  firstScanTitle: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  firstScanSub: {
    fontSize: 13, color: colors.muted,
    textAlign: 'center', marginBottom: 16, lineHeight: 20,
  },
  firstScanBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  firstScanBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  muscleCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 0.5, borderColor: colors.border,
    padding: 14, width: '47%',
  },
  muscleLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.6,
    color: colors.hint, marginBottom: 6,
  },
  musclePct: { fontSize: 22, fontWeight: '800', letterSpacing: -0.8, marginBottom: 8 },
  barTrack: { height: 4, backgroundColor: colors.background, borderRadius: 2, marginBottom: 6 },
  barFill: { height: 4, borderRadius: 2 },
  muscleWeeks: { fontSize: 10, color: colors.hint },
  scanNowCard: {
    backgroundColor: colors.primary, borderRadius: 14,
    padding: 14, width: '47%', justifyContent: 'space-between',
  },
  scanNowWeek: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  scanNowLabel: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 12 },
  scanNowArrow: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  needMoreScans: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 0.5, borderColor: colors.border,
    padding: 20, alignItems: 'center', marginTop: 8,
  },
  needMoreScansTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  needMoreScansSub: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  nav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: colors.surface,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    paddingBottom: 34, paddingTop: 12,
    zIndex: 100, elevation: 10,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navLabel: { fontSize: 11, fontWeight: '600', color: colors.hint },
  navLabelActive: { color: colors.primary },
  navLabelDisabled: { color: colors.border },
})