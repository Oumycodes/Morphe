import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg'
import { getLatestScore, getLatestScans, canScan } from '../api/scans'
import { supabase } from '../lib/supabase'

const c = {
  bg: '#0A0E17',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardHover: 'rgba(255,255,255,0.08)',
  primary: '#1746A2',
  primaryTint: 'rgba(23,70,162,0.12)',
  primaryBorder: 'rgba(23,70,162,0.2)',
  text: '#FFFFFF',
  sub: 'rgba(255,255,255,0.7)',
  muted: 'rgba(255,255,255,0.4)',
  hint: 'rgba(255,255,255,0.25)',
  border: 'rgba(255,255,255,0.06)',
  green: '#16A34A',
  greenTint: 'rgba(22,163,74,0.1)',
  yellow: '#CA8A04',
  yellowTint: 'rgba(202,138,4,0.1)',
  orange: '#EA580C',
  orangeTint: 'rgba(234,88,12,0.1)',
  red: '#DC2626',
  redTint: 'rgba(220,38,38,0.1)',
}

let cachedData: any = null

function getScoreColor(score: number) {
  if (score >= 80) return { color: c.green, tint: c.greenTint, label: 'Crushing it' }
  if (score >= 60) return { color: c.yellow, tint: c.yellowTint, label: 'Steady progress' }
  if (score >= 40) return { color: c.orange, tint: c.orangeTint, label: 'Slow week' }
  return { color: c.red, tint: c.redTint, label: 'Needs a push' }
}

function getHour() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const w = 200, h = 50, pad = 8
  const min = Math.min(...scores) - 5
  const max = Math.max(...scores) + 5
  const range = max - min || 1
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
    const y = h - pad - ((s - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const lastPt = pts.split(' ').pop()!.split(',')
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      <Polyline points={pts} fill="none" stroke={c.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
        const y = h - pad - ((s - min) / range) * (h - pad * 2)
        return <Circle key={i} cx={x} cy={y} r={i === scores.length - 1 ? 4 : 2.5} fill={c.primary} stroke={i === scores.length - 1 ? c.bg : 'none'} strokeWidth={2} />
      })}
    </Svg>
  )
}

export default function DashboardScreen({
  onScan, onResults, onScanAllowedChange,
}: {
  onScan: () => void; onResults: () => void; onScanAllowedChange?: (allowed: boolean) => void
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
        getLatestScore(), getLatestScans(10), canScan(),
        supabase.from('profiles').select('name').eq('id', user.id).single(),
      ])
      const firstName = profileRes.data?.name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
      cachedData = { latestScan: latest, scans: allScans, scanAllowed: scanCheck, name: firstName }
      setLatestScan(latest); setScans(allScans); setScanAllowed(scanCheck)
      onScanAllowedChange?.(scanCheck?.allowed ?? true); setName(firstName)
    } catch (e) { console.log('Dashboard load error:', e) }
    finally { setReady(true) }
  }, [])

  useEffect(() => { loadData() }, [])

  const score = latestScan?.score ?? null
  const hasScore = score !== null
  const sc = getScoreColor(score || 50)
  const cycleNumber = latestScan?.week_number || 1
  const realScans = scans.filter((s: any) => !s.is_retake)
  const current = realScans[0]
  const previous = realScans[1]

  const scoreHistory = realScans
    .filter((s: any) => s.score != null)
    .reverse()
    .map((s: any) => s.score)

  const muscleDeltas = current && previous ? [
    { id: 'shoulders', label: 'Shoulders', pct: ((current.shoulder_ratio - previous.shoulder_ratio) / previous.shoulder_ratio * 100) },
    { id: 'hips', label: 'Hips', pct: ((current.hip_ratio - previous.hip_ratio) / previous.hip_ratio * 100) },
    { id: 'waist', label: 'Waist', pct: ((current.waist_ratio - previous.waist_ratio) / previous.waist_ratio * 100) },
    ...(current.glute_projection_ratio && previous.glute_projection_ratio ? [{
      id: 'glutes', label: 'Glutes',
      pct: ((current.glute_projection_ratio - previous.glute_projection_ratio) / previous.glute_projection_ratio * 100),
    }] : []),
  ] : []

  const streak = realScans.length

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getHour()},</Text>
            <Text style={s.name}>{name || '...'}</Text>
          </View>
          <View style={s.streakPill}>
            <View style={s.streakDot} />
            <Text style={s.streakText}>{streak} scan{streak !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {!ready ? (
          <View style={[s.scoreCard, { opacity: 0.4 }]}>
            <View style={[s.scoreRing, { borderColor: c.border }]}>
              <Text style={[s.scoreNum, { color: c.muted }]}>—</Text>
            </View>
            <View style={s.scoreInfo}>
              <Text style={s.scoreTitle}>Loading...</Text>
            </View>
          </View>
        ) : latestScan ? (
          <View style={s.scoreCard}>
            <View style={[s.scoreRing, {
              borderColor: hasScore ? sc.color : c.border,
              backgroundColor: hasScore ? sc.tint : 'transparent',
            }]}>
              {hasScore ? (
                <>
                  <Text style={s.scoreNum}>{score}</Text>
                  <Text style={[s.scoreLabel, { color: sc.color }]}>SCORE</Text>
                </>
              ) : (
                <Text style={[s.scoreNum, { fontSize: 22, color: c.muted }]}>—</Text>
              )}
            </View>
            <View style={s.scoreInfo}>
              <Text style={s.scoreTitle}>{hasScore ? sc.label : 'Baseline set'}</Text>
              <Text style={s.scoreSub}>
                {hasScore ? `Cycle ${cycleNumber} · Progress to goal` : 'Scan again in 5 days to see your score'}
              </Text>
              {scanAllowed?.allowed ? (
                <TouchableOpacity style={s.scanBtn} onPress={onScan}>
                  <Text style={s.scanBtnText}>SCAN NOW</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.scanBtn, { backgroundColor: c.muted }]}>
                  <Text style={s.scanBtnText}>NEXT IN {scanAllowed?.next_scan_in?.toUpperCase() || '5 DAYS'}</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={s.firstScanCard}>
            <Text style={s.firstScanTitle}>Take your first scan</Text>
            <Text style={s.firstScanSub}>Set your baseline and start tracking your body arc</Text>
            <TouchableOpacity style={s.firstScanBtn} onPress={onScan}>
              <Text style={s.firstScanBtnText}>Start scan →</Text>
            </TouchableOpacity>
          </View>
        )}

        {scoreHistory.length >= 2 && (
          <View style={s.chartCard}>
            <Text style={s.chartLabel}>SCORE TREND</Text>
            <Sparkline scores={scoreHistory} />
          </View>
        )}

        {muscleDeltas.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Muscle tracking</Text>
            <View style={s.grid}>
              {muscleDeltas.map(m => (
                <View key={m.id} style={s.muscleCard}>
                  <Text style={s.muscleLabel}>{m.label.toUpperCase()}</Text>
                  <Text style={[s.musclePct, { color: m.pct >= 0 ? c.primary : c.red }]}>
                    {m.pct >= 0 ? '+' : ''}{m.pct.toFixed(1)}%
                  </Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, {
                      width: `${Math.min(Math.abs(m.pct) * 8, 100)}%` as any,
                      backgroundColor: m.pct >= 0 ? c.primary : c.red,
                    }]} />
                  </View>
                </View>
              ))}
              <TouchableOpacity style={s.resultsCard} onPress={onResults}>
                <Text style={s.resultsWeek}>Cycle {cycleNumber}</Text>
                <Text style={s.resultsLabel}>Results</Text>
                <Text style={s.resultsArrow}>View →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {ready && muscleDeltas.length === 0 && latestScan && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>Next scan in {scanAllowed?.next_scan_in || '5 days'}</Text>
            <Text style={s.emptySub}>Muscle deltas appear after your second scan</Text>
          </View>
        )}

        {ready && !latestScan && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTitle}>No scans yet</Text>
            <Text style={s.emptySub}>Take your first scan to set your baseline</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 13, color: c.muted },
  name: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.8 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: c.primaryTint, borderWidth: 0.5, borderColor: c.primaryBorder,
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 11,
  },
  streakDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.primary },
  streakText: { fontSize: 11, fontWeight: '700', color: c.primary },
  scoreCard: {
    backgroundColor: c.card, borderRadius: 16, borderWidth: 0.5,
    borderColor: c.cardBorder, padding: 16, flexDirection: 'row',
    alignItems: 'center', gap: 16, marginBottom: 16,
  },
  scoreRing: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  scoreNum: { fontSize: 22, fontWeight: '800', color: c.text, lineHeight: 24 },
  scoreLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 3 },
  scoreSub: { fontSize: 11, color: c.muted, marginBottom: 10 },
  scanBtn: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  scanBtnText: { fontSize: 10, fontWeight: '800', color: 'white', letterSpacing: 0.4 },
  firstScanCard: {
    backgroundColor: c.primaryTint, borderRadius: 16, borderWidth: 0.5,
    borderColor: c.primaryBorder, padding: 20, marginBottom: 16, alignItems: 'center',
  },
  firstScanTitle: { fontSize: 17, fontWeight: '800', color: c.text, marginBottom: 6 },
  firstScanSub: { fontSize: 13, color: c.sub, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  firstScanBtn: { backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  firstScanBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
  chartCard: {
    backgroundColor: c.card, borderRadius: 14, borderWidth: 0.5,
    borderColor: c.cardBorder, padding: 14, marginBottom: 16,
  },
  chartLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: c.muted, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  muscleCard: {
    backgroundColor: c.card, borderRadius: 14, borderWidth: 0.5,
    borderColor: c.cardBorder, padding: 14, width: '47%',
  },
  muscleLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, color: c.muted, marginBottom: 6 },
  musclePct: { fontSize: 22, fontWeight: '800', letterSpacing: -0.8, marginBottom: 8 },
  barTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2 },
  barFill: { height: 4, borderRadius: 2 },
  resultsCard: {
    backgroundColor: c.primary, borderRadius: 14,
    padding: 14, width: '47%', justifyContent: 'space-between',
  },
  resultsWeek: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  resultsLabel: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 12 },
  resultsArrow: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  emptyCard: {
    backgroundColor: c.card, borderRadius: 14, borderWidth: 0.5,
    borderColor: c.cardBorder, padding: 20, alignItems: 'center', marginTop: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 4 },
  emptySub: { fontSize: 12, color: c.muted, textAlign: 'center' },
})
