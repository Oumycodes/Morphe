import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Share } from 'react-native'
import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import Svg, { Defs, ClipPath, Circle, Path, Line, Ellipse, Rect, Polyline, Text as SvgText } from 'react-native-svg'
import { getLatestScans } from '../api/scans'
import { supabase } from '../lib/supabase'

const c = {
  bg: '#0A0E17', card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.06)',
  primary: '#1746A2', primaryTint: 'rgba(23,70,162,0.12)', primaryBorder: 'rgba(23,70,162,0.2)',
  text: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', muted: 'rgba(255,255,255,0.4)',
  hint: 'rgba(255,255,255,0.25)', border: 'rgba(255,255,255,0.06)',
  green: '#16A34A', greenTint: 'rgba(22,163,74,0.1)',
  yellow: '#CA8A04', orange: '#EA580C', red: '#DC2626',
  cyan: '#22d3ee', purple: '#a78bfa', pink: '#f87171',
}

type GoalType = 'fat_loss' | 'muscle_gain' | 'recomposition'
const GOAL_LABELS: Record<GoalType, string> = { fat_loss: 'FAT LOSS', muscle_gain: 'MUSCLE GAIN', recomposition: 'RECOMPOSITION' }

function getScoreColor(score: number) {
  if (score >= 80) return { color: c.green, tint: c.greenTint }
  if (score >= 60) return { color: c.yellow, tint: 'rgba(202,138,4,0.1)' }
  if (score >= 40) return { color: c.orange, tint: 'rgba(234,88,12,0.1)' }
  return { color: c.red, tint: 'rgba(220,38,38,0.1)' }
}

function deltaColor(pct: number) {
  if (pct > 10) return c.cyan; if (pct > 3) return '#60a5fa'; if (pct > 0) return c.purple; if (pct < 0) return c.pink; return c.primary
}

function statusLabel(status: string): string {
  const m: Record<string, string> = { gaining: 'Growing', bonus_gain: 'Bonus', shrinking: 'Shrinking', slight_loss: 'Slight loss', flat: 'No change', preserved: 'Preserved', losing_muscle: 'Losing', on_track: 'On track', wrong_direction: 'Wrong way', stable: 'Stable', drift: 'Drifting' }
  return m[status] || status
}
function statusColor(status: string): string {
  if (['gaining','bonus_gain','on_track','preserved'].includes(status)) return c.green
  if (['shrinking','losing_muscle','wrong_direction'].includes(status)) return c.red
  if (['slight_loss','drift'].includes(status)) return c.orange
  return c.muted
}

// Score over time chart
function ScoreChart({ scans }: { scans: any[] }) {
  const scored = scans.filter(s => s.score != null && !s.is_retake).reverse()
  if (scored.length < 2) return null
  const w = 280, h = 90, pad = 24, topPad = 10
  const scores = scored.map(s => s.score)
  const min = Math.min(...scores) - 10, max = Math.max(...scores) + 10
  const range = max - min || 1
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
    const y = topPad + (1 - (s - min) / range) * (h - topPad - pad)
    return { x, y, s }
  })
  const polyPts = pts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <View style={s.chartCard}>
      <Text style={s.chartLabel}>SCORE OVER TIME</Text>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0.25, 0.5, 0.75].map(f => <Line key={f} x1={pad} y1={topPad + f * (h - topPad - pad)} x2={w - pad} y2={topPad + f * (h - topPad - pad)} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />)}
        <Polyline points={polyPts} fill="none" stroke={c.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 2.5} fill={c.primary} stroke={i === pts.length - 1 ? c.bg : 'none'} strokeWidth={2} />)}
        {pts.map((p, i) => <SvgText key={`l${i}`} x={p.x} y={h - 4} fill="rgba(255,255,255,0.25)" fontSize="8" textAnchor="middle" fontWeight="500">{`W${i + 1}`}</SvgText>)}
      </Svg>
    </View>
  )
}

// Measurement trends chart
function TrendChart({ scans }: { scans: any[] }) {
  const real = scans.filter(s => !s.is_retake && s.shoulder_ratio).reverse()
  if (real.length < 2) return null
  const w = 280, h = 70, pad = 16, topPad = 6
  const lines = [
    { key: 'shoulder_ratio', label: 'Shoulders', color: c.cyan },
    { key: 'hip_ratio', label: 'Hips', color: c.purple },
    { key: 'waist_ratio', label: 'Waist ↓', color: c.green },
  ]
  const all = real.flatMap(s => lines.map(l => s[l.key]).filter(Boolean))
  const min = Math.min(...all), max = Math.max(...all)
  const range = max - min || 0.01
  return (
    <View style={s.chartCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={s.chartLabel}>MEASUREMENTS</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {lines.map(l => <Text key={l.key} style={{ fontSize: 8, color: l.color, fontWeight: '600' }}>● {l.label}</Text>)}
        </View>
      </View>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        {lines.map(l => {
          const pts = real.map((scan, i) => {
            const v = scan[l.key]
            if (!v) return null
            const x = pad + (i / (real.length - 1)) * (w - pad * 2)
            const y = topPad + (1 - (v - min) / range) * (h - topPad - pad)
            return `${x},${y}`
          }).filter(Boolean).join(' ')
          return <Polyline key={l.key} points={pts} fill="none" stroke={l.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={l.key === 'waist_ratio' ? '4,3' : undefined} />
        })}
      </Svg>
    </View>
  )
}

function BodyFigure({ side, muscles }: { side: 'front' | 'back', muscles: any[] }) {
  const isFront = side === 'front'
  const getColor = (id: string) => { const m = muscles.find(x => x.id === id); return m ? deltaColor(m.pct) : '#1a3352' }
  return (
    <Svg width="130" height="220" viewBox="0 0 100 180">
      <Defs><ClipPath id={`body-${side}`}><Circle cx="50" cy="10" r="9" /><Path d="M41 20 C34 20 18 25 17 34 C16 43 26 51 29 60 C26 69 17 76 18 87 L82 87 C83 76 74 69 71 60 C74 51 84 43 83 34 C82 25 66 20 59 20 Z" /><Path d="M29 60 L18 87 L18 180 L40 180 L44 95 L50 95 L56 95 L60 180 L82 180 L82 87 L71 60 Z" /></ClipPath></Defs>
      <Circle cx="50" cy="10" r="9" fill="#1a3352" /><Path d="M41 20 C34 20 18 25 17 34 C16 43 26 51 29 60 C26 69 17 76 18 87 L82 87 C83 76 74 69 71 60 C74 51 84 43 83 34 C82 25 66 20 59 20 Z" fill="#1a3352" /><Path d="M29 60 L18 87 L18 180 L40 180 L44 95 L50 95 L56 95 L60 180 L82 180 L82 87 L71 60 Z" fill="#1a3352" />
      <Ellipse cx="20" cy="30" rx="11" ry="9" fill={getColor('shoulders')} clipPath={`url(#body-${side})`} opacity="0.95" /><Ellipse cx="80" cy="30" rx="11" ry="9" fill={getColor('shoulders')} clipPath={`url(#body-${side})`} opacity="0.95" />
      <Path d="M10 32 C8 38 7 52 8 62 L16 62 C16 52 17 38 18 32 Z" fill={getColor('arms')} clipPath={`url(#body-${side})`} opacity="0.9" /><Path d="M90 32 C92 38 93 52 92 62 L84 62 C84 52 83 38 82 32 Z" fill={getColor('arms')} clipPath={`url(#body-${side})`} opacity="0.9" />
      <Path d="M8 62 C7 68 7 76 8 82 L15 82 C15 76 15 68 16 62 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.9" /><Path d="M92 62 C93 68 93 76 92 82 L85 82 C85 76 85 68 84 62 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.9" />
      {isFront ? <>
        <Path d="M26 22 Q50 18 74 22 L72 44 Q50 48 28 44 Z" fill={getColor('chest')} clipPath={`url(#body-${side})`} opacity="0.75" /><Line x1="50" y1="20" x2="50" y2="46" stroke="#4c1d95" strokeWidth="0.8" opacity="0.6" clipPath={`url(#body-${side})`} />
        <Rect x="34" y="44" width="32" height="28" rx="3" fill={getColor('abs')} clipPath={`url(#body-${side})`} opacity="0.7" /><Line x1="50" y1="44" x2="50" y2="72" stroke="#1e3a5f" strokeWidth="0.7" clipPath={`url(#body-${side})`} /><Line x1="34" y1="54" x2="66" y2="54" stroke="#1e3a5f" strokeWidth="0.7" clipPath={`url(#body-${side})`} /><Line x1="34" y1="63" x2="66" y2="63" stroke="#1e3a5f" strokeWidth="0.7" clipPath={`url(#body-${side})`} />
        <Path d="M28 72 Q50 66 72 72 L72 80 Q50 74 28 80 Z" fill={getColor('waist')} clipPath={`url(#body-${side})`} opacity="0.75" />
        <Path d="M24 87 Q50 81 76 87 L76 108 Q50 114 24 108 Z" fill={getColor('glutes')} clipPath={`url(#body-${side})`} opacity="0.95" /><Ellipse cx="50" cy="97" rx="18" ry="11" fill={getColor('glutes')} clipPath={`url(#body-${side})`} opacity="0.3" />
        <Path d="M24 108 L20 148 L38 148 L42 108 Z" fill={getColor('quads')} clipPath={`url(#body-${side})`} opacity="0.75" /><Path d="M76 108 L80 148 L62 148 L58 108 Z" fill={getColor('quads')} clipPath={`url(#body-${side})`} opacity="0.75" />
      </> : <>
        <Path d="M36 20 Q50 15 64 20 L62 34 Q50 38 38 34 Z" fill={getColor('traps')} clipPath={`url(#body-${side})`} opacity="0.75" />
        <Path d="M18 32 Q50 42 82 32 L82 60 Q50 68 18 60 Z" fill={getColor('lats')} clipPath={`url(#body-${side})`} opacity="0.65" /><Line x1="50" y1="22" x2="50" y2="87" stroke="#1e3a5f" strokeWidth="0.8" opacity="0.5" clipPath={`url(#body-${side})`} />
        <Rect x="32" y="60" width="36" height="24" rx="3" fill={getColor('lower_back')} clipPath={`url(#body-${side})`} opacity="0.55" />
        <Path d="M22 87 Q50 80 78 87 L80 116 Q50 124 20 116 Z" fill={getColor('glutes')} clipPath={`url(#body-${side})`} opacity="1" /><Ellipse cx="36" cy="102" rx="13" ry="14" fill={getColor('glutes')} clipPath={`url(#body-${side})`} opacity="0.5" /><Ellipse cx="64" cy="102" rx="13" ry="14" fill={getColor('glutes')} clipPath={`url(#body-${side})`} opacity="0.5" /><Line x1="50" y1="85" x2="50" y2="120" stroke="#0891b2" strokeWidth="0.8" opacity="0.5" clipPath={`url(#body-${side})`} />
        <Path d="M20 116 L16 148 L36 148 L40 116 Z" fill={getColor('hamstrings')} clipPath={`url(#body-${side})`} opacity="0.7" /><Path d="M80 116 L84 148 L64 148 L60 116 Z" fill={getColor('hamstrings')} clipPath={`url(#body-${side})`} opacity="0.7" />
      </>}
      <Ellipse cx="29" cy="150" rx="9" ry="6" fill="#111e30" clipPath={`url(#body-${side})`} /><Ellipse cx="71" cy="150" rx="9" ry="6" fill="#111e30" clipPath={`url(#body-${side})`} />
      <Path d="M20 156 C18 164 20 172 21 176 L37 176 C38 172 40 164 38 156 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.85" /><Path d="M62 156 C60 164 62 172 63 176 L79 176 C80 172 82 164 80 156 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.85" />
      <Circle cx="50" cy="10" r="9" fill="none" stroke="#2d5a8a" strokeWidth="1" /><Path d="M41 20 C34 20 18 25 17 34 C16 43 26 51 29 60 C26 69 17 76 18 87 L82 87 C83 76 74 69 71 60 C74 51 84 43 83 34 C82 25 66 20 59 20 Z" fill="none" stroke="#2d5a8a" strokeWidth="1" /><Path d="M29 60 L18 87 L18 180 L40 180 L44 95 L50 95 L56 95 L60 180 L82 180 L82 87 L71 60 Z" fill="none" stroke="#2d5a8a" strokeWidth="1" />
    </Svg>
  )
}

export default function ResultsScreen() {
  const [scans, setScans] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [scanData, { data: { user } }] = await Promise.all([getLatestScans(10), supabase.auth.getUser()])
      setScans(scanData)
      if (user) { const { data: profile } = await supabase.from('profiles').select('goal').eq('id', user.id).single(); setGoal(profile?.goal || null) }
      setLoading(false)
    })()
  }, [])

  const realScans = scans.filter(s => !s.is_retake)
  const current = realScans[0], previous = realScans[1]
  const score = current?.score ?? null, hasProgress = score != null
  const cycleNumber = current?.week_number || 1, sc = getScoreColor(score || 0)
  const goalType: GoalType | null = goal?.type || null
  const targetMuscles: string[] = goal?.target_muscles || []
  const isRecomp = goalType === 'recomposition'

  const muscles = (() => {
    if (current?.muscle_reports?.length) return current.muscle_reports.map((r: any) => ({ id: r.muscle, label: r.muscle.charAt(0).toUpperCase() + r.muscle.slice(1), pct: r.delta_vs_baseline_pct || 0, status: r.status, is_target: r.is_target }))
    if (!previous || !current) return []
    const list: any[] = [
      { id: 'shoulders', label: 'Shoulders', pct: ((current.shoulder_ratio - previous.shoulder_ratio) / previous.shoulder_ratio * 100), is_target: false },
      { id: 'hips', label: 'Hips', pct: ((current.hip_ratio - previous.hip_ratio) / previous.hip_ratio * 100), is_target: false },
      { id: 'waist', label: 'Waist', pct: ((current.waist_ratio - previous.waist_ratio) / previous.waist_ratio * 100), is_target: false },
    ]
    if (current.glute_projection_ratio && previous.glute_projection_ratio) list.push({ id: 'glutes', label: 'Glutes', pct: ((current.glute_projection_ratio - previous.glute_projection_ratio) / previous.glute_projection_ratio * 100), is_target: false })
    return list
  })()

  const narration = current?.narration || ''

  const onShare = async () => { try { await Share.share({ message: `Morphe — Score: ${score}/100, Cycle ${cycleNumber}.` }) } catch {} }

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Progress</Text>

        {loading ? <View style={s.emptyCard}><Text style={s.emptyText}>Loading...</Text></View>
        : !current ? <View style={s.emptyCard}><Text style={s.emptyTitle}>No scans yet</Text><Text style={s.emptyText}>Take your first scan to start tracking</Text></View>
        : <>
          {hasProgress && (
            <View style={s.scoreBanner}>
              <View style={{ flex: 1 }}>
                <Text style={s.arcLabel}>CYCLE {cycleNumber}{goalType && ` · ${GOAL_LABELS[goalType]}`}</Text>
                <Text style={s.pts}>{score}<Text style={s.ptsSlash}> / 100</Text></Text>
                <Text style={s.total}>Progress to goal</Text>
                {isRecomp && current.fat_component != null && current.muscle_component != null && (
                  <View style={s.componentRow}>
                    <View style={s.componentPill}><Text style={s.componentLbl}>FAT</Text><Text style={s.componentVal}>{Math.round(current.fat_component)}</Text></View>
                    <View style={s.componentPill}><Text style={s.componentLbl}>MUSCLE</Text><Text style={s.componentVal}>{Math.round(current.muscle_component)}</Text></View>
                  </View>
                )}
              </View>
              <View style={[s.scoreRing, { borderColor: sc.color, backgroundColor: sc.tint }]}>
                <Text style={s.scoreNum}>{score}</Text>
                <Text style={[s.scoreLbl, { color: sc.color }]}>SCORE</Text>
              </View>
            </View>
          )}

          <ScoreChart scans={scans} />
          <TrendChart scans={scans} />

          <View style={s.avatarCard}>
            <View style={s.avatarHeader}>
              <Text style={s.avatarTitle}>{hasProgress ? 'GROWTH MAP' : 'BASELINE SET'}</Text>
              <View style={s.legendRow}>
                <Text style={{ fontSize: 8, color: c.cyan, fontWeight: '600' }}>● High</Text>
                <Text style={{ fontSize: 8, color: c.purple, fontWeight: '600' }}>● Mid</Text>
                <Text style={{ fontSize: 8, color: c.pink, fontWeight: '600' }}>● Loss</Text>
              </View>
            </View>
            <View style={s.figureRow}>
              <View style={s.figureCol}><Text style={s.figureLabel}>FRONT</Text><BodyFigure side="front" muscles={muscles} /></View>
              <View style={s.figureCol}><Text style={s.figureLabel}>BACK</Text><BodyFigure side="back" muscles={muscles} /></View>
            </View>
          </View>

          {hasProgress ? <>
            {narration ? <View style={s.insight}><Text style={s.insightTitle}>Morphe insight</Text><Text style={s.insightText}>{narration}</Text></View> : null}
            <Text style={s.sectionTitle}>Per-muscle analysis</Text>
            {muscles.map((m: any) => (
              <View key={m.id} style={s.muscleCard}>
                <View style={s.muscleCardHeader}>
                  <View style={[s.muscleDot, { backgroundColor: deltaColor(m.pct) }]} />
                  <Text style={s.muscleLabel}>{m.label}</Text>
                  {m.is_target && <View style={s.targetBadge}><Text style={s.targetBadgeText}>TARGET</Text></View>}
                  <Text style={[s.musclePct, { color: m.pct < 0 ? c.red : c.primary }]}>{m.pct > 0 ? '+' : ''}{m.pct.toFixed(1)}%</Text>
                </View>
                <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.min(Math.abs(m.pct) * 4, 100)}%` as any, backgroundColor: m.pct < 0 ? c.red : c.primary }]} /></View>
                {m.status && <Text style={[s.muscleStatus, { color: statusColor(m.status) }]}>{statusLabel(m.status)} · vs baseline</Text>}
              </View>
            ))}
          </> : (
            <View style={s.baselineCard}>
              <Text style={s.baselineTitle}>Baseline recorded ✓</Text>
              <Text style={s.baselineSub}>Scan again in 5 days to see your first score.</Text>
              {targetMuscles.length > 0 && <Text style={s.baselineTargets}>Tracking: {targetMuscles.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' · ')}</Text>}
            </View>
          )}

          <View style={s.measureCard}>
            <Text style={s.measureTitle}>RAW MEASUREMENTS</Text>
            {[{ label: 'Shoulder ratio', val: current.shoulder_ratio }, { label: 'Hip ratio', val: current.hip_ratio }, { label: 'Waist ratio', val: current.waist_ratio },
              ...(current.glute_projection_ratio ? [{ label: 'Glute projection', val: current.glute_projection_ratio }] : [])
            ].map(item => <View key={item.label} style={s.measureRow}><Text style={s.measureLabel}>{item.label}</Text><Text style={s.measureVal}>{item.val?.toFixed(4)}</Text></View>)}
          </View>

          {hasProgress && <TouchableOpacity style={s.shareBtn} onPress={onShare}><Text style={s.shareBtnText}>Share results</Text></TouchableOpacity>}
        </>}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 120 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: c.text, letterSpacing: -1, marginBottom: 16 },
  emptyCard: { backgroundColor: c.card, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 0.5, borderColor: c.cardBorder },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 6 },
  emptyText: { fontSize: 13, color: c.muted, textAlign: 'center' },
  scoreBanner: { backgroundColor: c.card, borderWidth: 0.5, borderColor: c.cardBorder, borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  arcLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: c.primary, marginBottom: 2 },
  pts: { fontSize: 38, fontWeight: '800', color: c.text, lineHeight: 40 },
  ptsSlash: { fontSize: 16, fontWeight: '700', color: c.muted },
  total: { fontSize: 11, color: c.muted, marginTop: 2 },
  componentRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  componentPill: { backgroundColor: c.card, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 0.5, borderColor: c.cardBorder },
  componentLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: c.muted },
  componentVal: { fontSize: 13, fontWeight: '800', color: c.primary },
  scoreRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 17, fontWeight: '800', color: c.text, lineHeight: 19 },
  scoreLbl: { fontSize: 7, fontWeight: '700', letterSpacing: 0.3 },
  chartCard: { backgroundColor: c.card, borderRadius: 14, borderWidth: 0.5, borderColor: c.cardBorder, padding: 14, marginBottom: 12 },
  chartLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: c.muted, marginBottom: 8 },
  avatarCard: { backgroundColor: '#07111e', borderRadius: 18, overflow: 'hidden', marginBottom: 16, padding: 14 },
  avatarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  avatarTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#4b7ab5' },
  legendRow: { flexDirection: 'row', gap: 8 },
  figureRow: { flexDirection: 'row', justifyContent: 'space-around' },
  figureCol: { alignItems: 'center', gap: 6 },
  figureLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#4b7ab5' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: c.text, marginBottom: 10, marginTop: 4 },
  muscleCard: { backgroundColor: c.card, borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: c.cardBorder, marginBottom: 8 },
  muscleCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  muscleDot: { width: 8, height: 8, borderRadius: 4 },
  muscleLabel: { fontSize: 13, fontWeight: '700', color: c.text, flex: 1 },
  targetBadge: { backgroundColor: c.primaryTint, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  targetBadgeText: { fontSize: 8, fontWeight: '800', color: c.primary, letterSpacing: 0.5 },
  musclePct: { fontSize: 13, fontWeight: '800' },
  barTrack: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 2, height: 5 },
  barFill: { height: 5, borderRadius: 2 },
  muscleStatus: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  baselineCard: { backgroundColor: c.card, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 0.5, borderColor: c.cardBorder, marginBottom: 12 },
  baselineTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
  baselineSub: { fontSize: 13, color: c.muted, textAlign: 'center' },
  baselineTargets: { fontSize: 11, color: c.primary, fontWeight: '700', marginTop: 10 },
  insight: { backgroundColor: c.primaryTint, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: c.primaryBorder, marginBottom: 16 },
  insightTitle: { fontSize: 12, fontWeight: '800', color: c.text, marginBottom: 5 },
  insightText: { fontSize: 13, color: c.primary, lineHeight: 20 },
  measureCard: { backgroundColor: c.card, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: c.cardBorder, marginTop: 8, marginBottom: 16 },
  measureTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: c.muted, marginBottom: 10 },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  measureLabel: { fontSize: 12, color: c.muted },
  measureVal: { fontSize: 12, fontWeight: '700', color: c.text },
  shareBtn: { backgroundColor: c.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  shareBtnText: { color: 'white', fontSize: 14, fontWeight: '800' },
})
