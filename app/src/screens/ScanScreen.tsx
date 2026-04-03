import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native'
import { useRef, useState } from 'react'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'

const colors = {
  primary: '#1746A2',
  primaryTint: '#EFF6FF',
  background: '#FAFAF8',
  ink: '#0E0E10',
  muted: '#6A6A72',
}

export default function ScanScreen({ onBack }: { onBack: () => void }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(false)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<CameraType>('back')
  const camera = useRef<CameraView>(null)

  if (!permission) {
    return <View style={styles.center} />
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera permission needed</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const lockScan = async () => {
    if (!camera.current || scanning) return
    setScanning(true)
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85 })
      Alert.alert(
        'Scan captured!',
        'Your baseline is set. Come back next week to see what changed.',
        [{ text: 'OK', onPress: () => setScanning(false) }]
      )
    } catch (e) {
      Alert.alert('Error', 'Could not take photo. Try again.')
      setScanning(false)
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setReady(true)}
      />

      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Week scan</Text>
        <TouchableOpacity
          style={styles.flipBtn}
          onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
        >
          <Text style={styles.flipText}>⟳ Flip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.guideBox}>
        <Text style={styles.guideText}>Stand 6ft away · Full body in frame</Text>
      </View>

      <View style={styles.checklist}>
        <CheckRow label="Full body visible" done={ready} />
        <CheckRow label="Good lighting" done={ready} />
        <CheckRow label="Hold still" done={false} />
      </View>

      <TouchableOpacity
        style={[styles.lockBtn, (!ready || scanning) && styles.lockBtnDisabled]}
        onPress={lockScan}
        disabled={!ready || scanning}
      >
        <Text style={styles.lockBtnText}>
          {scanning ? 'Scanning...' : 'Lock scan'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function CheckRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkDot, done && styles.checkDotDone]} />
      <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>
        {label}
      </Text>
      <Text style={[styles.checkStatus, done && styles.checkStatusDone]}>
        {done ? 'Good' : 'Waiting'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  msg: {
    fontSize: 16,
    color: colors.ink,
    marginBottom: 20,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  btnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  backBtn: { width: 60 },
  backText: { color: 'white', fontSize: 14, fontWeight: '600' },
  topTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
  flipBtn: { width: 60, alignItems: 'flex-end' },
  flipText: { color: 'white', fontSize: 14, fontWeight: '600' },
  guideBox: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  guideText: {
    color: 'white',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  checklist: {
    position: 'absolute',
    bottom: 160,
    left: 24,
    right: 24,
    gap: 10,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EA580C',
  },
  checkDotDone: { backgroundColor: '#16A34A' },
  checkLabel: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  checkLabelDone: { color: 'white' },
  checkStatus: { fontSize: 11, fontWeight: '700', color: '#EA580C' },
  checkStatusDone: { color: '#16A34A' },
  lockBtn: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  lockBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.2)' },
  lockBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#16A34A' },
  tl: { top: 180, left: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 180, right: 24, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 150, left: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 150, right: 24, borderBottomWidth: 2, borderRightWidth: 2 },
})