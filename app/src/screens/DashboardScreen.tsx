import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'
import { StatusBar } from 'expo-status-bar'

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

const MOCK = {
  name: 'Oumy',
  score: 78,
  streak: 12,
  scanDue: 3,
  muscles: [
    { id: 'glutes',    label: 'Glutes',    pct: 18, weeks: 8 },
    { id: 'arms',      label: 'Arms',      pct: 12, weeks: 8 },
    { id: 'shoulders', label: 'Shoulders', pct: 9,  weeks: 8 },
    { id: 'waist',     label: 'Waist',     pct: -3, weeks: 8 },
    { id: 'quads',     label: 'Quads',     pct: 6,  weeks: 8 },
    { id: 'chest',     label: 'Chest',     pct: 4,  weeks: 8 },
  ],
}

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

export default function DashboardScreen({ onScan }: { onScan: () => void }) {
  const sc = getScoreColor(MOCK.score)

  return (
    <View style={s.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getHour()},</Text>
            <Text style={s.name}>{MOCK.name}</Text>
          </View>
          <View style={s.streakPill}>
            <View style={[s.streakDot, { backgroundColor: colors.primary }]} />
            <Text style={s.streakText}>{MOCK.streak} week streak</Text>
          </View>
        </View>

        {/* Score card */}
        <View style={s.scoreCard}>
          <View style={[s.scoreRing, { borderColor: sc.color, backgroundColor: sc.tint }]}>
            <Text style={s.scoreNum}>{MOCK.score}</Text>
            <Text style={[s.scoreLabel, { color: sc.color }]}>SCORE</Text>
          </View>
          <View style={s.scoreInfo}>
            <Text style={s.scoreTitle}>{sc.label}</Text>
            <Text style={s.scoreSub}>+6 pts this week. Glutes accelerating.</Text>
            <TouchableOpacity style={s.scanBtn} onPress={onScan}>
              <Text style={s.scanBtnText}>SCAN IN {MOCK.scanDue} DAYS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Muscle grid */}
        <Text style={s.sectionTitle}>Muscle tracking</Text>
        <View style={s.grid}>
          {MOCK.muscles.map(m => (
            <MuscleCard key={m.id} {...m} />
          ))}
          <TouchableOpacity style={s.scanNowCard} onPress={onScan}>
            <Text style={s.scanNowWeek}>Week 9</Text>
            <Text style={s.scanNowLabel}>scan</Text>
            <Text style={s.scanNowArrow}>Scan now →</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Bottom nav */}
      <View style={s.nav}>
        <NavItem label="Home" active />
        <NavItem label="Scan" onPress={onScan} />
        <NavItem label="Progress" />
        <NavItem label="Profile" />
      </View>
    </View>
  )
}

function MuscleCard({ label, pct, weeks }: { label: string; pct: number; weeks: number }) {
  const positive = pct >= 0
  const barColor = positive ? colors.primary : colors.score.red
  const barWidth = Math.min(Math.abs(pct) * 4, 100)

  return (
    <View style={s.muscleCard}>
      <Text style={s.muscleLabel}>{label.toUpperCase()}</Text>
      <Text style={[s.musclePct, { color: positive ? colors.primary : colors.score.red }]}>
        {positive ? '+' : ''}{pct}%
      </Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={s.muscleWeeks}>{weeks} week arc</Text>
    </View>
  )
}

function NavItem({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={s.navItem} onPress={onPress}>
      <Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 13, color: colors.muted },
  name: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryTint,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  streakDot: { width: 6, height: 6, borderRadius: 3 },
  streakText: { fontSize: 11, fontWeight: '700', color: '#0F2D6B' },
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  scoreRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreNum: { fontSize: 22, fontWeight: '800', color: colors.ink, lineHeight: 24 },
  scoreLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 3 },
  scoreSub: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  scanBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  scanBtnText: { fontSize: 10, fontWeight: '800', color: 'white', letterSpacing: 0.4 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  muscleCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 14,
    width: '47%',
  },
  muscleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.hint,
    marginBottom: 6,
  },
  musclePct: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  barTrack: {
    height: 4,
    backgroundColor: colors.background,
    borderRadius: 2,
    marginBottom: 6,
  },
  barFill: { height: 4, borderRadius: 2 },
  muscleWeeks: { fontSize: 10, color: colors.hint },
  scanNowCard: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 14,
    width: '47%',
    justifyContent: 'space-between',
  },
  scanNowWeek: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  scanNowLabel: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 12 },
  scanNowArrow: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingBottom: 28,
    paddingTop: 12,
  },
  navItem: { flex: 1, alignItems: 'center' },
  navLabel: { fontSize: 11, fontWeight: '600', color: colors.hint },
  navLabelActive: { color: colors.primary },
})