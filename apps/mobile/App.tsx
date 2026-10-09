import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from './src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BookingScreen from './src/screens/BookingScreen';
import HomeScreen from './src/screens/HomeScreen';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'dashboard' | 'booking'>('home');

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCurrentScreen('home'); // reset to home on login/logout
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {session && session.user ? (
        currentScreen === 'home' ? (
          <HomeScreen
            session={session}
            onBookPress={() => setCurrentScreen('booking')}
            onAppointmentsPress={() => setCurrentScreen('dashboard')}
          />
        ) : currentScreen === 'dashboard' ? (
          <DashboardScreen 
            session={session} 
            onBookPress={() => setCurrentScreen('booking')}
            onBack={() => setCurrentScreen('home')}
          />
        ) : (
          <BookingScreen 
            session={session}
            onBack={() => setCurrentScreen('home')} 
            onBookingSuccess={() => setCurrentScreen('dashboard')}
          />
        )
      ) : (
        <LoginScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
