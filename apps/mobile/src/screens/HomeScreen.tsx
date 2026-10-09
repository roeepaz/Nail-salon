import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Sparkles, Leaf, ShieldCheck, CalendarPlus } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@nail-salon/api';

type GalleryImage = Database['public']['Tables']['gallery_images']['Row'];

type Props = {
  session: Session;
  onBookPress: () => void;
  onAppointmentsPress: () => void;
};

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ session, onBookPress, onAppointmentsPress }: Props) {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: imgs } = await supabase
          .from('gallery_images')
          .select('*')
          .order('sort_order', { ascending: true });
        if (imgs) setGallery(imgs);

        const todayStr = new Date().toISOString().split('T')[0];
        const { data: appts } = await supabase
          .from('appointments')
          .select('id')
          .eq('user_id', session.user.id)
          .gte('appointment_date', todayStr);
        if (appts) setUpcomingCount(appts.length);
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
        <ActivityIndicator size="large" color="#B76E79" />
      </View>
    );
  }

  const mainImage = gallery.length > 0 ? gallery[0].url : 'https://via.placeholder.com/400x500';

  const handleLogoutPress = () => {
    Alert.alert(
      'התנתקות',
      'האם את בטוחה שברצונך להתנתק מהמשתמש?',
      [
        { text: 'לא', style: 'cancel' },
        { text: 'כן, התנתקי', onPress: () => supabase.auth.signOut(), style: 'destructive' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBookButton} onPress={onBookPress}>
            <Text style={styles.headerBookButtonText}>קביעת תור</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.userPill} onPress={handleLogoutPress} activeOpacity={0.7}>
            <Text style={styles.userPillText}>{session.user.user_metadata?.full_name?.split(' ')[0] || 'לקוחה'}</Text>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{(session.user.user_metadata?.full_name?.[0] || 'ל').toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
          <View style={{flex: 1}} />
          <Text style={styles.logoText}>אליאל ביוטי</Text>
          <View style={styles.logoCircle}>
            <Text style={styles.logoCircleText}>EB</Text>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.eyebrow}>סטודיו בוטיק לציפורניים</Text>
          <Text style={styles.title}>יופי מדויק,</Text>
          <Text style={styles.titleHighlight}>מגע של יוקרה.</Text>
          <Text style={styles.subtitle}>
            הכנה יסודית, קווים נקיים ועמידות מושלמת לשבועות. כיסא אחד, לקוחה אחת בכל פעם, ביחס אישי ומפנק.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>לצפייה בטיפולים</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={onBookPress}>
            <Text style={styles.primaryButtonText}>קביעת תור ←</Text>
          </TouchableOpacity>
        </View>

        {/* Features list */}
        <View style={styles.featuresRow}>
          <View style={styles.featureItem}>
            <Sparkles size={16} color="#B76E79" style={styles.featureIcon} />
            <Text style={styles.featureText}>עמידות ל-3 שבועות</Text>
          </View>
          <View style={styles.featureItem}>
            <Leaf size={16} color="#B76E79" style={styles.featureIcon} />
            <Text style={styles.featureText}>מניקור מכשירי עדין</Text>
          </View>
        </View>
        <View style={[styles.featuresRow, { justifyContent: 'center', marginTop: 8 }]}>
          <View style={styles.featureItem}>
            <ShieldCheck size={16} color="#B76E79" style={styles.featureIcon} />
            <Text style={styles.featureText}>כלים סטריליים ומחוטאים</Text>
          </View>
        </View>

        {/* Big Image Section */}
        <View style={styles.imageWrapper}>
          <Image source={{ uri: mainImage }} style={styles.mainImage} resizeMode="cover" />
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>

      <TouchableOpacity style={styles.floatingBookBtn} onPress={onAppointmentsPress} activeOpacity={0.8}>
        <CalendarPlus color="#fff" size={20} />
        <Text style={styles.floatingBookBtnText}>התורים שלי</Text>
        {upcomingCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>{upcomingCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF2F2', // Soft blush gradient feel
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF2F2',
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  headerBookButton: {
    backgroundColor: '#B76E79', // Rose color
    paddingVertical: 12, // Increased for 44px min touch target
    paddingHorizontal: 20,
    borderRadius: 24,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBookButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    minHeight: 44, // 44px min touch target equivalent if tappable
  },
  userPillText: {
    fontSize: 14,
    color: '#333',
    marginRight: 6,
    fontWeight: '500',
  },
  userAvatar: {
    backgroundColor: '#FFE5E5',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 12,
    color: '#B76E79',
    fontWeight: 'bold',
  },
  logoText: {
    fontSize: 20,
    color: '#B76E79',
    fontWeight: '300',
    marginRight: 10,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5E6E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircleText: {
    color: '#B76E79',
    fontSize: 12,
  },
  heroSection: {
    paddingHorizontal: 24,
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  eyebrow: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 42,
    fontWeight: '300',
    color: '#333',
    textAlign: 'right',
  },
  titleHighlight: {
    fontSize: 42,
    fontWeight: '300',
    color: '#B76E79',
    fontStyle: 'italic',
    textAlign: 'right',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'right',
    lineHeight: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 40,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#B76E79',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    flex: 1,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    flex: 1,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  featureItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  featureIcon: {
    marginLeft: 6,
  },
  featureText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  imageWrapper: {
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    flex: 1,
    minHeight: 160,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  floatingBookBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#B76E79',
    shadowColor: '#B76E79',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    gap: 8,
  },
  floatingBookBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#333',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  footerSpacer: {
    height: 40,
  },
});
