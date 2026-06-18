import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function HistoryScreen() {
  const navigation = useNavigation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ekran odaklandığında verileri çek
  useFocusEffect(
    useCallback(() => {
      fetchEntries();
    }, [])
  );

  // Entries verilerini Supabase'den çek
  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .order('created_at', { ascending: false }); // Yeniden eskiye

      if (error) {
        console.error('Entries çekme hatası:', error);
        setEntries([]);
      } else {
        setEntries(data || []);
      }
    } catch (err) {
      console.error('Bağlantı hatası:', err);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEntries();
  }, []);

  // Tarihi okunabilir formata çevir
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('tr-TR', options);
  };

  // Mood rengini belirle
  const getMoodColor = (score) => {
    if (score >= 8) return { bg: '#dcfce7', text: '#16a34a' }; // Yeşil
    if (score >= 6) return { bg: '#fef9c3', text: '#ca8a04' }; // Sarı
    if (score >= 4) return { bg: '#fed7aa', text: '#ea580c' }; // Turuncu
    return { bg: '#fecaca', text: '#dc2626' }; // Kırmızı
  };

  // Mood emoji
  const getMoodEmoji = (score) => {
    if (score >= 8) return '😊';
    if (score >= 6) return '🙂';
    if (score >= 4) return '😐';
    return '😔';
  };

  // Entry kartı render
  const renderEntryCard = ({ item }) => {
    const moodColors = getMoodColor(item.mood_score);
    const contentPreview = item.content 
      ? item.content.length > 100 
        ? item.content.substring(0, 100) + '...' 
        : item.content
      : 'İçerik yok';

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('EntryDetail', { entry: item })}
      >
        {/* Kart Header */}
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color="#6c757d" />
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
          
          {/* Mood Badge */}
          <View style={[styles.moodBadge, { backgroundColor: moodColors.bg }]}>
            <Text style={styles.moodEmoji}>{getMoodEmoji(item.mood_score)}</Text>
            <Text style={[styles.moodScore, { color: moodColors.text }]}>
              {item.mood_score}/10
            </Text>
          </View>
        </View>

        {/* Kart İçerik */}
        <Text style={styles.contentText}>{contentPreview}</Text>

        {/* AI Özeti (varsa) */}
        {item.ai_summary && item.ai_summary !== 'AI özeti yakında eklenecek' && (
          <View style={styles.summaryContainer}>
            <Ionicons name="sparkles" size={14} color="#6366f1" />
            <Text style={styles.summaryText}>{item.ai_summary}</Text>
          </View>
        )}
        
        {/* Detay Göstergesi */}
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Detay için dokun</Text>
          <Ionicons name="chevron-forward" size={14} color="#adb5bd" />
        </View>
      </TouchableOpacity>
    );
  };

  // Boş liste komponenti
  const EmptyListComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="journal-outline" size={64} color="#adb5bd" />
      </View>
      <Text style={styles.emptyTitle}>Henüz günlük girmedin!</Text>
      <Text style={styles.emptyText}>
        Bugün sekmesinden günlük yazarak başla. Her gün birkaç dakikanı ayırarak düşüncelerini kaydet.
      </Text>
      <View style={styles.emptyTip}>
        <Ionicons name="bulb-outline" size={20} color="#6366f1" />
        <Text style={styles.emptyTipText}>
          İpucu: Düzenli günlük tutmak zihinsel sağlığını güçlendirir!
        </Text>
      </View>
    </View>
  );

  // Loading durumu
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Geçmiş</Text>
          <Text style={styles.headerSubtitle}>Günlüklerim</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Geçmiş</Text>
        <Text style={styles.headerSubtitle}>
          {entries.length > 0 
            ? `${entries.length} günlük girişi` 
            : 'Günlüklerim'}
        </Text>
      </View>

      {/* Entry Listesi */}
      <FlatList
        data={entries}
        renderItem={renderEntryCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          entries.length === 0 && styles.emptyListContent
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={EmptyListComponent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 16,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212529',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 4,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  // Liste
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  // Kart
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 6,
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  moodScore: {
    fontSize: 13,
    fontWeight: '600',
  },
  contentText: {
    fontSize: 15,
    color: '#495057',
    lineHeight: 22,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    color: '#6366f1',
    marginLeft: 6,
    lineHeight: 18,
  },
  // Boş Liste
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyTipText: {
    flex: 1,
    fontSize: 13,
    color: '#6366f1',
    marginLeft: 10,
    lineHeight: 18,
  },
  // Tap Hint
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  tapHintText: {
    fontSize: 12,
    color: '#adb5bd',
    marginRight: 4,
  },
});
