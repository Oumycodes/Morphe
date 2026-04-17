import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native'
import { useState, useEffect } from 'react'
import ScanScreen from './src/screens/ScanScreen'
import DashboardScreen from './src/screens/DashboardScreen'
import ResultsScreen from './src/screens/ResultsScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import AuthScreen from './src/screens/AuthScreen'
import { supabase } from './src/lib/supabase'

const c = {
  bg: '#0A0E17', card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.06)',
  cardHover: 'rgba(255,255,255,0.08)',
  primary: '#1746A2', primaryTint: 'rgba(23,70,162,0.12)', primaryBorder: 'rgba(23,70,162,0.2)',
  text: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', muted: 'rgba(255,255,255,0.4)',
  hint: 'rgba(255,255,255,0.25)', border: 'rgba(255,255,255,0.06)',
  cyan: '#22d3ee', green: '#16A34A',
}

type GoalType = 'fat_loss' | 'muscle_gain' | 'recomposition'
type MuscleGroup = 'shoulders' | 'hips' | 'glutes'
type GoalSpeed = 'slow' | 'moderate' | 'fast'

interface UserGoal {
  type: GoalType | null; target_muscles: MuscleGroup[]
  target_fat_loss_pct: number; target_muscle_gain_pct: number
  weights: { fat: number; muscle: number }; timeline_weeks: number
  gender?: string; workout_freq?: string; goal_speed?: GoalSpeed
}
const defaultGoal: UserGoal = {
  type: null, target_muscles: [], target_fat_loss_pct: 5, target_muscle_gain_pct: 4,
  weights: { fat: 0.5, muscle: 0.5 }, timeline_weeks: 8,
}

type Screen = 'splash' | 'gender' | 'workout' | 'goal_type' | 'target_muscles' | 'goal_speed' | 'prediction'
  | 'scan' | 'dashboard' | 'results' | 'profile'
  | 'edit_goal_type' | 'edit_target_muscles' | 'edit_speed' | 'done'

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.progressBar}>
      <View style={[s.progressFill, { width: `${(step / total) * 100}%` as any }]} />
    </View>
  )
}

// ── Nav icons ────────────────────────────────────────────────────────────────

function IconHome({ active }: { active?: boolean }) {
  const col = active ? c.primary : c.hint
  return <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: col }} /><View style={{ width: 18, height: 11, backgroundColor: col, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} /></View>
}
function IconProgress({ active }: { active?: boolean }) {
  const col = active ? c.primary : c.hint
  return <View style={{ width: 24, height: 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, paddingBottom: 1 }}><View style={{ width: 5, height: 9, backgroundColor: col, borderRadius: 2 }} /><View style={{ width: 5, height: 14, backgroundColor: col, borderRadius: 2 }} /><View style={{ width: 5, height: 11, backgroundColor: col, borderRadius: 2 }} /><View style={{ width: 5, height: 19, backgroundColor: col, borderRadius: 2 }} /></View>
}
function IconProfile({ active }: { active?: boolean }) {
  const col = active ? c.primary : c.hint
  return <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', gap: 2 }}><View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: col }} /><View style={{ width: 17, height: 7, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 2, borderColor: col, borderBottomWidth: 0 }} /></View>
}

function PersistentNav({ screen, setScreen, scanAllowed }: { screen: Screen; setScreen: (s: Screen) => void; scanAllowed: boolean }) {
  return (
    <View style={nav.wrap}>
      <View style={nav.pill}>
        <TouchableOpacity style={nav.item} onPress={() => setScreen('dashboard')}><IconHome active={screen === 'dashboard'} /><Text style={[nav.label, screen === 'dashboard' && nav.labelActive]}>Home</Text></TouchableOpacity>
        <TouchableOpacity style={nav.item} onPress={() => setScreen('results')}><IconProgress active={screen === 'results'} /><Text style={[nav.label, screen === 'results' && nav.labelActive]}>Progress</Text></TouchableOpacity>
        <TouchableOpacity style={nav.item} onPress={() => setScreen('profile')}><IconProfile active={screen === 'profile'} /><Text style={[nav.label, screen === 'profile' && nav.labelActive]}>Profile</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={[nav.fab, !scanAllowed && nav.fabDisabled]} onPress={scanAllowed ? () => setScreen('scan') : undefined} activeOpacity={0.85}><View style={nav.fabH} /><View style={nav.fabV} /></TouchableOpacity>
    </View>
  )
}

// ── Speed to concrete values ────────────────────────────────────────────────

function speedToGoalValues(speed: GoalSpeed, goalType: GoalType | null) {
  const map = {
    slow:     { fat: 3, muscle: 2, weeks: 16 },
    moderate: { fat: 5, muscle: 4, weeks: 10 },
    fast:     { fat: 8, muscle: 6, weeks: 8 },
  }
  const v = map[speed]
  const weights = goalType === 'recomposition'
    ? { fat: 0.5, muscle: 0.5 }
    : goalType === 'fat_loss' ? { fat: 1, muscle: 0 } : { fat: 0, muscle: 1 }
  return {
    target_fat_loss_pct: v.fat,
    target_muscle_gain_pct: v.muscle,
    timeline_weeks: v.weeks,
    weights,
    goal_speed: speed,
  }
}

function getPredictionDate(weeks: number): string {
  const d = new Date(); d.setDate(d.getDate() + weeks * 7)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function getPredictionText(goal: UserGoal): string {
  const date = getPredictionDate(goal.timeline_weeks)
  if (goal.type === 'fat_loss') return `By ${date}, you'll see visible fat loss and a leaner waistline.`
  if (goal.type === 'muscle_gain') {
    const muscles = (goal.target_muscles || []).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' & ')
    return `By ${date}, your ${muscles || 'target muscles'} will show measurable growth.`
  }
  return `By ${date}, you'll see a leaner, more muscular physique.`
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [screen, setScreen] = useState<Screen>('splash')
  const [checked, setChecked] = useState(false)
  const [goal, setGoal] = useState<UserGoal>(defaultGoal)
  const [editGoal, setEditGoal] = useState<UserGoal>(defaultGoal)
  const [scanAllowed, setScanAllowed] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('goal').eq('id', session.user.id).single()
        if (profile?.goal?.type) { setGoal({ ...defaultGoal, ...profile.goal }); setScreen('dashboard') }
        else setScreen('splash')
      }
      setChecked(true)
    })
    supabase.auth.onAuthStateChange((_event, session) => { setSession(session); if (!session) setScreen('splash') })
  }, [])

  if (!checked) return null
  if (!session) return <AuthScreen onAuth={() => setScreen('splash')} />

  const showNav = screen === 'dashboard' || screen === 'results' || screen === 'profile'
  const TOTAL_STEPS = goal.type === 'fat_loss' ? 5 : 6

  const saveGoalAndFinish = async (finalGoal: UserGoal) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const payload = finalGoal.type === 'fat_loss' ? { ...finalGoal, target_muscles: [] } : finalGoal
        await supabase.from('profiles').upsert({ id: user.id, goal: payload })
      }
    } catch (e) { console.log('Save error:', e) }
    setGoal(finalGoal); setScreen('done')
  }

  // Edit goal flow
  const startEditGoal = () => { setEditGoal({ ...goal }); setScreen('edit_goal_type') }
  const handleEditGoalType = (type: GoalType) => { setEditGoal({ ...editGoal, type }); setScreen(type === 'fat_loss' ? 'edit_speed' : 'edit_target_muscles') }
  const handleEditTargetMuscles = (muscles: MuscleGroup[]) => { setEditGoal({ ...editGoal, target_muscles: muscles }); setScreen('edit_speed') }
  const handleEditSpeed = async (speed: GoalSpeed) => {
    const final: UserGoal = { ...editGoal, ...speedToGoalValues(speed, editGoal.type) }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { const payload = final.type === 'fat_loss' ? { ...final, target_muscles: [] } : final; await supabase.from('profiles').update({ goal: payload }).eq('id', user.id) }
    } catch (e) { console.log('Save error:', e) }
    setGoal(final); setScreen('profile')
  }

  const renderScreen = () => {
    // Onboarding
    if (screen === 'splash') return <Splash onNext={() => setScreen('gender')} />
    if (screen === 'gender') return <GenderScreen step={1} total={TOTAL_STEPS} onNext={(g) => { setGoal({ ...goal, gender: g }); setScreen('workout') }} />
    if (screen === 'workout') return <WorkoutScreen step={2} total={TOTAL_STEPS} onBack={() => setScreen('gender')} onNext={(f) => { setGoal({ ...goal, workout_freq: f }); setScreen('goal_type') }} />
    if (screen === 'goal_type') return <GoalTypeScreen step={3} total={TOTAL_STEPS} onBack={() => setScreen('workout')} onNext={(t) => { setGoal({ ...goal, type: t }); setScreen(t === 'fat_loss' ? 'goal_speed' : 'target_muscles') }} />
    if (screen === 'target_muscles') return <TargetMusclesScreen step={4} total={TOTAL_STEPS} onBack={() => setScreen('goal_type')} onNext={(m) => { setGoal({ ...goal, target_muscles: m }); setScreen('goal_speed') }} />
    if (screen === 'goal_speed') return <GoalSpeedScreen step={goal.type === 'fat_loss' ? 4 : 5} total={TOTAL_STEPS} goalType={goal.type!} onBack={() => setScreen(goal.type === 'fat_loss' ? 'goal_type' : 'target_muscles')} onNext={(speed) => {
      const final = { ...goal, ...speedToGoalValues(speed, goal.type) }
      setGoal(final); setScreen('prediction')
    }} />
    if (screen === 'prediction') return <PredictionScreen goal={goal} onNext={() => saveGoalAndFinish(goal)} />
    if (screen === 'done') return <Done onScan={() => setScreen('scan')} />

    // Edit goal
    if (screen === 'edit_goal_type') return <GoalTypeScreen step={1} total={3} initialSelected={editGoal.type} onBack={() => setScreen('profile')} onNext={handleEditGoalType} />
    if (screen === 'edit_target_muscles') return <TargetMusclesScreen step={2} total={3} initialSelected={editGoal.target_muscles} onBack={() => setScreen('edit_goal_type')} onNext={handleEditTargetMuscles} />
    if (screen === 'edit_speed') return <GoalSpeedScreen step={editGoal.type === 'fat_loss' ? 2 : 3} total={3} goalType={editGoal.type!} initialSpeed={editGoal.goal_speed} onBack={() => setScreen(editGoal.type === 'fat_loss' ? 'edit_goal_type' : 'edit_target_muscles')} onNext={handleEditSpeed} />

    // Main
    if (screen === 'scan') return <ScanScreen onBack={() => setScreen('dashboard')} />
    if (screen === 'dashboard') return <DashboardScreen onScan={() => setScreen('scan')} onResults={() => setScreen('results')} onScanAllowedChange={setScanAllowed} />
    if (screen === 'results') return <ResultsScreen />
    if (screen === 'profile') return <ProfileScreen onEditGoal={startEditGoal} />
    return <Done onScan={() => setScreen('scan')} />
  }

  return <View style={{ flex: 1 }}>{renderScreen()}{showNav && <PersistentNav screen={screen} setScreen={setScreen} scanAllowed={scanAllowed} />}</View>
}

// ── Splash ───────────────────────────────────────────────────────────────────

function Splash({ onNext }: { onNext: () => void }) {
  return (
    <View style={[s.screen, { justifyContent: 'center' }]}>
      <StatusBar style="light" />
      <View style={s.logoBox}><Text style={s.logoLetter}>M</Text></View>
      <Text style={s.title}>Morphe</Text>
      <Text style={s.subtitle}>Watch your body transform,{'\n'}one scan at a time.</Text>
      <TouchableOpacity style={s.btnMain} onPress={onNext}><Text style={s.btnMainText}>Get started</Text></TouchableOpacity>
    </View>
  )
}

// ── Gender ───────────────────────────────────────────────────────────────────

const GENDERS = [
  { id: 'male', label: 'Male', icon: '🙋‍♂️' },
  { id: 'female', label: 'Female', icon: '🙋‍♀️' },
  { id: 'other', label: 'Other', icon: '🧑' },
]

function GenderScreen({ step, total, onNext }: { step: number; total: number; onNext: (g: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <ProgressBar step={step} total={total} />
      <Text style={s.heading}>What's your{'\n'}gender?</Text>
      <Text style={s.para}>This helps calibrate your body analysis.</Text>
      <View style={[s.list, { marginTop: 24 }]}>
        {GENDERS.map(g => {
          const on = selected === g.id
          return (
            <TouchableOpacity key={g.id} style={[s.card, on && s.cardSel]} onPress={() => setSelected(g.id)}>
              <Text style={{ fontSize: 24, marginRight: 4 }}>{g.icon}</Text>
              <Text style={[s.cardTitle, on && s.cardTitleSel, { flex: 1, marginBottom: 0 }]}>{g.label}</Text>
              <View style={[s.radio, on && s.radioSel]}>{on && <View style={s.radioDot} />}</View>
            </TouchableOpacity>
          )
        })}
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={[s.btnMain, !selected && s.btnDisabled]} onPress={() => selected && onNext(selected)} disabled={!selected}><Text style={s.btnMainText}>Next</Text></TouchableOpacity>
    </View>
  )
}

// ── Workout frequency ────────────────────────────────────────────────────────

const FREQUENCIES = [
  { id: 'low', label: '0–2', sub: 'Workouts now and then', dots: 1 },
  { id: 'moderate', label: '3–5', sub: 'A few workouts per week', dots: 3 },
  { id: 'high', label: '6+', sub: 'Dedicated athlete', dots: 6 },
]

function WorkoutScreen({ step, total, onBack, onNext }: { step: number; total: number; onBack: () => void; onNext: (f: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backText}>←</Text></TouchableOpacity>
      <ProgressBar step={step} total={total} />
      <Text style={s.heading}>How many workouts{'\n'}per week?</Text>
      <Text style={s.para}>This helps us set realistic expectations.</Text>
      <View style={[s.list, { marginTop: 24 }]}>
        {FREQUENCIES.map(f => {
          const on = selected === f.id
          return (
            <TouchableOpacity key={f.id} style={[s.card, on && s.cardSel]} onPress={() => setSelected(f.id)}>
              <View style={s.dotsWrap}>{Array.from({ length: f.dots }).map((_, i) => <View key={i} style={[s.activityDot, on && { backgroundColor: c.primary }]} />)}</View>
              <View style={{ flex: 1 }}><Text style={[s.cardTitle, on && s.cardTitleSel, { marginBottom: 2 }]}>{f.label}</Text><Text style={s.cardSub}>{f.sub}</Text></View>
              <View style={[s.radio, on && s.radioSel]}>{on && <View style={s.radioDot} />}</View>
            </TouchableOpacity>
          )
        })}
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={[s.btnMain, !selected && s.btnDisabled]} onPress={() => selected && onNext(selected)} disabled={!selected}><Text style={s.btnMainText}>Next</Text></TouchableOpacity>
    </View>
  )
}

// ── Goal type ────────────────────────────────────────────────────────────────

const GOAL_TYPES: { id: GoalType; label: string; sub: string; icon: string }[] = [
  { id: 'fat_loss', label: 'Lose fat', sub: 'Get leaner, see more definition', icon: '🔥' },
  { id: 'muscle_gain', label: 'Build muscle', sub: 'Grow the muscles you choose', icon: '💪' },
  { id: 'recomposition', label: 'Both', sub: 'Lose fat and build muscle together', icon: '⚡' },
]

function GoalTypeScreen({ step, total, initialSelected, onBack, onNext }: { step: number; total: number; initialSelected?: GoalType | null; onBack?: () => void; onNext: (t: GoalType) => void }) {
  const [selected, setSelected] = useState<GoalType | null>(initialSelected || null)
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      {onBack && <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backText}>←</Text></TouchableOpacity>}
      <ProgressBar step={step} total={total} />
      <Text style={s.heading}>What's your{'\n'}main goal?</Text>
      <Text style={s.para}>Pick the one that fits best.</Text>
      <View style={[s.list, { marginTop: 24 }]}>
        {GOAL_TYPES.map(g => {
          const on = selected === g.id
          return (
            <TouchableOpacity key={g.id} style={[s.card, on && s.cardSel]} onPress={() => setSelected(g.id)}>
              <Text style={{ fontSize: 22, marginRight: 4 }}>{g.icon}</Text>
              <View style={{ flex: 1 }}><Text style={[s.cardTitle, on && s.cardTitleSel, { marginBottom: 2 }]}>{g.label}</Text><Text style={s.cardSub}>{g.sub}</Text></View>
              <View style={[s.radio, on && s.radioSel]}>{on && <View style={s.radioDot} />}</View>
            </TouchableOpacity>
          )
        })}
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={[s.btnMain, !selected && s.btnDisabled]} onPress={() => selected && onNext(selected)} disabled={!selected}><Text style={s.btnMainText}>Next</Text></TouchableOpacity>
    </View>
  )
}

// ── Target muscles ───────────────────────────────────────────────────────────

const MUSCLES: { id: MuscleGroup; label: string; icon: string }[] = [
  { id: 'shoulders', label: 'Shoulders', icon: '🏋️' },
  { id: 'hips', label: 'Hips', icon: '🦵' },
  { id: 'glutes', label: 'Glutes', icon: '🍑' },
]

function TargetMusclesScreen({ step, total, initialSelected, onBack, onNext }: { step: number; total: number; initialSelected?: MuscleGroup[]; onBack: () => void; onNext: (m: MuscleGroup[]) => void }) {
  const [selected, setSelected] = useState<MuscleGroup[]>(initialSelected || [])
  const toggle = (id: MuscleGroup) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backText}>←</Text></TouchableOpacity>
      <ProgressBar step={step} total={total} />
      <Text style={s.heading}>Which muscles{'\n'}do you want to grow?</Text>
      <Text style={s.para}>We'll track these closely and score your progress on them.</Text>
      <View style={[s.list, { marginTop: 24 }]}>
        {MUSCLES.map(m => {
          const on = selected.includes(m.id)
          return (
            <TouchableOpacity key={m.id} style={[s.card, on && s.cardSel]} onPress={() => toggle(m.id)}>
              <Text style={{ fontSize: 22, marginRight: 4 }}>{m.icon}</Text>
              <Text style={[s.cardTitle, on && s.cardTitleSel, { flex: 1, marginBottom: 0 }]}>{m.label}</Text>
              <View style={[s.checkbox, on && s.checkboxSel]}>{on && <Text style={s.checkmark}>✓</Text>}</View>
            </TouchableOpacity>
          )
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Text style={s.noteText}>More muscle groups coming soon.</Text>
      <TouchableOpacity style={[s.btnMain, selected.length === 0 && s.btnDisabled]} onPress={() => onNext(selected)} disabled={selected.length === 0}><Text style={s.btnMainText}>Next</Text></TouchableOpacity>
    </View>
  )
}

// ── Goal speed ───────────────────────────────────────────────────────────────

const SPEEDS: { id: GoalSpeed; label: string; sub: string; icon: string; weeks: number }[] = [
  { id: 'slow', label: 'Steady', sub: 'Sustainable long-term change', icon: '🐢', weeks: 16 },
  { id: 'moderate', label: 'Moderate', sub: 'Balanced pace, visible results', icon: '🐇', weeks: 10 },
  { id: 'fast', label: 'Aggressive', sub: 'Push hard, faster results', icon: '🐆', weeks: 8 },
]

function GoalSpeedScreen({ step, total, goalType, initialSpeed, onBack, onNext }: { step: number; total: number; goalType: GoalType; initialSpeed?: GoalSpeed; onBack: () => void; onNext: (s: GoalSpeed) => void }) {
  const [selected, setSelected] = useState<GoalSpeed | null>(initialSpeed || null)
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backText}>←</Text></TouchableOpacity>
      <ProgressBar step={step} total={total} />
      <Text style={s.heading}>How fast do you{'\n'}want results?</Text>
      <Text style={s.para}>We'll adjust your targets and timeline.</Text>
      <View style={[s.list, { marginTop: 24 }]}>
        {SPEEDS.map(sp => {
          const on = selected === sp.id
          return (
            <TouchableOpacity key={sp.id} style={[s.card, on && s.cardSel, { paddingVertical: 20 }]} onPress={() => setSelected(sp.id)}>
              <Text style={{ fontSize: 28 }}>{sp.icon}</Text>
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={[s.cardTitle, on && s.cardTitleSel, { marginBottom: 2 }]}>{sp.label}</Text>
                <Text style={s.cardSub}>{sp.sub}</Text>
                <Text style={[s.cardSub, { marginTop: 4, color: on ? c.primary : c.hint }]}>~{sp.weeks} weeks</Text>
              </View>
              <View style={[s.radio, on && s.radioSel]}>{on && <View style={s.radioDot} />}</View>
            </TouchableOpacity>
          )
        })}
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={[s.btnMain, !selected && s.btnDisabled]} onPress={() => selected && onNext(selected)} disabled={!selected}><Text style={s.btnMainText}>Next</Text></TouchableOpacity>
    </View>
  )
}

// ── Prediction ───────────────────────────────────────────────────────────────

function PredictionScreen({ goal, onNext }: { goal: UserGoal; onNext: () => void }) {
  const prediction = getPredictionText(goal)
  const date = getPredictionDate(goal.timeline_weeks)
  return (
    <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <StatusBar style="light" />
      <View style={s.predictionIcon}>
        <Text style={{ fontSize: 36 }}>🎯</Text>
      </View>
      <Text style={[s.heading, { textAlign: 'center', marginBottom: 12 }]}>Your plan{'\n'}is ready.</Text>
      <View style={s.predictionCard}>
        <Text style={s.predictionDate}>{date}</Text>
        <Text style={s.predictionText}>{prediction}</Text>
      </View>
      <Text style={s.predictionDisclaimer}>Based on your goal and pace. Results depend on consistency.</Text>
      <TouchableOpacity style={[s.btnMain, { width: '100%', marginTop: 32 }]} onPress={onNext}><Text style={s.btnMainText}>Let's go</Text></TouchableOpacity>
    </View>
  )
}

// ── Done ─────────────────────────────────────────────────────────────────────

function Done({ onScan }: { onScan: () => void }) {
  return (
    <View style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <StatusBar style="light" />
      <View style={s.doneIcon}><Text style={{ fontSize: 32 }}>✓</Text></View>
      <Text style={[s.title, { textAlign: 'center' }]}>You're all set.</Text>
      <Text style={[s.subtitle, { textAlign: 'center' }]}>Take your first scan to{'\n'}set your baseline.</Text>
      <TouchableOpacity style={s.btnMain} onPress={onScan}><Text style={s.btnMainText}>Take my first scan</Text></TouchableOpacity>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const nav = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 10 },
  pill: { flex: 1, flexDirection: 'row', backgroundColor: c.cardHover, borderRadius: 28, paddingVertical: 10, paddingHorizontal: 16, justifyContent: 'space-around', alignItems: 'center', borderWidth: 0.5, borderColor: c.cardBorder },
  item: { alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2 },
  label: { fontSize: 10, fontWeight: '600', color: c.hint },
  labelActive: { color: c.primary },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fabDisabled: { backgroundColor: c.muted },
  fabH: { width: 18, height: 2.5, backgroundColor: 'white', borderRadius: 2, position: 'absolute' },
  fabV: { width: 2.5, height: 18, backgroundColor: 'white', borderRadius: 2, position: 'absolute' },
})

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg, padding: 28, paddingTop: 60 },
  backBtn: { marginBottom: 12, alignSelf: 'flex-start', padding: 4 },
  backText: { fontSize: 20, color: c.muted, fontWeight: '600' },
  progressBar: { height: 4, backgroundColor: c.card, borderRadius: 2, marginBottom: 28 },
  progressFill: { height: 4, backgroundColor: c.primary, borderRadius: 2 },
  heading: { fontSize: 30, fontWeight: '800', color: c.text, letterSpacing: -1, lineHeight: 36, marginBottom: 6 },
  para: { fontSize: 14, color: c.muted, marginBottom: 4, lineHeight: 20 },
  noteText: { fontSize: 12, color: c.hint, marginBottom: 4, fontStyle: 'italic' },
  list: { gap: 10 },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardSel: { borderColor: c.primary, backgroundColor: c.primaryTint },
  cardTitle: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 2 },
  cardTitleSel: { color: c.primary },
  cardSub: { fontSize: 12, color: c.muted },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSel: { backgroundColor: c.primary, borderColor: c.primary },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '800' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  radioSel: { borderColor: c.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  dotsWrap: { width: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.muted },
  predictionIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 2, borderColor: c.primaryBorder },
  predictionCard: { backgroundColor: c.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.primaryBorder, width: '100%', alignItems: 'center' },
  predictionDate: { fontSize: 22, fontWeight: '800', color: c.cyan, marginBottom: 8, textAlign: 'center' },
  predictionText: { fontSize: 15, color: c.sub, textAlign: 'center', lineHeight: 22 },
  predictionDisclaimer: { fontSize: 11, color: c.hint, textAlign: 'center', marginTop: 12 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24, alignSelf: 'center' },
  logoLetter: { fontSize: 36, fontWeight: '800', color: 'white' },
  title: { fontSize: 38, fontWeight: '800', color: c.text, letterSpacing: -1.5, marginBottom: 10, alignSelf: 'center' },
  subtitle: { fontSize: 16, color: c.muted, lineHeight: 24, marginBottom: 48, alignSelf: 'center' },
  btnMain: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  btnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  btnMainText: { color: 'white', fontSize: 16, fontWeight: '800' },
  doneIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: c.primaryTint, borderWidth: 2, borderColor: c.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
})