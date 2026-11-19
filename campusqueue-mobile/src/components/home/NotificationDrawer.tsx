import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { NotificationItem } from '../../types/queue';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface NotificationDrawerProps {
  visible: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onPressNotification: (notification: NotificationItem) => void;
}

export function NotificationDrawer({
  visible,
  notifications,
  onClose,
  onMarkAllRead,
  onPressNotification,
}: NotificationDrawerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, Shadows.modal]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Notifications</Text>
            <View style={styles.headerRight}>
              <Pressable onPress={onMarkAllRead} hitSlop={6}>
                <Text style={styles.markAllText}>Mark All Read</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close notifications"
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Feather name="x" size={15} color={Colors.ink} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {notifications.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onPressNotification(item)}
                style={({ pressed }) => [styles.itemCard, pressed && styles.pressed]}
              >
                <View style={styles.itemTopRow}>
                  <View style={styles.itemTitleRow}>
                    {!item.read ? (
                      <View style={[styles.unreadDot, { backgroundColor: item.dotColor }]} />
                    ) : null}
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>
                <Text style={styles.itemMessage}>{item.message}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdropSheet,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    maxHeight: '76%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(18, 20, 23, 0.15)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  markAllText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
    color: Colors.registrar,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listScroll: {
    flexGrow: 0,
  },
  listContent: {
    gap: 8,
  },
  itemCard: {
    padding: 12,
    borderRadius: Radii.xl,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemTitle: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.ink,
  },
  itemTime: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    color: Colors.inkSoft,
    fontVariant: ['tabular-nums'],
  },
  itemMessage: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.inkSoft,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
