import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@nail-salon/api';

type Service = Database['public']['Tables']['services']['Row'];
type WorkingHours = Database['public']['Tables']['working_hours']['Row'];

type Props = {
  session: Session;
  onBack: () => void;
  onBookingSuccess: () => void;
};

const DAYS_OF_WEEK = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export default function BookingScreen({ session, onBack, onBookingSuccess }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  
  const [services, setServices] = useState<Service[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Generate next 14 days
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(new Date().getDate() + i);
    return d;
  });

  // Fetch initial static data (Services & Working Hours)
  useEffect(() => {
    async function fetchStaticData() {
      try {
        const [servicesRes, hoursRes] = await Promise.all([
          supabase.from('services').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
          supabase.from('working_hours').select('*')
        ]);

        if (servicesRes.data) {
          setServices(servicesRes.data);
          if (servicesRes.data.length > 0) setSelectedService(servicesRes.data[0]);
        }
        if (hoursRes.data) {
          setWorkingHours(hoursRes.data);
        }
      } finally {
        setLoadingInitial(false);
      }
    }
    fetchStaticData();
  }, []);

  // Fetch booked slots whenever the date changes
  useEffect(() => {
    async function fetchBookedSlots() {
      setLoadingSlots(true);
      setSelectedTime(null);
      const dateString = selectedDate.toISOString().split('T')[0];
      
      const { data } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('appointment_date', dateString)
        .in('status', ['pending', 'confirmed']);

      if (data) {
        setBookedSlots(data.map(a => a.appointment_time));
      }
      setLoadingSlots(false);
    }
    fetchBookedSlots();
  }, [selectedDate]);

  // Generate dynamic time slots based on working hours
  const generateTimeSlotsForDate = (date: Date) => {
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
    // DB assumes day_of_week is 0-6 where 0 might be Sunday or Monday, assuming JS standard (0 = Sunday).
    const hours = workingHours.find(h => h.day_of_week === dayOfWeek);
    
    if (!hours || !hours.is_open) return []; // Closed

    const slots = [];
    let currentHour = parseInt(hours.open_time.split(':')[0]);
    let currentMinute = parseInt(hours.open_time.split(':')[1]);
    const closeHour = parseInt(hours.close_time.split(':')[0]);
    const closeMinute = parseInt(hours.close_time.split(':')[1]);

    while (currentHour < closeHour || (currentHour === closeHour && currentMinute < closeMinute)) {
      const hStr = currentHour < 10 ? `0${currentHour}` : `${currentHour}`;
      const mStr = currentMinute < 10 ? `0${currentMinute}` : `${currentMinute}`;
      slots.push(`${hStr}:${mStr}:00`); // Assuming DB format uses seconds HH:MM:SS or HH:MM
      
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentHour += 1;
        currentMinute = 0;
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlotsForDate(selectedDate);

  async function handleBook() {
    if (!selectedTime || !selectedService) return;

    setBookingInProgress(true);
    const dateString = selectedDate.toISOString().split('T')[0];
    
    const { error } = await supabase.from('appointments').insert({
      user_id: session.user.id,
      appointment_date: dateString,
      appointment_time: selectedTime,
      service_type: selectedService.name,
      status: 'pending',
      client_name: session.user.user_metadata?.full_name || 'לקוחה',
      client_phone: session.user.user_metadata?.phone || '',
    });

    setBookingInProgress(false);

    if (error) {
      Alert.alert('שגיאה', 'לא הצלחנו לקבוע את התור, נסי שוב.');
    } else {
      Alert.alert('יש!', 'התור שלך נקבע בהצלחה וממתין לאישור.');
      onBookingSuccess();
    }
  }

  if (loadingInitial) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4B5B0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>חזור</Text>
        </TouchableOpacity>
        <Text style={styles.title}>קביעת תור</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionTitle}>בחרי סוג שירות</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesScrollContent}>
          {services.map((service) => {
            const isSelected = selectedService?.id === service.id;
            return (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceChip, isSelected && styles.serviceChipSelected]}
                onPress={() => setSelectedService(service)}
              >
                <Text style={[styles.serviceChipText, isSelected && styles.serviceChipTextSelected]}>
                  {service.name}
                </Text>
                <Text style={[styles.serviceChipPrice, isSelected && styles.serviceChipTextSelected]}>
                  {service.price}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>בחרי תאריך</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateListContent}>
          {days.map((date, index) => {
            const isSelected = date.getDate() === selectedDate.getDate();
            return (
              <TouchableOpacity
                key={index}
                style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[styles.dayText, isSelected && styles.dateTextSelected]}>
                  {DAYS_OF_WEEK[date.getDay()]}
                </Text>
                <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                  {date.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>בחרי שעה</Text>
        {loadingSlots ? (
          <ActivityIndicator color="#D4B5B0" style={{ marginTop: 20 }} />
        ) : timeSlots.length === 0 ? (
          <View style={styles.closedState}>
            <Text style={styles.closedStateText}>הסטודיו סגור ביום זה, אנא בחרי יום אחר.</Text>
          </View>
        ) : (
          <View style={styles.timeGrid}>
            {timeSlots.map((time, index) => {
              // Convert HH:MM:SS to HH:MM for display and comparison
              const displayTime = time.substring(0, 5);
              
              // Simple booking check (assuming DB stores HH:MM:SS or HH:MM)
              const isBooked = bookedSlots.some(b => b.startsWith(displayTime));
              const isSelected = selectedTime === time;
              
              return (
                <TouchableOpacity
                  key={index}
                  disabled={isBooked}
                  style={[
                    styles.timeSlot,
                    isSelected && styles.timeSlotSelected,
                    isBooked && styles.timeSlotDisabled
                  ]}
                  onPress={() => setSelectedTime(time)}
                >
                  <Text style={[
                    styles.timeText,
                    isSelected && styles.timeTextSelected,
                    isBooked && styles.timeTextDisabled
                  ]}>
                    {displayTime}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!selectedTime || !selectedService) && styles.submitButtonDisabled]}
          onPress={handleBook}
          disabled={!selectedTime || !selectedService || bookingInProgress}
        >
          {bookingInProgress ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>קבעי לי תור</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: '#fff', flexDirection: 'row-reverse',
    alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#EAEAEA',
  },
  title: { fontSize: 20, fontWeight: '600', color: '#333' },
  backButton: { padding: 8 },
  backButtonText: { color: '#D4B5B0', fontSize: 16, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'right', marginBottom: 16, marginTop: 8 },
  servicesScrollContent: { paddingBottom: 24, flexDirection: 'row-reverse' },
  serviceChip: {
    backgroundColor: '#fff', padding: 16, borderRadius: 16,
    marginRight: 12, borderWidth: 1, borderColor: '#EAEAEA',
    minWidth: 120, alignItems: 'center'
  },
  serviceChipSelected: { backgroundColor: '#D4B5B0', borderColor: '#D4B5B0' },
  serviceChipText: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  serviceChipPrice: { fontSize: 14, color: '#666' },
  serviceChipTextSelected: { color: '#fff' },
  dateListContent: { paddingBottom: 32, flexDirection: 'row-reverse' },
  dateCard: {
    width: 65, height: 80, backgroundColor: '#fff', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: '#EAEAEA',
  },
  dateCardSelected: { backgroundColor: '#333', borderColor: '#333' },
  dayText: { fontSize: 14, color: '#666', marginBottom: 4 },
  dateText: { fontSize: 20, fontWeight: '600', color: '#333' },
  dateTextSelected: { color: '#fff' },
  closedState: { padding: 20, alignItems: 'center', backgroundColor: '#F9F9F9', borderRadius: 12 },
  closedStateText: { color: '#999', fontSize: 16 },
  timeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 12 },
  timeSlot: {
    width: '30%', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#EAEAEA', marginBottom: 12, marginLeft: '3%'
  },
  timeSlotSelected: { backgroundColor: '#333', borderColor: '#333' },
  timeSlotDisabled: { backgroundColor: '#F5F5F5', borderColor: '#EAEAEA' },
  timeText: { fontSize: 16, color: '#333', fontWeight: '500' },
  timeTextSelected: { color: '#fff' },
  timeTextDisabled: { color: '#CCC', textDecorationLine: 'line-through' },
  footer: { padding: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EAEAEA' },
  submitButton: { backgroundColor: '#D4B5B0', padding: 16, borderRadius: 30, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: '#EAEAEA' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', letterSpacing: 0.5 },
});
