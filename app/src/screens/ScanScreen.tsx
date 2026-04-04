import { StyleSheet, Text, View, TouchableOpacity, Animated, Easing } from 'react-native'
import { useRef, useState, useEffect } from 'react'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { submitScan } from '../api/scans'

type ScanState = 'ready' | 'positioning' | 'analyzing' | 'result'

export default function ScanScreen({ onBack, onResult }: { onBack: () => void, onResult?: (data: any) => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('front')
  const [scanState, setScanState] = useState<ScanState>('ready')
  const [bodyDetected, setBodyDetected] = useState(false)
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
    if (scanState === 'positioning') {
      // 4 seconds to get into position
      detectionTimer.current = setTimeout(() => {
        setBodyDetected(true)
        // 3 more seconds holding still before capture
        setTimeout(() => captureAndAnalyze(), 3000)
      }, 4000)
    }
    return () => { if (detectionTimer.current) clearTimeout(detectionTimer.current) }
  }, [scanState])

  const runSteps = () => {
    [400, 1200, 2400, 3800].forEach((d, i) => {
      setTimeout(() => setSteps(prev => { const n = [...prev]; n[i] = true; return n }), d)
    })
  }

  const captureAndAnalyze = async () => {
    if (!camera.current) return
    setScanState('analyzing')
    runSteps()

    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85 })
      if (!photo?.uri) throw new Error('No photo taken')

      Animated.timing(progressAnim, {
        toValue: 0.85, duration: 3500,
        easing: Easing.out(Easing.quad), useNativeDriver: false,
      }).start()

      const data = await submitScan(photo.uri)

      Animated.timing(progressAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start()

      setTimeout(() => { setResult(data); setScanState('result') }, 600)

    } catch (e: any) {
      setScanState('ready')
      setBodyDetected(false)
      setSteps([false, false, false, false])
      progressAnim.setValue(0)
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

  // RESULT STATE
  if (scanState === 'result' && result) {
    const m = result.measurements
    const scoreData = result.score
    const score = scoreData?.score || 50
    const scoreColor = score >= 80 ? '#16A34A' : score >= 60 ? '#CA8A04' : score >= 40 ? '#EA580C' : '#DC2626'
    const scoreTint = score >= 80 ? '#0d2e1a' : score >= 60 ? '#1a1500' : score >= 40 ? '#1a0e00' : '#1a0000'

    return (
      <View style={s.container}>
        <StatusBar style="light" />
        <View style={s.resultWrap}>
          <Text style={s.morpheTopLabel}>MORPHE BODY SCAN</Text>

          <View style={[s.scoreRing, { borderColor: scoreColor, backgroundColor: scoreTint }]}>
            <Text style={s.scoreNum}>{score}</Text>
            <Text style={[s.scoreLbl, { color: scoreColor }]}>SCORE</Text>
          </View>

          <Text style={s.resultTitle}>{scoreData?.label || 'Scan complete!'}</Text>
          <Text style={s.resultSub}>
            Week {result.weekNumber} · {scoreData?.pts_change > 0 ? '+' : ''}{scoreData?.pts_change || 0} pts
          </Text>

          <View style={s.measureCard}>
            <Text style={s.cardLabel}>MEASUREMENTS</Text>
            {[
              { label: 'Shoulders', val: m.shoulder_ratio, color: '#22d3ee', pct: Math.min(m.shoulder_ratio * 100, 100) },
              { label: 'Hips',      val: m.hip_ratio,      color: '#22d3ee', pct: Math.min(m.hip_ratio * 100, 100) },
              { label: 'Waist',     val: m.waist_ratio,    color: '#f87171', pct: Math.min(m.waist_ratio * 100, 100) },
            ].map(item => (
              <View key={item.label} style={s.measureRow}>
                <Text style={s.measureLabel}>{item.label}</Text>
                <View style={s.miniBarTrack}>
                  <View style={[s.miniBarFill, { width: `${item.pct}%` as any, backgroundColor: item.color }]} />
                </View>
                <Text style={[s.measureVal, { color: item.color }]}>{item.val.toFixed(3)}</Text>
              </View>
            ))}
          </View>

          {scoreData?.deltas && Object.keys(scoreData.deltas).length > 0 && (
            <View style={s.deltaCard}>
              <Text style={s.cardLabel}>VS LAST WEEK</Text>
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
              <Text style={s.resultBtnMainText}>See full results →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.resultBtnSec} onPress={onBack}>
              <Text style={s.resultBtnSecText}>Back to home</Text>
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
            <View style={s.cameraCircle}>
              <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} />
              <Animated.View style={[s.scanLine, { top: scanTop }]} />
              <View style={[s.gridLine, { top: '33%' }]} />
              <View style={[s.gridLine, { top: '66%' }]} />
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
            <Text style={s.holdStill}>Analyzing your body arc...</Text>
          </View>
        </View>
      </View>
    )
  }

  // READY + POSITIONING STATE
  const detected = bodyDetected && scanState === 'positioning'
  const cornerColor = detected ? '#22d3ee' : scanState === 'positioning' ? '#f97316' : '#ffffff88'

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
          {scanState === 'ready' ? 'Week scan' : detected ? 'Body detected!' : 'Get into position'}
        </Text>
        {scanState === 'ready' ? (
          <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.flipBtn}>
            <Text style={s.flipText}>⟳ Flip</Text>
          </TouchableOpacity>
        ) : <View style={s.flipBtn} />}
      </View>

      <View style={[s.corner, s.tl, { borderColor: cornerColor }]} />
      <View style={[s.corner, s.tr, { borderColor: cornerColor }]} />
      <View style={[s.corner, s.bl, { borderColor: cornerColor }]} />
      <View style={[s.corner, s.br, { borderColor: cornerColor }]} />

      {scanState === 'positioning' && (
        <Animated.View style={[s.fullScanLine, { top: scanTop, borderColor: cornerColor }]} />
      )}

      <View style={s.guideWrap}>
        {scanState === 'ready' && (
          <Text style={s.guideText}>Stand 6ft away · full body in frame</Text>
        )}
        {scanState === 'positioning' && !detected && (
          <View style={s.detectionPill}>
            <View style={s.detectionDot} />
            <Text style={s.detectionText}>Looking for body...</Text>
          </View>
        )}
        {detected && (
          <View style={[s.detectionPill, { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: '#22d3ee55' }]}>
            <View style={[s.detectionDot, { backgroundColor: '#22d3ee' }]} />
            <Text style={[s.detectionText, { color: '#22d3ee' }]}>
              Body detected — stay still, capturing soon...
            </Text>
          </View>
        )}
      </View>

      <View style={s.bottomBar}>
        {scanState === 'ready' && (
          <>
            <Text style={s.instructText}>
              Position yourself so your full body is visible from head to toe
            </Text>
            <TouchableOpacity
              style={s.startBtn}
              onPress={() => { setScanState('positioning'); setBodyDetected(false) }}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={s.startBtnText}>Start scan</Text>
              </Animated.View>
            </TouchableOpacity>
          </>
        )}
        {scanState === 'positioning' && (
          <Text style={s.instructText}>
            {detected
              ? 'Perfect — hold completely still...'
              : 'Step back · full body in frame · hold still'}
          </Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111e' },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 140,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBar: {
    position: 'absolute', top: 56, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 24,
  },
  backBtn: { width: 60 },
  backText: { color: 'white', fontSize: 14, fontWeight: '600' },
  topTitle: { fontSize: 14, fontWeight: '700', color: 'white' },
  flipBtn: { width: 60, alignItems: 'flex-end' },
  flipText: { color: 'white', fontSize: 14, fontWeight: '600' },
  corner: { position: 'absolute', width: 32, height: 32 },
  tl: { top: 150, left: 24, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderRadius: 3 },
  tr: { top: 150, right: 24, borderTopWidth: 2.5, borderRightWidth: 2.5, borderRadius: 3 },
  bl: { bottom: 190, left: 24, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderRadius: 3 },
  br: { bottom: 190, right: 24, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderRadius: 3 },
  fullScanLine: {
    position: 'absolute', left: 24, right: 24, height: 1.5,
    backgroundColor: 'transparent',
    borderTopWidth: 1.5, borderStyle: 'solid',
    shadowColor: '#22d3ee', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 8,
  },
  guideWrap: {
    position: 'absolute', top: 116, left: 0, right: 0, alignItems: 'center',
  },
  guideText: {
    color: 'white', fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 5, paddingHorizontal: 14,
    borderRadius: 16, overflow: 'hidden',
  },
  detectionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1, borderColor: '#f9731655',
    borderRadius: 16, paddingVertical: 5, paddingHorizontal: 14,
  },
  detectionDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#f97316' },
  detectionText: { fontSize: 12, fontWeight: '700', color: '#f97316' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 48, alignItems: 'center', gap: 14,
  },
  instructText: {
    color: 'rgba(255,255,255,0.7)', fontSize: 13,
    textAlign: 'center', lineHeight: 20,
  },
  startBtn: {
    backgroundColor: '#1746A2', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 48,
    alignItems: 'center', width: '100%',
  },
  startBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  analyzeWrap: {
    flex: 1, alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 24,
  },
  morpheTopLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    color: '#22d3ee', marginBottom: 24,
  },
  circleWrap: {
    width: 220, height: 220,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  spinRing: {
    position: 'absolute', width: 220, height: 220,
    borderRadius: 110, borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: '#22d3ee',
    borderRightColor: '#a78bfa',
  },
  staticRing: {
    position: 'absolute', width: 200, height: 200,
    borderRadius: 100, borderWidth: 1, borderColor: '#0d1f35',
  },
  cameraCircle: {
    width: 184, height: 184, borderRadius: 92,
    overflow: 'hidden', borderWidth: 1.5, borderColor: '#0d1f35',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 1.5,
    backgroundColor: '#22d3ee',
    shadowColor: '#22d3ee', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6,
  },
  gridLine: {
    position: 'absolute', left: 0, right: 0, height: 0.5,
    backgroundColor: '#22d3ee18',
  },
  stepsWrap: { width: '100%', gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#0d1f35', borderWidth: 1.5, borderColor: '#1e3a5f',
  },
  stepDotDone: { backgroundColor: '#22d3ee', borderColor: '#22d3ee' },
  stepDotActive: { borderColor: '#22d3ee' },
  stepLabel2: { flex: 1, fontSize: 13, fontWeight: '600' },
  stepLabelDone: { color: '#22d3ee' },
  stepLabelActive: { color: 'white' },
  stepLabelPending: { color: '#4b7ab5' },
  stepCheck: { fontSize: 11, color: '#07111e', fontWeight: '800' },
  progressTrack: {
    height: 3, backgroundColor: '#0d1f35', borderRadius: 2,
    overflow: 'hidden', marginTop: 8,
  },
  progressFill: { height: 3, backgroundColor: '#22d3ee', borderRadius: 2 },
  holdStill: { fontSize: 11, color: '#4b7ab5', textAlign: 'center', marginTop: 6 },
  resultWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  scoreRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  scoreNum: { fontSize: 28, fontWeight: '800', color: 'white', lineHeight: 30 },
  scoreLbl: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  resultTitle: { fontSize: 22, fontWeight: '800', color: 'white', marginBottom: 4 },
  resultSub: { fontSize: 12, color: '#4b7ab5', marginBottom: 20 },
  measureCard: {
    width: '100%', backgroundColor: '#0d1f35',
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  deltaCard: {
    width: '100%', backgroundColor: '#0a1628',
    borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 0.5, borderColor: '#1e3a5f',
  },
  cardLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#4b7ab5', marginBottom: 10 },
  measureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  measureLabel: { fontSize: 12, color: '#6a8ab5', width: 72 },
  miniBarTrack: { flex: 1, height: 3, backgroundColor: '#1e3a5f', borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: 3, borderRadius: 2 },
  measureVal: { fontSize: 12, fontWeight: '700', width: 44, textAlign: 'right' },
  deltaRow: { flexDirection: 'row', justifyContent: 'space-around' },
  deltaItem: { alignItems: 'center', gap: 4 },
  deltaVal: { fontSize: 16, fontWeight: '800' },
  deltaLabel: { fontSize: 10, color: '#4b7ab5' },
  resultBtns: { width: '100%', gap: 10 },
  resultBtnMain: {
    backgroundColor: '#1746A2', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  resultBtnMainText: { color: 'white', fontSize: 14, fontWeight: '800' },
  resultBtnSec: {
    backgroundColor: '#0d1f35', borderRadius: 12, padding: 14, alignItems: 'center',
  },
  resultBtnSecText: { color: '#4b7ab5', fontSize: 14, fontWeight: '600' },
  permText: { color: 'white', fontSize: 16, marginBottom: 20, textAlign: 'center' },
  permBtn: { backgroundColor: '#1746A2', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  permBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
})