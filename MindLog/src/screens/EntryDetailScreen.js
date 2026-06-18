import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function EntryDetailScreen({ route, navigation }) {
  const { entry } = route.params;
  const [habitLogs, setHabitLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHabitLogs();
  }, []);

  // O günün habit loglarını çek
  const fetchHabitLogs = async () => {
    try {
      const entryDate = new Date(entry.created_at).toISOString().split('T')[0];
      
      // O güne ait habit_logs'ları çek ve habits tablosuyla join yap
      const { data, error } = await supabase
        .from('habit_logs')
        .select(`
          id,
          completed_at,
          habit_id,
          habits (
            id,
            name,
            emoji
          )
        `)
        .eq('completed_at', entryDate);

      if (error) {
        console.error('Habit logs çekme hatası:', error);
        setHabitLogs([]);
      } else {
        setHabitLogs(data || []);
      }
    } catch (err) {
      console.error('Bağlantı hatası:', err);
      setHabitLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Tarihi okunabilir formata çevir
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('tr-TR', options);
  };

  // Mood rengini belirle
  const getMoodColor = (score) => {
    if (score >= 8) return { bg: '#dcfce7', text: '#16a34a' };
    if (score >= 6) return { bg: '#fef9c3', text: '#ca8a04' };
    if (score >= 4) return { bg: '#fed7aa', text: '#ea580c' };
    return { bg: '#fecaca', text: '#dc2626' };
  };

  // Mood emoji
  const getMoodEmoji = (score) => {
    if (score >= 8) return '😊';
    if (score >= 6) return '🙂';
    if (score >= 4) return '😐';
    return '😔';
  };

  // Mood metni
  const getMoodText = (score) => {
    if (score >= 8) return 'Harika';
    if (score >= 6) return 'İyi';
    if (score >= 4) return 'Orta';
    return 'Düşük';
  };

  const moodColors = getMoodColor(entry.mood_score);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Günlük Detayı</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tarih ve Mood */}
        <View style={styles.metaSection}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={18} color="#6c757d" />
            <Text style={styles.dateText}>{formatDate(entry.created_at)}</Text>
          </View>
          
          <View style={[styles.moodCard, { backgroundColor: moodColors.bg }]}>
            <Text style={styles.moodEmoji}>{getMoodEmoji(entry.mood_score)}</Text>
            <View style={styles.moodInfo}>
              <Text style={[styles.moodScore, { color: moodColors.text }]}>
                {entry.mood_score}/10
              </Text>
              <Text style={[styles.moodLabel, { color: moodColors.text }]}>
                {getMoodText(entry.mood_score)} Mod
              </Text>
            </View>
          </View>
        </View>

        {/* Günlük İçeriği */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Günlük</Text>
          </View>
          <View style={styles.contentCard}>
            <Text style={styles.contentText}>
              {entry.content || 'Bu gün için günlük yazılmamış.'}
            </Text>
          </View>
        </View>

        {/* AI Özeti */}
        {entry.ai_summary && entry.ai_summary !== 'AI özeti yakında eklenecek' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={20} color="#6366f1" />
              <Text style={styles.sectionTitle}>AI Özeti</Text>
            </View>
            <View style={styles.aiCard}>
              <Text style={styles.aiText}>{entry.ai_summary}</Text>
            </View>
          </View>
        )}

        {/* Tamamlanan Alışkanlıklar */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#6366f1" />
            <Text style={styles.sectionTitle}>Tamamlanan Alışkanlıklar</Text>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : habitLogs.length > 0 ? (
            <View style={styles.habitsGrid}>
              {habitLogs.map((log) => (
                <View key={log.id} style={styles.habitChip}>
                  <Text style={styles.habitEmoji}>
                    {log.habits?.emoji || '✅'}
                  </Text>
                  <Text style={styles.habitTitle}>
                    {log.habits?.name || 'Alışkanlık'}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyHabits}>
              <Ionicons name="leaf-outline" size={32} color="#adb5bd" />
              <Text style={styles.emptyHabitsText}>
                Bu gün için tamamlanan alışkanlık kaydı yok
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Meta Section
  metaSection: {
    marginBottom: 24,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 15,
    color: '#6c757d',
    marginLeft: 8,
  },
  moodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  moodEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  moodInfo: {
    flex: 1,
  },
  moodScore: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  moodLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginLeft: 8,
  },
  // Content Card
  contentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contentText: {
    fontSize: 16,
    color: '#495057',
    lineHeight: 26,
  },
  // AI Card
  aiCard: {
    backgroundColor: '#f0f0ff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  aiText: {
    fontSize: 14,
    color: '#6366f1',
    lineHeight: 22,
  },
  // Habits
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#6c757d',
  },
  habitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  habitEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  habitTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2e7d32',
  },
  emptyHabits: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyHabitsText: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 12,
    textAlign: 'center',
  },
});
