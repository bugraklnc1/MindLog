import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  ScrollView,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../lib/supabase';

const screenWidth = Dimensions.get('window').width;

export default function GraphScreen() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchEntries();
    }, [])
  );

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('id, mood_score, created_at')
        .order('created_at', { ascending: false }) // En yeniden başla
        .limit(7); // Son 7 gün

      if (error) {
        console.error('Entries çekme hatası:', error);
        setEntries([]);
      } else {
        // Grafikte soldan sağa kronolojik sıra için tersine çevir
        setEntries((data || []).reverse());
      }
    } catch (err) {
      console.error('Bağlantı hatası:', err);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEntries();
  }, []);

  // Mood rengini belirle (gradient için)
  const getMoodColor = (score) => {
    if (score >= 8) return '#16a34a'; // Yeşil
    if (score >= 6) return '#84cc16'; // Açık yeşil
    if (score >= 4) return '#eab308'; // Sarı
    if (score >= 2) return '#f97316'; // Turuncu
    return '#dc2626'; // Kırmızı
  };

  // Tarihi kısa formata çevir
  const formatDateShort = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  // Ortalama mood hesapla
  const averageMood = entries.length > 0 
    ? (entries.reduce((sum, e) => sum + (e.mood_score || 0), 0) / entries.length).toFixed(1)
    : 0;

  // En yüksek ve en düşük mood
  const highestMood = entries.length > 0 
    ? Math.max(...entries.map(e => e.mood_score || 0))
    : 0;
  const lowestMood = entries.length > 0 
    ? Math.min(...entries.map(e => e.mood_score || 0))
    : 0;

  // Grafik verisi hazırla
  const chartData = {
    labels: entries.map(e => formatDateShort(e.created_at)),
    datasets: [
      {
        data: entries.map(e => e.mood_score || 0),
        color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  // Loading durumu
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Grafik</Text>
          <Text style={styles.headerSubtitle}>Mood Analizi</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Boş durum
  if (entries.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Grafik</Text>
          <Text style={styles.headerSubtitle}>Mood Analizi</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="analytics-outline" size={64} color="#adb5bd" />
          </View>
          <Text style={styles.emptyTitle}>Henüz veri yok!</Text>
          <Text style={styles.emptyText}>
            Günlük girişleri yaptıktan sonra mood grafiğin burada görünecek.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Grafik</Text>
        <Text style={styles.headerSubtitle}>Mood Analizi</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {/* İstatistik Kartları */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#f0f0ff' }]}>
            <Ionicons name="analytics" size={24} color="#6366f1" />
            <Text style={styles.statValue}>{averageMood}</Text>
            <Text style={styles.statLabel}>Ortalama</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Ionicons name="arrow-up-circle" size={24} color="#16a34a" />
            <Text style={[styles.statValue, { color: '#16a34a' }]}>{highestMood}</Text>
            <Text style={styles.statLabel}>En Yüksek</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: '#fecaca' }]}>
            <Ionicons name="arrow-down-circle" size={24} color="#dc2626" />
            <Text style={[styles.statValue, { color: '#dc2626' }]}>{lowestMood}</Text>
            <Text style={styles.statLabel}>En Düşük</Text>
          </View>
        </View>

        {/* Mood Grafiği */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Mood Grafiği</Text>
          <Text style={styles.chartSubtitle}>Son {entries.length} günlük giriş</Text>
          
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={screenWidth - 40}
              height={220}
              yAxisSuffix=""
              yAxisInterval={1}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(108, 117, 125, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#6366f1',
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: '#e9ecef',
                  strokeWidth: 1,
                },
              }}
              bezier
              style={styles.chart}
              fromZero
              yAxisMin={0}
              yAxisMax={10}
              segments={5}
              renderDotContent={({ x, y, index }) => {
                const mood = entries[index]?.mood_score || 0;
                const color = getMoodColor(mood);
                return (
                  <View
                    key={index}
                    style={{
                      position: 'absolute',
                      left: x - 8,
                      top: y - 8,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: color,
                      borderWidth: 2,
                      borderColor: '#fff',
                      shadowColor: color,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  />
                );
              }}
            />
          </View>
        </View>

        {/* Renk Açıklaması */}
        <View style={styles.legendSection}>
          <Text style={styles.legendTitle}>Renk Açıklaması</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#16a34a' }]} />
              <Text style={styles.legendText}>8-10: Harika</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#84cc16' }]} />
              <Text style={styles.legendText}>6-7: İyi</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
              <Text style={styles.legendText}>4-5: Orta</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
              <Text style={styles.legendText}>2-3: Düşük</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#dc2626' }]} />
              <Text style={styles.legendText}>0-1: Çok Düşük</Text>
            </View>
          </View>
        </View>

        {/* Günlük Detay Listesi */}
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>Günlük Mood Detayları</Text>
          {entries.slice().reverse().map((entry, index) => {
            const color = getMoodColor(entry.mood_score);
            const date = new Date(entry.created_at);
            const formattedDate = date.toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'short',
            });
            
            return (
              <View key={entry.id} style={styles.detailItem}>
                <View style={styles.detailLeft}>
                  <View style={[styles.detailDot, { backgroundColor: color }]} />
                  <Text style={styles.detailDate}>{formattedDate}</Text>
                </View>
                <View style={[styles.detailBadge, { backgroundColor: color + '20' }]}>
                  <Text style={[styles.detailScore, { color }]}>{entry.mood_score}/10</Text>
                </View>
              </View>
            );
          })}
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
  },
  emptyText: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  // Chart
  chartSection: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
    marginBottom: 16,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  // Legend
  legendSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    color: '#495057',
  },
  // Detail
  detailSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  detailDate: {
    fontSize: 15,
    color: '#495057',
  },
  detailBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailScore: {
    fontSize: 14,
    fontWeight: '600',
  },
});
