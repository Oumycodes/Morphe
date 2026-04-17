import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing, Alert, ScrollView } from 'react-native'
import { useRef, useState, useEffect } from 'react'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { submitScan } from '../api/scans'

type ScanState = 'setup' | 'ready' | 'front_positioning' | 'front_detected' | 'side_intro' | 'side_positioning' | 'side_detected' | 'analyzing' | 'result'

export default function ScanScreen({ onBack, onResult }: { onBack: () => void, onResult?: (data: any) => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('front')
  const [scanState, setScanState] = useState<ScanState>('setup')
  const frontUriRef = useRef<string | null>(null)
  const [frontUri, setFrontUri] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [steps, setSteps] = useState([false, false, false, false])
  const camera = useRef<CameraView>(null)
  const scanLineAnim = useRef(new Animated.Value(0)).current
  const spinAnim = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const detectionTimer = useRef<any>(null)

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start()
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start()
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start()
    return () => { if (detectionTimer.current) clearTimeout(detectionTimer.current) }
  }, [])

  useEffect(() => {
    if (scanState === 'front_positioning') {
      detectionTimer.current = setTimeout(() => {
        setScanState('front_detected')
        setTimeout(() => captureFront(), 3000)
      }, 4000)
    }
    if (scanState === 'side_positioning') {
      detectionTimer.current = setTimeout(() => {
        setScanState('side_detected')
        setTimeout(() => captureSideAndAnalyze(), 4000)
      }, 4000)
    }
    return () => { if (detectionTimer.current) clearTimeout(detectionTimer.current) }
  }, [scanState])

  const captureFront = async () => {
    if (!camera.current) return
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85 })
      if (!photo?.uri) throw new Error('No photo')
      frontUriRef.current = photo.uri
      setFrontUri(photo.uri)
      setScanState('side_intro')
    } catch (e: any) {
      console.log('Front capture error:', e?.message)
      setScanState('ready')
    }
  }

  const runSteps = () => {
    [400, 1200, 2400, 3800].forEach((d, i) => {
      setTimeout(() => setSteps(prev => { const n = [...prev]; n[i] = true; return n }), d)
    })
  }

  const captureSideAndAnalyze = async () => {
    if (!camera.current || !frontUriRef.current) return
    try {
      const sidePhoto = await camera.current.takePictureAsync({ quality: 0.85 })
      if (!sidePhoto?.uri) throw new Error('Image could not be captured')
      setScanState('analyzing')
      runSteps()
      Animated.timing(progressAnim, {
        toValue: 0.85, duration: 3500,
        easing: Easing.out(Easing.quad), useNativeDriver: false,
      }).start()
      const data = await submitScan(frontUriRef.current!, sidePhoto.uri)
      Animated.timing(progressAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start()
      setTimeout(() => { setResult(data); setScanState('result') }, 600)
    } catch (e: any) {
      console.log('SIDE ERROR:', e?.message)
      Alert.alert('Scan failed', e?.message || 'Could not capture image. Try again.', [
        {
          text: 'Try again', onPress: () => {
            setScanState('ready')
            frontUriRef.current = null
            setFrontUri(null)
            setSteps([false, false, false, false])
            progressAnim.setValue(0)
          }
        }
      ])
    }
  }

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const scanTop = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: ['5%', '92%'] })
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
  const STEP_LABELS = ['Pose detected', 'Body segmented', 'Computing measurements', 'Calculating arc score']

  if (!permission) return <View style={s.container} />
  if (!permission.granted) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <StatusBar style="light" />
        <Text style={s.permText}>Camera permission needed</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // SETUP SCREEN
  if (scanState === 'setup') {
    return (
      <View style={s.container}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={s.introWrap} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 24 }}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.morpheTopLabel}>BEFORE YOU SCAN</Text>
          <Text style={s.introTitle}>Set up your{'\n'}scan space</Text>
          <Text style={s.introSub}>
            For accurate tracking, use the same setup every scan. Takes 30 seconds to set up once.
          </Text>
          <View style={s.setupSteps}>
            {[
              { icon: '📏', title: '6 feet away', sub: 'Place your phone 6ft (2m) from where you stand' },
              { icon: '📱', title: 'Hip height', sub: 'Prop your phone at hip height — not held, not on the floor' },
              { icon: '🧱', title: 'Plain wall behind you', sub: 'Light colored wall, no furniture in the background' },
              { icon: '📍', title: 'Mark your spot', sub: 'Put tape on the floor where you stand and where the phone goes — use it every time' },
              { icon: '💪', title: 'Arms away from body', sub: 'Not touching your sides — this affects waist measurement' },
              { icon: '👗', title: 'Form-fitting clothes', sub: 'Tight clothing gives the most accurate body outline' },
            ].map((step, i) => (
              <View key={i} style={s.setupStep}>
                <Text style={s.setupIcon}>{step.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.setupTitle}>{step.title}</Text>
                  <Text style={s.setupSub}>{step.sub}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.startBtn} onPress={() => setScanState('ready')}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={s.startBtnText}>I'm set up — start scan</Text>
            </Animated.View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // RESULT STATE
  if (scanState === 'result' && result) {
    const m = result.measurements
    const scoreData = result.score
    const score = scoreData?.score ?? null
    const hasScore = score !== null
    const scoreColor = !hasScore ? '#A8A8B2' : score >= 80 ? '#16A34A' : score >= 60 ? '#CA8A04' : score >= 40 ? '#EA580C' : '#DC2626'
    const scoreTint = !hasScore ? '#F2F1ED' : score >= 80 ? '#0d2e1a' : score >= 60 ? '#1a1500' : score >= 40 ? '#1a0e00' : '#1a0000'
    return (
      <View style={s.container}>
        <StatusBar style="light" />
        <View style={s.resultWrap}>
          <Text style={s.morpheTopLabel}>MORPHE BODY SCAN</Text>
          <View style={[s.scoreRing, { borderColor: scoreColor, backgroundColor: scoreTint }]}>
            {hasScore ? (
              <>
                <Text style={s.scoreNum}>{score}</Text>
                <Text style={[s.scoreLbl, { color: scoreColor }]}>SCORE</Text>
              </>
            ) : (
              <Text style={[s.scoreNum, { fontSize: 14, color: '#A8A8B2' }]}>BASE</Text>
            )}
          </View>
          <Text style={s.resultTitle}>
            {hasScore ? (scoreData?.label || 'Scan complete!') : 'Baseline locked in'}
          </Text>
          <Text style={s.resultSub}>
            {hasScore
              ? `Cycle ${result.cycleNumber} · ${scoreData?.label || ''}`
              : 'Your baseline is set. Come back in 5 days for your first progress score.'}
          </Text>
          <View style={s.measureCard}>
            <Text style={s.cardLabel}>MEASUREMENTS</Text>
            {[
              { label: 'Shoulders', val: m.shoulder_ratio, color: '#22d3ee' },
              { label: 'Hips',      val: m.hip_ratio,      color: '#22d3ee' },
              { label: 'Glutes',    val: m.glute_projection_ratio, color: '#a78bfa' },
              { label: 'Waist',     val: m.waist_ratio,    color: '#f87171' },
            ].map(item => (
              <View key={item.label} style={s.measureRow}>
                <Text style={s.measureLabel}>{item.label}</Text>
                <View style={s.miniBarTrack}>
                  <View style={[s.miniBarFill, {
                    width: `${Math.min((item.val || 0) * 120, 100)}%` as any,
                    backgroundColor: item.color
                  }]} />
                </View>
                <Text style={[s.measureVal, { color: item.color }]}>
                  {item.val?.toFixed(3) || '—'}
                </Text>
              </View>
            ))}
          </View>
          {hasScore && scoreData?.deltas && Object.keys(scoreData.deltas).length > 0 && (
            <View style={s.deltaCard}>
              <Text style={s.cardLabel}>VS LAST SCAN</Text>
              <View style={s.deltaRow}>
                {Object.entries(scoreData.deltas).map(([key, val]: any) => (
                  <View key={key} style={s.deltaItem}>
                    <Text style={[s.deltaVal, { color: val >= 0 ? '#22d3ee' : '#f87171' }]}>
                      {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                    </Text>
                    <Text style={s.deltaLabel}>{key}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={s.resultBtns}>
            <TouchableOpacity style={s.resultBtnMain} onPress={() => { if (onResult) onResult(result); onBack() }}>
              <Text style={s.resultBtnMainText}>
                {hasScore ? 'See full results →' : 'Go to dashboard →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  // ANALYZING STATE
  if (scanState === 'analyzing') {
    return (
      <View style={s.container}>
        <StatusBar style="light" />
        <View style={s.analyzeWrap}>
          <Text style={s.morpheTopLabel}>MORPHE BODY SCAN</Text>
          <View style={s.circleWrap}>
            <Animated.View style={[s.spinRing, { transform: [{ rotate: spin }] }]} />
            <View style={s.staticRing} />
            <View style={s.cameraCircleDark}>
              <Text style={{ fontSize: 40 }}>🔬</Text>
            </View>
          </View>
          <View style={s.stepsWrap}>
            {STEP_LABELS.map((label, i) => (
              <View key={i} style={s.stepRow}>
                <View style={[
                  s.stepDot,
                  steps[i] && s.stepDotDone,
                  !steps[i] && i === steps.filter(Boolean).length && s.stepDotActive,
                ]} />
                <Text style={[
                  s.stepLabel2,
                  steps[i] ? s.stepLabelDone : i === steps.filter(Boolean).length ? s.stepLabelActive : s.stepLabelPending,
                ]}>
                  {label}
                </Text>
                {steps[i] && <Text style={s.stepCheck}>✓</Text>}
              </View>
            ))}
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: progressWidth }]} />
            </View>
            <Text style={s.holdStill}>Analyzing with U2Net + OpenCV...</Text>
          </View>
        </View>
      </View>
    )
  }

  // SIDE INTRO
  if (scanState === 'side_intro') {
    return (
      <View style={s.container}>
        <StatusBar style="light" />
        <View style={s.introWrap}>
          <View style={s.introDoneRow}>
            <View style={s.introDoneDot} />
            <Text style={s.introDoneText}>Front scan complete ✓</Text>
          </View>
          <Text style={s.introTitle}>Now turn{'\n'}sideways</Text>
          <Text style={s.introSub}>
            Turn 90° to your right. Cross your arms on your chest. Stand naturally — don't arch your back.
          </Text>
          <View style={s.introBodyWrap}>
            <View style={s.introBodyCol}>
              <Text style={s.introBodyLabel}>FRONT ✓</Text>
              <View style={s.silhouetteFront} />
            </View>
            <Text style={s.introArrowText}>→</Text>
            <View style={s.introBodyCol}>
              <Text style={[s.introBodyLabel, { color: '#22d3ee' }]}>SIDE</Text>
              <View style={s.silhouetteSide} />
            </View>
          </View>
          <TouchableOpacity style={s.startBtn} onPress={() => setScanState('side_positioning')}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={s.startBtnText}>I'm ready →</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // READY + POSITIONING
  const isSide = scanState === 'side_positioning' || scanState === 'side_detected'
  const detected = scanState === 'front_detected' || scanState === 'side_detected'
  const isPositioning = scanState === 'front_positioning' || scanState === 'side_positioning'
  const cornerColor = detected ? '#22d3ee' : isPositioning ? '#f97316' : '#ffffff88'

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} />
      <View style={s.topOverlay} />
      <View style={s.bottomOverlay} />
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>
          {scanState === 'ready' ? 'Week scan'
            : detected ? (isSide ? 'Side detected!' : 'Body detected!')
            : isPositioning ? (isSide ? 'Side scan' : 'Front scan')
            : 'Week scan'}
        </Text>
        {scanState === 'ready' ? (
          <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.flipBtn}>
            <Text style={s.flipText}>⟳ Flip</Text>
          </TouchableOpacity>
        ) : <View style={s.flipBtn} />}
      </View>
      <View style={s.scanProgress}>
        <View style={[s.scanPill, { backgroundColor: frontUri ? '#22d3ee' : isPositioning && !isSide ? '#f97316' : '#1e3a5f' }]}>
          <Text style={s.scanPillText}>{frontUri ? '✓ Front' : '1 Front'}</Text>
        </View>
        <View style={s.scanPillLine} />
        <View style={[s.scanPill, { backgroundColor: isSide && detected ? '#22d3ee' : isSide ? '#f97316' : '#1e3a5f' }]}>
          <Text style={s.scanPillText}>2 Side</Text>
        </View>
      </View>
      <View style={[s.corner, s.tl, { borderColor: cornerColor }]} />
      <View style={[s.corner, s.tr, { borderColor: cornerColor }]} />
      <View style={[s.corner, s.bl, { borderColor: cornerColor }]} />
      <View style={[s.corner, s.br, { borderColor: cornerColor }]} />
      {isPositioning && (
        <Animated.View style={[s.fullScanLine, { top: scanTop, borderColor: cornerColor }]} />
      )}
      <View style={s.guideWrap}>
        {scanState === 'ready' && (
          <Text style={s.guideText}>Stand on your tape mark · full body in frame</Text>
        )}
        {isPositioning && !detected && (
          <View style={s.detectionPill}>
            <View style={s.detectionDot} />
            <Text style={s.detectionText}>
              {isSide ? 'Looking for side profile...' : 'Looking for body...'}
            </Text>
          </View>
        )}
        {detected && (
          <View style={[s.detectionPill, { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: '#22d3ee55' }]}>
            <View style={[s.detectionDot, { backgroundColor: '#22d3ee' }]} />
            <Text style={[s.detectionText, { color: '#22d3ee' }]}>
              {isSide ? 'Side detected — stay still...' : 'Body detected — stay still...'}
            </Text>
          </View>
        )}
      </View>
      <View style={s.bottomBar}>
        {scanState === 'ready' && (
          <>
            <Text style={s.instructText}>
              Full body visible · arms away from sides · 6ft from phone
            </Text>
            <TouchableOpacity style={s.startBtn} onPress={() => setScanState('front_positioning')}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={s.startBtnText}>Start scan</Text>
              </Animated.View>
            </TouchableOpacity>
          </>
        )}
        {isPositioning && (
          <Text style={s.instructText}>
            {detected
              ? 'Perfect — hold completely still...'
              : isSide
              ? 'Turn 90° · arms crossed on chest · hold still'
              : 'Full body in frame · arms away from sides'}
          </Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111e' },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.5)' },
  topBar: {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24,
  },
  backBtn: { width: 60 },
  backText: { color: 'white', fontSize: 14, fontWeight: '600' },
  topTitle: { fontSize: 14, fontWeight: '700', color: 'white' },
  flipBtn: { width: 60, alignItems: 'flex-end' },
  flipText: { color: 'white', fontSize: 14, fontWeight: '600' },
  scanProgress: {
    position: 'absolute', top: 96, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  scanPill: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 12 },
  scanPillText: { fontSize: 11, fontWeight: '700', color: 'white' },
  scanPillLine: { width: 20, height: 1.5, backgroundColor: '#1e3a5f' },
  corner: { position: 'absolute', width: 32, height: 32 },
  tl: { top: 165, left: 24, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderRadius: 3 },
  tr: { top: 165, right: 24, borderTopWidth: 2.5, borderRightWidth: 2.5, borderRadius: 3 },
  bl: { bottom: 190, left: 24, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderRadius: 3 },
  br: { bottom: 190, right: 24, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderRadius: 3 },
  fullScanLine: {
    position: 'absolute', left: 24, right: 24, height: 1.5,
    backgroundColor: 'transparent', borderTopWidth: 1.5, borderStyle: 'solid',
    shadowColor: '#22d3ee', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8,
  },
  guideWrap: { position: 'absolute', top: 130, left: 0, right: 0, alignItems: 'center' },
  guideText: {
    color: 'white', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 5, paddingHorizontal: 14, borderRadius: 16, overflow: 'hidden',
  },
  detectionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1,
    borderColor: '#f9731655', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 14,
  },
  detectionDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#f97316' },
  detectionText: { fontSize: 12, fontWeight: '700', color: '#f97316' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 48, alignItems: 'center', gap: 14,
  },
  instructText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  startBtn: {
    backgroundColor: '#1746A2', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 48,
    alignItems: 'center', width: '100%',
  },
  startBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  introWrap: { padding: 32, paddingTop: 64, paddingBottom: 48 },
  introDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  introDoneDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22d3ee' },
  introDoneText: { fontSize: 13, color: '#22d3ee', fontWeight: '600' },
  introTitle: { fontSize: 38, fontWeight: '800', color: 'white', letterSpacing: -1.5, lineHeight: 44, marginBottom: 16 },
  introSub: { fontSize: 14, color: '#4b7ab5', lineHeight: 22, marginBottom: 24 },
  introBodyWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 40 },
  introBodyCol: { alignItems: 'center', gap: 8 },
  introBodyLabel: { fontSize: 10, fontWeight: '700', letterSpacing: .8, color: '#4b7ab5' },
  introArrowText: { fontSize: 24, color: '#1e3a5f', paddingBottom: 20 },
  silhouetteFront: { width: 40, height: 90, borderRadius: 8, backgroundColor: '#1e3a5f', borderWidth: 1.5, borderColor: '#2d5a8a' },
  silhouetteSide: { width: 24, height: 90, borderRadius: 6, backgroundColor: '#0d1f35', borderWidth: 1.5, borderColor: '#22d3ee' },
  setupSteps: { gap: 10, marginBottom: 28 },
  setupStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#0d1f35', borderRadius: 12, padding: 12,
  },
  setupIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  setupTitle: { fontSize: 13, fontWeight: '700', color: 'white', marginBottom: 2 },
  setupSub: { fontSize: 11, color: '#4b7ab5', lineHeight: 16 },
  morpheTopLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#22d3ee', marginBottom: 16 },
  analyzeWrap: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  circleWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  spinRing: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 4,
    borderColor: 'transparent', borderTopColor: '#22d3ee', borderRightColor: '#a78bfa',
  },
  staticRing: { position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: '#0d1f35' },
  cameraCircleDark: {
    width: 184, height: 184, borderRadius: 92,
    backgroundColor: '#0d1f35', borderWidth: 1.5, borderColor: '#0d1f35',
    alignItems: 'center', justifyContent: 'center',
  },
  stepsWrap: { width: '100%', gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#0d1f35', borderWidth: 1.5, borderColor: '#1e3a5f' },
  stepDotDone: { backgroundColor: '#22d3ee', borderColor: '#22d3ee' },
  stepDotActive: { borderColor: '#22d3ee' },
  stepLabel2: { flex: 1, fontSize: 13, fontWeight: '600' },
  stepLabelDone: { color: '#22d3ee' },
  stepLabelActive: { color: 'white' },
  stepLabelPending: { color: '#4b7ab5' },
  stepCheck: { fontSize: 11, color: '#07111e', fontWeight: '800' },
  progressTrack: { height: 3, backgroundColor: '#0d1f35', borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  progressFill: { height: 3, backgroundColor: '#22d3ee', borderRadius: 2 },
  holdStill: { fontSize: 11, color: '#4b7ab5', textAlign: 'center', marginTop: 6 },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  scoreRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  scoreNum: { fontSize: 28, fontWeight: '800', color: 'white', lineHeight: 30 },
  scoreLbl: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  resultTitle: { fontSize: 22, fontWeight: '800', color: 'white', marginBottom: 4 },
  resultSub: { fontSize: 12, color: '#4b7ab5', marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  measureCard: { width: '100%', backgroundColor: '#0d1f35', borderRadius: 14, padding: 14, marginBottom: 10 },
  deltaCard: { width: '100%', backgroundColor: '#0a1628', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: '#1e3a5f' },
  cardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#4b7ab5', marginBottom: 10 },
  measureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  measureLabel: { fontSize: 12, color: '#6a8ab5', width: 72 },
  miniBarTrack: { flex: 1, height: 3, backgroundColor: '#1e3a5f', borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: 3, borderRadius: 2 },
  measureVal: { fontSize: 12, fontWeight: '700', width: 44, textAlign: 'right' },
  deltaRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8 },
  deltaItem: { alignItems: 'center', gap: 4 },
  deltaVal: { fontSize: 16, fontWeight: '800' },
  deltaLabel: { fontSize: 10, color: '#4b7ab5' },
  resultBtns: { width: '100%', gap: 10 },
  resultBtnMain: { backgroundColor: '#1746A2', borderRadius: 12, padding: 14, alignItems: 'center' },
  resultBtnMainText: { color: 'white', fontSize: 14, fontWeight: '800' },
  permText: { color: 'white', fontSize: 16, marginBottom: 20, textAlign: 'center' },
  permBtn: { backgroundColor: '#1746A2', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  permBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
})