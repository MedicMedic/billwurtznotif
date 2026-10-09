import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

// Popup showing a question's permalink with copy / open actions.
export default function LinkSheet({ url, visible, onClose, bookmarked, onToggleBookmark }: {
  url: string | null; visible: boolean; onClose: () => void;
  // Optional: shows a bookmark action (used by the main feed).
  bookmarked?: boolean; onToggleBookmark?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const close = () => { setCopied(false); onClose(); };
  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setCopied(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet}>
          {!!onToggleBookmark && (
            <Pressable
              style={[styles.btn, styles.bookmarkBtn]}
              onPress={() => { onToggleBookmark(); close(); }}
            >
              <Text style={styles.btnText}>
                {bookmarked ? 'Remove bookmark' : 'Bookmark this spot'}
              </Text>
            </Pressable>
          )}
          {!!url && (
            <>
              <Text style={styles.sheetTitle}>Link to this question</Text>
              <Text style={styles.sheetUrl} selectable>{url}</Text>
          <View style={styles.sheetButtons}>
            <Pressable style={styles.btn} onPress={copy}>
              <Text style={styles.btnText}>{copied ? 'Copied!' : 'Copy link'}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => { if (url) Linking.openURL(url); close(); }}
            >
              <Text style={[styles.btnText, styles.btnPrimaryText]}>Open</Text>
            </Pressable>
          </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', padding: 24,
  },
  sheet: { backgroundColor: '#323232', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: '#000' },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  sheetUrl: { color: '#00EE3B', fontSize: 13, marginBottom: 16 },
  sheetButtons: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn: { backgroundColor: '#444', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  bookmarkBtn: { alignItems: 'center', marginBottom: 14 },
  btnPrimary: { backgroundColor: '#00EE3B' },
  btnPrimaryText: { color: '#000' },
});
