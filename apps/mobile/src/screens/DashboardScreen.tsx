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
};

export default function DashboardScreen({ session, onBookPress }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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
      <View style={styles.cardHeader}>
        <Text style={styles.serviceName}>{item.service_type}</Text>
        <View style={[styles.statusBadge, item.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
          <Text style={styles.statusText}>
            {item.status === 'confirmed' ? 'מאושר' : item.status === 'pending' ? 'ממתין' : item.status}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardBody}>
        <Text style={styles.dateTime}>
          {item.appointment_date} בשעה {item.appointment_time}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>שלום,</Text>
        <Text style={styles.subtitle}>{session.user.email}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>התורים שלך</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#D4B5B0" style={styles.loader} />
        ) : appointments.length > 0 ? (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            renderItem={renderAppointment}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>אין לך תורים קרובים.</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.bookButton} onPress={onBookPress}>
          <Text style={styles.bookButtonText}>קבעי תור חדש</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={styles.logoutText}>התנתקות</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6', // Off-white elegant background
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '300',
    color: '#333',
    textAlign: 'right',
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
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
  },
  listContainer: {
    paddingBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusConfirmed: {
    backgroundColor: '#E8F5E9',
  },
  statusPending: {
    backgroundColor: '#FFF8E1',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  cardBody: {
    alignItems: 'flex-end',
  },
  dateTime: {
    fontSize: 15,
    color: '#555',
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
  logoutButton: {
    padding: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#999',
    fontSize: 14,
  },
});
