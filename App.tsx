import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedScreen from './src/screens/FeedScreen';
import WatchedScreen from './src/screens/WatchedScreen';
import RandyScreen from './src/screens/RandyScreen';
import StarredScreen from './src/screens/StarredScreen';
import { requestPermissions } from './src/services/notifications';
// Must be imported at module level so TaskManager.defineTask runs before any component mounts
import { registerBackgroundFetch, runCheck } from './src/tasks/backgroundFetch';

type Tab = 'feed' | 'watched' | 'randy' | 'starred';

const TABS: { key: Tab; label: string }[] = [
  { key: 'feed', label: 'new answers' },
  { key: 'watched', label: 'my questions' },
  { key: 'randy', label: "i'm feeling randy" },
  { key: 'starred', label: 'starred' },
];

function AppContent() {
  const [tab, setTab] = useState<Tab>('feed');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    requestPermissions();
    registerBackgroundFetch();

    const HOUR = 60 * 60 * 1000;
    const timer = setInterval(() => { runCheck().catch(console.warn); }, HOUR);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.root}>
        <View style={styles.screen}>
          {/* Both screens stay mounted so switching tabs doesn't reset scroll position */}
          <View style={tab === 'feed' ? styles.screen : styles.hidden}>
            <FeedScreen />
          </View>
          <View style={tab === 'watched' ? styles.screen : styles.hidden}>
            <WatchedScreen />
          </View>
          <View style={tab === 'randy' ? styles.screen : styles.hidden}>
            <RandyScreen />
          </View>
          <View style={tab === 'starred' ? styles.screen : styles.hidden}>
            <StarredScreen />
          </View>
        </View>

        {/* Pad the tab bar by the system nav-bar inset so the buttons sit above it */}
        <View style={[styles.tabBar, { paddingBottom: insets.bottom + 10 }]}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
            >
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

// Palette lifted from billwurtz.com/questions: #323232 bg, #E9EC54 dates,
// #B387FF questions, white answers, #00FF00/#00EE3B links, #ff6666 lightred.
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#232323',
  },
  root: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#323232' },
  hidden: { display: 'none' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#232323',
    paddingTop: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: 'rgba(0,255,0,0.12)' },
  tabLabel: { color: '#888', fontSize: 11, fontWeight: '500', textAlign: 'center' },
  tabLabelActive: { color: '#00FF00', fontWeight: '700' },
});
