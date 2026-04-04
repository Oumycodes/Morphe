import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../lib/supabase'

const colors = {
  primary: '#1746A2',
  primaryTint: '#EFF6FF',
  background: '#FAFAF8',
  surface: '#FFFFFF',
  ink: '#0E0E10',
  muted: '#6A6A72',
  hint: '#A8A8B2',
  border: '#E8E7E3',
}

export default function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    if (mode === 'signup' && !name) {
      Alert.alert('Missing name', 'Please enter your name.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            name,
            goals: [],
            body_parts: [],
          })
        }
        Alert.alert('Check your email', 'We sent you a confirmation link.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuth()
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />

      <View style={s.top}>
        <View style={s.logoBox}>
          <Text style={s.logoLetter}>M</Text>
        </View>
        <Text style={s.title}>Morphe</Text>
        <Text style={s.sub}>Watch your body transform,{'\n'}one scan at a time.</Text>
      </View>

      <View style={s.card}>
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, mode === 'signup' && s.tabActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={[s.tabText, mode === 'signup' && s.tabTextActive]}>Sign up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, mode === 'login' && s.tabActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[s.tabText, mode === 'login' && s.tabTextActive]}>Log in</Text>
          </TouchableOpacity>
        </View>

        {mode === 'signup' && (
          <TextInput
            style={s.input}
            placeholder="Your name"
            placeholderTextColor={colors.hint}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={colors.hint}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={colors.hint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[s.btn, loading && s.btnLoading]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={s.btnText}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Log in'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={s.legal}>
        By continuing you agree to our Terms of Service and Privacy Policy
      </Text>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    padding: 28,
    paddingTop: 80,
    paddingBottom: 36,
  },
  top: { alignItems: 'center' },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoLetter: { fontSize: 32, fontWeight: '800', color: 'white' },
  title: { fontSize: 32, fontWeight: '800', color: colors.ink, letterSpacing: -1.5, marginBottom: 8 },
  sub: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 20,
  },
  tabs: { flexDirection: 'row', marginBottom: 20, backgroundColor: colors.background, borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.hint },
  tabTextActive: { color: colors.ink },
  input: {
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnLoading: { opacity: 0.7 },
  btnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  legal: { fontSize: 11, color: colors.hint, textAlign: 'center', lineHeight: 17 },
})