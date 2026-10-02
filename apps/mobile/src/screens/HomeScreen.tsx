import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@nail-salon/api';

type Appointment = Database['public']['Tables']['appointments']['Row'];
type Service = Database['public']['Tables']['services']['Row'];
type GalleryImage = Database['public']['Tables']['gallery_images']['Row'];

type Props = {
  session: Session;
  onBookPress: () => void;
};

const { width } = Dimensions.get('window');

export default function HomeScreen({ session, onBookPress }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch user's appointments
        const { data: appts } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', session.user.id)
          .order('appointment_date', { ascending: true })
          .limit(3);

        // Fetch active services
        const { data: servs } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        // Fetch gallery images
        const { data: imgs } = await supabase
          .from('gallery_images')
          .select('*')
          .order('sort_order', { ascending: true });

        if (appts) setAppointments(appts);
        if (servs) setServices(servs);
        if (imgs) setGallery(imgs);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session.user.id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4B5B0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header Area */}
        <View style={styles.header}>
          <Text style={styles.greeting}>אליאל ביוטי</Text>
          <Text style={styles.subtitle}>שלום, {session.user.user_metadata?.full_name || session.user.email?.split('@')[0]}</Text>
        </View>

        {/* Hero Booking Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>מוכנה לפינוק שמגיע לך?</Text>
          <Text style={styles.heroSubtitle}>קבעי תור אונליין תוך דקה</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={onBookPress}>
            <Text style={styles.primaryButtonText}>קביעת תור עכשיו</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>התורים הקרובים שלך</Text>
            {appointments.map((appt) => (
              <View key={appt.id} style={styles.appointmentCard}>
                <View style={styles.apptHeader}>
                  <Text style={styles.apptService}>{appt.service_type}</Text>
                  <View style={[styles.statusBadge, appt.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
                    <Text style={styles.statusText}>
                      {appt.status === 'confirmed' ? 'מאושר' : appt.status === 'pending' ? 'ממתין' : appt.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.apptDate}>
                  {appt.appointment_date} | שעה {appt.appointment_time}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Services Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>תפריט טיפולים</Text>
          {services.map((service) => (
            <View key={service.id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.servicePrice}>{service.price}</Text>
              </View>
              <Text style={styles.serviceDuration}>{service.duration}</Text>
              <Text style={styles.serviceDesc}>{service.description}</Text>
            </View>
          ))}
        </View>

        {/* Gallery */}
        {gallery.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>הצצה לסטודיו</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScrollContent}>
              {gallery.map((img) => (
                <Image
                  key={img.id}
                  source={{ uri: img.url }}
                  style={styles.galleryImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}
        
        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F6',
  },
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '300',
    color: '#333',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  heroCard: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#D4B5B0',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(212, 181, 176, 0.3)',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#D4B5B0',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    marginBottom: 16,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  apptHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  apptService: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  apptDate: {
    fontSize: 15,
    color: '#555',
    textAlign: 'right',
  },
  serviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  serviceHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D4B5B0',
  },
  serviceDuration: {
    fontSize: 14,
    color: '#888',
    textAlign: 'right',
    marginBottom: 12,
  },
  serviceDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
    lineHeight: 20,
  },
  galleryScrollContent: {
    paddingBottom: 16,
    flexDirection: 'row-reverse',
  },
  galleryImage: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 24,
    marginRight: 16,
    backgroundColor: '#EEE',
  },
  footerSpacer: {
    height: 40,
  },
});
