import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@nail-salon/api';

type Appointment = Database['public']['Tables']['appointments']['Row'];

type Props = {
  session: Session;
  onBookPress: () => void;
  onBack: () => void;
};

export default function DashboardScreen({ session, onBookPress, onBack }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllAppointments, setShowAllAppointments] = useState(false);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', session.user.id)
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true });

        if (error) {
          console.error(error);
        } else {
          // Filter to show only upcoming or recent appointments (optional)
          setAppointments(data || []);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, [session.user.id]);

  const renderAppointment = ({ item }: { item: Appointment }) => (
    <View style={styles.card}>
      <View style={styles.cardRight}>
        <Text style={styles.serviceName}>{item.service_type}</Text>
        <Text style={styles.dateTime}>
          🕒 {item.appointment_date} • {item.appointment_time}
        </Text>
      </View>
      <View style={styles.cardLeft}>
        <View style={[styles.statusBadge, item.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
          <Text style={[styles.statusText, item.status === 'confirmed' ? styles.statusTextConfirmed : styles.statusTextPending]}>
            {item.status === 'confirmed' ? 'מאושר ✓' : item.status === 'pending' ? 'ממתין' : item.status}
          </Text>
        </View>
      </View>
    </View>
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingAppointments = appointments.filter(a => a.appointment_date >= todayStr);
  const displayedAppointments = showAllAppointments ? appointments : upcomingAppointments;
  const hasPastAppointments = appointments.length > upcomingAppointments.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>חזרי</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.greeting}>
              שלום, <Text style={styles.greetingName}>{session.user.user_metadata?.full_name || 'לקוחה'}</Text>
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>התורים שלך</Text>
          <Text style={styles.sectionSubtitle}>ריכזנו עבורך את התורים הקרובים</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#D4B5B0" style={styles.loader} />
        ) : displayedAppointments.length > 0 ? (
          <>
            <FlatList
              data={displayedAppointments}
              keyExtractor={(item) => item.id}
              renderItem={renderAppointment}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
            {!showAllAppointments && hasPastAppointments && (
              <TouchableOpacity 
                style={styles.showAllButton} 
                onPress={() => setShowAllAppointments(true)}
              >
                <Text style={styles.showAllButtonText}>הצג היסטוריית תורים</Text>
              </TouchableOpacity>
            )}
            {showAllAppointments && hasPastAppointments && (
              <TouchableOpacity 
                style={styles.showAllButton} 
                onPress={() => setShowAllAppointments(false)}
              >
                <Text style={styles.showAllButtonText}>הסתר היסטוריית תורים</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>אין לך תורים להצגה.</Text>
            {!showAllAppointments && hasPastAppointments && (
              <TouchableOpacity 
                style={[styles.showAllButton, { marginTop: 20 }]} 
                onPress={() => setShowAllAppointments(true)}
              >
                <Text style={styles.showAllButtonText}>הצג היסטוריית תורים</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.bookButton} onPress={onBookPress}>
          <Text style={styles.bookButtonText}>קבעי תור חדש</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF2F2', // Match home screen background
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#B76E79',
    fontSize: 16,
    fontWeight: '600',
  },
  greeting: {
    fontSize: 30,
    fontWeight: '300',
    color: '#333',
    textAlign: 'right',
  },
  greetingName: {
    fontWeight: '600',
    color: '#B76E79', // Rose color for the name
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  listContainer: {
    paddingBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#B76E79',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  cardLeft: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusConfirmed: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  statusPending: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFECB3',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextConfirmed: {
    color: '#2E7D32',
  },
  statusTextPending: {
    color: '#F57F17',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  footer: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
  },
  bookButton: {
    backgroundColor: '#D4B5B0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  showAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  showAllButtonText: {
    color: '#B76E79',
    fontSize: 14,
    fontWeight: '600',
  },
});
