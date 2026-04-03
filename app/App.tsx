import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import { useState } from 'react'
import ScanScreen from './src/screens/ScanScreen'

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
}

type Screen = 'splash' | 'goals' | 'bodyparts' | 'scan' | 'done'

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  if (screen === 'splash') return <Splash onNext={() => setScreen('goals')} />
  if (screen === 'goals') return <Goals onNext={() => setScreen('bodyparts')} />
  if (screen === 'bodyparts') return <BodyParts onNext={() => setScreen('done')} />
  if (screen === 'scan') return <ScanScreen onBack={() => setScreen('done')} />
  return <Done onScan={() => setScreen('scan')} />
}

function Splash({ onNext }: { onNext: () => void }) {
  return (
    <View style={[s.screen, { justifyContent: 'center' }]}>
      <StatusBar style="dark" />
      <View style={s.logoBox}>
        <Text style={s.logoLetter}>M</Text>
      </View>
      <Text style={s.title}>Morphe</Text>
      <Text style={s.subtitle}>Watch your body transform,{'\n'}one scan at a time.</Text>
      <TouchableOpacity style={s.btnMain} onPress={onNext}>
        <Text style={s.btnMainText}>Get started</Text>
      </TouchableOpacity>
    </View>
  )
}

const GOALS = [
  { id: 'muscle', label: 'Build muscle', sub: 'Track muscle growth week over week' },
  { id: 'fat', label: 'Lose fat', sub: 'See definition and composition improve' },
  { id: 'recomp', label: 'Body recomposition', sub: 'Build muscle and lose fat together' },
  { id: 'posture', label: 'Fix posture & symmetry', sub: 'Alignment, balance, symmetry' },
  { id: 'overall', label: 'Track overall progress', sub: 'Full body evolution over time' },
]

function Goals({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.progressRow}>
        {[0,1,2].map(i => <View key={i} style={[s.dot, i === 0 && s.dotActive]} />)}
      </View>
      <Text style={s.stepLabel}>STEP 1 OF 3</Text>
      <Text style={s.heading}>What are your{'\n'}goals?</Text>
      <Text style={s.para}>Choose everything that applies to you.</Text>
      {selected.length > 0 && (
        <Text style={s.countLabel}>{selected.length} goal{selected.length > 1 ? 's' : ''} selected</Text>
      )}
      <View style={s.list}>
        {GOALS.map(g => {
          const on = selected.includes(g.id)
          return (
            <TouchableOpacity key={g.id} style={[s.card, on && s.cardSel]} onPress={() => toggle(g.id)}>
              <View style={s.cardText}>
                <Text style={[s.cardTitle, on && s.cardTitleSel]}>{g.label}</Text>
                <Text style={s.cardSub}>{g.sub}</Text>
              </View>
              <View style={[s.checkbox, on && s.checkboxSel]}>
                {on && <Text style={s.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
      <TouchableOpacity
        style={[s.btnMain, selected.length === 0 && s.btnDisabled]}
        onPress={onNext}
        disabled={selected.length === 0}
      >
        <Text style={s.btnMainText}>Continue</Text>
      </TouchableOpacity>
    </View>
  )
}

const BODY_PARTS = [
  { id: 'shoulders', label: 'Shoulders', group: 'UPPER BODY' },
  { id: 'arms', label: 'Arms', group: 'UPPER BODY' },
  { id: 'chest', label: 'Chest', group: 'UPPER BODY' },
  { id: 'back', label: 'Back', group: 'UPPER BODY' },
  { id: 'abs', label: 'Abs', group: 'CORE' },
  { id: 'waist', label: 'Waist', group: 'CORE' },
  { id: 'glutes', label: 'Glutes', group: 'LOWER BODY' },
  { id: 'quads', label: 'Quads', group: 'LOWER BODY' },
  { id: 'hamstrings', label: 'Hamstrings', group: 'LOWER BODY' },
  { id: 'calves', label: 'Calves', group: 'LOWER BODY' },
  { id: 'hips', label: 'Hips', group: 'LOWER BODY' },
]

const GROUPS = ['UPPER BODY', 'CORE', 'LOWER BODY']

function BodyParts({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.progressRow}>
        {[0,1,2].map(i => <View key={i} style={[s.dot, i <= 1 && s.dotActive]} />)}
      </View>
      <Text style={s.stepLabel}>STEP 2 OF 3</Text>
      <Text style={s.heading}>Which areas{'\n'}to track?</Text>
      <Text style={s.para}>Pick as many as you want.</Text>
      {selected.length > 0 && (
        <Text style={s.countLabel}>{selected.length} area{selected.length > 1 ? 's' : ''} selected</Text>
      )}
      <View style={{ flex: 1 }}>
        {GROUPS.map(group => (
          <View key={group} style={{ marginBottom: 14 }}>
            <Text style={s.groupLabel}>{group}</Text>
            <View style={s.chipRow}>
              {BODY_PARTS.filter(p => p.group === group).map(p => {
                const on = selected.includes(p.id)
                return (
                  <TouchableOpacity key={p.id} style={[s.chip, on && s.chipSel]} onPress={() => toggle(p.id)}>
                    <Text style={[s.chipText, on && s.chipTextSel]}>{p.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={[s.btnMain, selected.length === 0 && s.btnDisabled]}
        onPress={onNext}
        disabled={selected.length === 0}
      >
        <Text style={s.btnMainText}>Continue</Text>
      </TouchableOpacity>
    </View>
  )
}

function Done({ onScan }: { onScan: () => void }) {
  return (
    <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <StatusBar style="dark" />
      <View style={s.doneIcon}>
        <Text style={{ fontSize: 32 }}>✓</Text>
      </View>
      <Text style={[s.title, { textAlign: 'center' }]}>You're all set.</Text>
      <Text style={[s.subtitle, { textAlign: 'center' }]}>
        Morphe will track exactly what you chose.{'\n'}Take your first scan to set your baseline.
      </Text>
      <TouchableOpacity style={s.btnMain} onPress={onScan}>
        <Text style={s.btnMainText}>Take my first scan</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 28, paddingTop: 60 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.primary, marginBottom: 10 },
  heading: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -1, lineHeight: 36, marginBottom: 6 },
  para: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  countLabel: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 16 },
  list: { flex: 1, gap: 10 },
  card: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardSel: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  cardTitleSel: { color: colors.primary },
  cardSub: { fontSize: 12, color: colors.muted },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '800' },
  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: colors.hint, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.surface },
  chipSel: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.body },
  chipTextSel: { color: colors.primary },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24, alignSelf: 'center' },
  logoLetter: { fontSize: 36, fontWeight: '800', color: 'white' },
  title: { fontSize: 38, fontWeight: '800', color: colors.ink, letterSpacing: -1.5, marginBottom: 10, alignSelf: 'center' },
  subtitle: { fontSize: 16, color: colors.muted, lineHeight: 24, marginBottom: 48, alignSelf: 'center' },
  btnMain: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  btnDisabled: { backgroundColor: colors.hint },
  btnMainText: { color: 'white', fontSize: 15, fontWeight: '800' },
  doneIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.primaryTint, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
})