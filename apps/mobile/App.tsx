import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from './src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BookingScreen from './src/screens/BookingScreen';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'booking'>('dashboard');

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCurrentScreen('dashboard'); // reset to dashboard on login/logout
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {session && session.user ? (
        currentScreen === 'dashboard' ? (
          <DashboardScreen 
            session={session} 
            onBookPress={() => setCurrentScreen('booking')} 
          />
        ) : (
          <BookingScreen 
            session={session}
            onBack={() => setCurrentScreen('dashboard')} 
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
