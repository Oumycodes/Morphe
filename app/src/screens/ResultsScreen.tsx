import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Share } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import Svg, { Defs, ClipPath, Circle, Path, Line, Ellipse, G, Rect } from 'react-native-svg'

const colors = {
  primary: '#1746A2',
  primaryTint: '#EFF6FF',
  background: '#FAFAF8',
  surface: '#FFFFFF',
  ink: '#0E0E10',
  muted: '#6A6A72',
  hint: '#A8A8B2',
  border: '#E8E7E3',
  score: { green: '#16A34A', greenTint: '#DCFCE7' },
}

const MOCK_MUSCLES = [
  { label: 'Glutes',    pct: 18, heat: '#22d3ee' },
  { label: 'Arms',      pct: 12, heat: '#22d3ee' },
  { label: 'Shoulders', pct: 9,  heat: '#22d3ee' },
  { label: 'Waist',     pct: -3, heat: '#f87171' },
  { label: 'Quads',     pct: 6,  heat: '#a78bfa' },
]

function BodyFigure({ side }: { side: 'front' | 'back' }) {
  const isFront = side === 'front'
  return (
    <Svg width="130" height="220" viewBox="0 0 100 180">
      <Defs>
        <ClipPath id={`body-${side}`}>
          <Circle cx="50" cy="10" r="9" />
          <Path d="M41 20 C34 20 18 25 17 34 C16 43 26 51 29 60 C26 69 17 76 18 87 L82 87 C83 76 74 69 71 60 C74 51 84 43 83 34 C82 25 66 20 59 20 Z" />
          <Path d="M29 60 L18 87 L18 180 L40 180 L44 95 L50 95 L56 95 L60 180 L82 180 L82 87 L71 60 Z" />
        </ClipPath>
      </Defs>

      {/* Base body */}
      <Circle cx="50" cy="10" r="9" fill="#1a3352" />
      <Path d="M41 20 C34 20 18 25 17 34 C16 43 26 51 29 60 C26 69 17 76 18 87 L82 87 C83 76 74 69 71 60 C74 51 84 43 83 34 C82 25 66 20 59 20 Z" fill="#1a3352" />
      <Path d="M29 60 L18 87 L18 180 L40 180 L44 95 L50 95 L56 95 L60 180 L82 180 L82 87 L71 60 Z" fill="#1a3352" />

      {/* SHOULDERS — cyan high */}
      <Ellipse cx="20" cy="30" rx="11" ry="9" fill="#0891b2" clipPath={`url(#body-${side})`} opacity="0.95" />
      <Ellipse cx="80" cy="30" rx="11" ry="9" fill="#0891b2" clipPath={`url(#body-${side})`} opacity="0.95" />
      <Ellipse cx="20" cy="30" rx="7" ry="5" fill="#22d3ee" clipPath={`url(#body-${side})`} opacity="0.5" />
      <Ellipse cx="80" cy="30" rx="7" ry="5" fill="#22d3ee" clipPath={`url(#body-${side})`} opacity="0.5" />

      {/* ARMS — cyan high */}
      <Path d="M10 32 C8 38 7 52 8 62 L16 62 C16 52 17 38 18 32 Z" fill="#0891b2" clipPath={`url(#body-${side})`} opacity="0.9" />
      <Path d="M90 32 C92 38 93 52 92 62 L84 62 C84 52 83 38 82 32 Z" fill="#0891b2" clipPath={`url(#body-${side})`} opacity="0.9" />

      {/* FOREARMS */}
      <Path d="M8 62 C7 68 7 76 8 82 L15 82 C15 76 15 68 16 62 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.9" />
      <Path d="M92 62 C93 68 93 76 92 82 L85 82 C85 76 85 68 84 62 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.9" />

      {isFront ? (
        <>
          {/* CHEST — purple mid */}
          <Path d="M26 22 Q50 18 74 22 L72 44 Q50 48 28 44 Z" fill="#7c3aed" clipPath={`url(#body-${side})`} opacity="0.75" />
          <Line x1="50" y1="20" x2="50" y2="46" stroke="#4c1d95" strokeWidth="0.8" opacity="0.6" clipPath={`url(#body-${side})`} />
          {/* ABS — low */}
          <Rect x="34" y="44" width="32" height="28" rx="3" fill="#2d5a8a" clipPath={`url(#body-${side})`} opacity="0.7" />
          <Line x1="50" y1="44" x2="50" y2="72" stroke="#1e3a5f" strokeWidth="0.7" clipPath={`url(#body-${side})`} />
          <Line x1="34" y1="54" x2="66" y2="54" stroke="#1e3a5f" strokeWidth="0.7" clipPath={`url(#body-${side})`} />
          <Line x1="34" y1="63" x2="66" y2="63" stroke="#1e3a5f" strokeWidth="0.7" clipPath={`url(#body-${side})`} />
          {/* WAIST — red loss */}
          <Path d="M28 72 Q50 66 72 72 L72 80 Q50 74 28 80 Z" fill="#dc2626" clipPath={`url(#body-${side})`} opacity="0.55" />
          {/* HIPS/GLUTES front — cyan high */}
          <Path d="M24 87 Q50 81 76 87 L76 108 Q50 114 24 108 Z" fill="#0891b2" clipPath={`url(#body-${side})`} opacity="0.95" />
          <Ellipse cx="50" cy="97" rx="18" ry="11" fill="#22d3ee" clipPath={`url(#body-${side})`} opacity="0.3" />
          {/* QUADS — purple */}
          <Path d="M24 108 L20 148 L38 148 L42 108 Z" fill="#7c3aed" clipPath={`url(#body-${side})`} opacity="0.75" />
          <Path d="M76 108 L80 148 L62 148 L58 108 Z" fill="#7c3aed" clipPath={`url(#body-${side})`} opacity="0.75" />
        </>
      ) : (
        <>
          {/* TRAPS — purple */}
          <Path d="M36 20 Q50 15 64 20 L62 34 Q50 38 38 34 Z" fill="#7c3aed" clipPath={`url(#body-${side})`} opacity="0.75" />
          {/* LATS — low */}
          <Path d="M18 32 Q50 42 82 32 L82 60 Q50 68 18 60 Z" fill="#2d5a8a" clipPath={`url(#body-${side})`} opacity="0.65" />
          <Line x1="50" y1="22" x2="50" y2="87" stroke="#1e3a5f" strokeWidth="0.8" opacity="0.5" clipPath={`url(#body-${side})`} />
          {/* LOWER BACK */}
          <Rect x="32" y="60" width="36" height="24" rx="3" fill="#2d5a8a" clipPath={`url(#body-${side})`} opacity="0.55" />
          {/* GLUTES back — BRIGHTEST cyan */}
          <Path d="M22 87 Q50 80 78 87 L80 116 Q50 124 20 116 Z" fill="#0e7490" clipPath={`url(#body-${side})`} opacity="1" />
          <Ellipse cx="36" cy="102" rx="13" ry="14" fill="#22d3ee" clipPath={`url(#body-${side})`} opacity="0.5" />
          <Ellipse cx="64" cy="102" rx="13" ry="14" fill="#22d3ee" clipPath={`url(#body-${side})`} opacity="0.5" />
          <Line x1="50" y1="85" x2="50" y2="120" stroke="#0891b2" strokeWidth="0.8" opacity="0.5" clipPath={`url(#body-${side})`} />
          {/* HAMSTRINGS — purple */}
          <Path d="M20 116 L16 148 L36 148 L40 116 Z" fill="#7c3aed" clipPath={`url(#body-${side})`} opacity="0.7" />
          <Path d="M80 116 L84 148 L64 148 L60 116 Z" fill="#7c3aed" clipPath={`url(#body-${side})`} opacity="0.7" />
        </>
      )}

      {/* KNEES */}
      <Ellipse cx="29" cy="150" rx="9" ry="6" fill="#111e30" clipPath={`url(#body-${side})`} />
      <Ellipse cx="71" cy="150" rx="9" ry="6" fill="#111e30" clipPath={`url(#body-${side})`} />

      {/* CALVES */}
      <Path d="M20 156 C18 164 20 172 21 176 L37 176 C38 172 40 164 38 156 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.85" />
      <Path d="M62 156 C60 164 62 172 63 176 L79 176 C80 172 82 164 80 156 Z" fill="#1e3d6a" clipPath={`url(#body-${side})`} opacity="0.85" />

      {/* OUTLINE */}
      <Circle cx="50" cy="10" r="9" fill="none" stroke="#2d5a8a" strokeWidth="1" />
      <Path d="M41 20 C34 20 18 25 17 34 C16 43 26 51 29 60 C26 69 17 76 18 87 L82 87 C83 76 74 69 71 60 C74 51 84 43 83 34 C82 25 66 20 59 20 Z" fill="none" stroke="#2d5a8a" strokeWidth="1" />
      <Path d="M29 60 L18 87 L18 180 L40 180 L44 95 L50 95 L56 95 L60 180 L82 180 L82 87 L71 60 Z" fill="none" stroke="#2d5a8a" strokeWidth="1" />
    </Svg>
  )
}

export default function ResultsScreen({ onBack }: { onBack: () => void }) {
  const onShare = async () => {
    try {
      await Share.share({
        message: 'My 8-week body arc on Morphe — Glutes +18%, Arms +12%, Shoulders +9%. Week 9 score: 78/100',
      })
    } catch {}
  }

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={s.back}>← Home</Text>
          </TouchableOpacity>
          <Text style={s.title}>Week 9 Results</Text>
          <TouchableOpacity onPress={onShare}>
            <Text style={s.shareBtn}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={s.scoreBanner}>
          <View>
            <Text style={s.arcLabel}>THIS WEEK'S ARC</Text>
            <Text style={s.pts}>+6 pts</Text>
            <Text style={s.total}>Total: 78 / 100</Text>
          </View>
          <View style={s.scoreRing}>
            <Text style={s.scoreNum}>78</Text>
            <Text style={s.scoreLbl}>SCORE</Text>
          </View>
        </View>

        {/* Body heatmap */}
        <View style={s.avatarCard}>
          <View style={s.avatarHeader}>
            <Text style={s.avatarTitle}>8 WEEK GROWTH MAP</Text>
            <View style={s.legendRow}>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#22d3ee' }]} /><Text style={[s.legendLbl, { color: '#22d3ee' }]}>High</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#a78bfa' }]} /><Text style={[s.legendLbl, { color: '#a78bfa' }]}>Mid</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#f87171' }]} /><Text style={[s.legendLbl, { color: '#f87171' }]}>Loss</Text></View>
            </View>
          </View>
          <View style={s.figureRow}>
            <View style={s.figureCol}>
              <Text style={s.figureLabel}>FRONT</Text>
              <BodyFigure side="front" />
            </View>
            <View style={s.figureCol}>
              <Text style={s.figureLabel}>BACK</Text>
              <BodyFigure side="back" />
            </View>
          </View>
        </View>

        <Text style={s.sectionTitle}>Breakdown</Text>
        {MOCK_MUSCLES.map(m => (
          <View key={m.label} style={s.muscleRow}>
            <View style={[s.muscleDot, { backgroundColor: m.heat }]} />
            <Text style={s.muscleLabel}>{m.label}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, {
                width: `${Math.min(Math.abs(m.pct) * 4, 100)}%` as any,
                backgroundColor: m.pct < 0 ? '#DC2626' : colors.primary,
              }]} />
            </View>
            <Text style={[s.musclePct, { color: m.pct < 0 ? '#DC2626' : colors.primary }]}>
              {m.pct > 0 ? '+' : ''}{m.pct}%
            </Text>
          </View>
        ))}

        <View style={s.insight}>
          <Text style={s.insightTitle}>Morphe insight</Text>
          <Text style={s.insightText}>
            Glutes growing 2x faster than average. Waist narrowing — classic recomp. Keep your split.
          </Text>
        </View>

        <View style={s.btnRow}>
          <TouchableOpacity style={s.btnMain} onPress={onShare}>
            <Text style={s.btnMainText}>Share results</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSec} onPress={onBack}>
            <Text style={s.btnSecText}>Back to home</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  back: { fontSize: 13, fontWeight: '600', color: colors.ink },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  shareBtn: { fontSize: 13, fontWeight: '700', color: colors.primary },
  scoreBanner: {
    backgroundColor: colors.primaryTint,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  arcLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: colors.primary, marginBottom: 2 },
  pts: { fontSize: 34, fontWeight: '800', letterSpacing: -1.5, color: colors.ink, lineHeight: 36 },
  total: { fontSize: 11, color: colors.muted, marginTop: 2 },
  scoreRing: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: colors.score.greenTint,
    borderWidth: 2.5, borderColor: colors.score.green,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum: { fontSize: 15, fontWeight: '800', color: colors.ink, lineHeight: 17 },
  scoreLbl: { fontSize: 7, fontWeight: '700', color: colors.score.green, letterSpacing: 0.3 },
  avatarCard: { backgroundColor: '#07111e', borderRadius: 18, overflow: 'hidden', marginBottom: 16, padding: 14 },
  avatarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  avatarTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#4b7ab5' },
  legendRow: { flexDirection: 'row', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLbl: { fontSize: 9, fontWeight: '700' },
  figureRow: { flexDirection: 'row', justifyContent: 'space-around' },
  figureCol: { alignItems: 'center', gap: 6 },
  figureLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#4b7ab5' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  muscleDot: { width: 8, height: 8, borderRadius: 4 },
  muscleLabel: { fontSize: 12, color: colors.muted, width: 70 },
  barTrack: { flex: 1, backgroundColor: '#F2F1ED', borderRadius: 2, height: 4 },
  barFill: { height: 4, borderRadius: 2 },
  musclePct: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
  insight: {
    backgroundColor: colors.primaryTint, borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: '#BFDBFE', marginTop: 4, marginBottom: 16,
  },
  insightTitle: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 3 },
  insightText: { fontSize: 12, color: colors.primary, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnMain: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnMainText: { color: 'white', fontSize: 14, fontWeight: '800' },
  btnSec: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#BFDBFE' },
  btnSecText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
})