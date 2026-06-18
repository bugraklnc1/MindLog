import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const handleToggleMode = () => {
    setIsLogin((prev) => !prev);
    clearMessages();
    setEmail('');
    setPassword('');
  };

  const validateInputs = () => {
    if (!email.trim()) {
      setError('Lütfen e-posta adresinizi girin.');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Geçerli bir e-posta adresi girin.');
      return false;
    }
    if (!password) {
      setError('Lütfen şifrenizi girin.');
      return false;
    }
    if (!isLogin && password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    clearMessages();
    if (!validateInputs()) return;

    setLoading(true);
    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        // onAuthStateChange in App.js will automatically redirect to main app
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        setSuccessMessage(
          'Hesabınız oluşturuldu! Lütfen e-posta adresinizi doğrulayın, ardından giriş yapabilirsiniz.'
        );
        setIsLogin(true);
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      const friendlyMessages = {
        'Invalid login credentials': 'E-posta veya şifre hatalı.',
        'Email not confirmed': 'Lütfen önce e-posta adresinizi doğrulayın.',
        'User already registered': 'Bu e-posta adresi zaten kayıtlı.',
        'Password should be at least 6 characters': 'Şifre en az 6 karakter olmalıdır.',
      };
      setError(friendlyMessages[err.message] || err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f7" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.appName}>MindLog</Text>
          <Text style={styles.appTagline}>Verimliliğini takip et, zihnini tanı.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {/* Mode Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
              onPress={() => { if (!isLogin) handleToggleMode(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
                Giriş Yap
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
              onPress={() => { if (isLogin) handleToggleMode(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
                Kayıt Ol
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.formTitle}>
            {isLogin ? 'Tekrar hoş geldin 👋' : 'Hesap oluştur 🚀'}
          </Text>
          <Text style={styles.formSubtitle}>
            {isLogin
              ? 'Devam etmek için giriş yap'
              : 'Ücretsiz hesabını oluştur'}
          </Text>

          {/* Error / Success Messages */}
          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {successMessage !== '' && (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-posta</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>✉️</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@email.com"
                placeholderTextColor="#4a4a6a"
                value={email}
                onChangeText={(t) => { setEmail(t); clearMessages(); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Şifre</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder={isLogin ? 'Şifreni gir' : 'En az 6 karakter'}
                placeholderTextColor="#4a4a6a"
                value={password}
                onChangeText={(t) => { setPassword(t); clearMessages(); }}
                secureTextEntry
                editable={!loading}
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Footer Toggle */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {isLogin ? 'Henüz hesabın yok mu?' : 'Zaten hesabın var mı?'}
            </Text>
            <TouchableOpacity onPress={handleToggleMode} disabled={loading}>
              <Text style={styles.footerLink}>
                {isLogin ? ' Kayıt Ol' : ' Giriş Yap'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.bottomNote}>
          Verilerini güvenle saklıyoruz 🔐
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  // ─── Header ───────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#eef0ff',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  logoIcon: {
    fontSize: 34,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e1b4b',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 13,
    color: '#6b7280',
    letterSpacing: 0.2,
  },

  // ─── Card ─────────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },

  // ─── Toggle ───────────────────────────────────────────────────
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  toggleTextActive: {
    color: '#ffffff',
  },

  // ─── Form Title ───────────────────────────────────────────────
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 24,
  },

  // ─── Messages ─────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  errorIcon: { fontSize: 16 },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
    lineHeight: 18,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  successIcon: { fontSize: 16 },
  successText: {
    flex: 1,
    fontSize: 13,
    color: '#16a34a',
    lineHeight: 18,
  },

  // ─── Inputs ───────────────────────────────────────────────────
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },

  // ─── Submit Button ────────────────────────────────────────────
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // ─── Footer ───────────────────────────────────────────────────
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#6b7280',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
  },
  bottomNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 28,
  },
});
