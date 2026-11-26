import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminOfficeRecord } from '../../types/admin';

interface OfficeCongestionDrilldownModalProps {
  office: AdminOfficeRecord | null;
  onClose: () => void;
  onManageOffice: (officeId: string) => void;
}

export function OfficeCongestionDrilldownModal({
  office,
  onClose,
  onManageOffice,
}: OfficeCongestionDrilldownModalProps) {
  if (!office) return null;

  const assignedStaff = office.windows.filter((w) => w.staffName);

  return (
    <Modal visible={Boolean(office)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadows.modal]} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.prefixChip, { backgroundColor: office.themeColor }]}>
                <Text style={styles.prefixText}>{office.prefix}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>{office.name}</Text>
                <Text style={styles.subtitle}>
                  {office.activeWaitingCount} waiting • Avg {office.avgWaitMinutes}m wait
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeIconBtn}>
              <Feather name="x" size={18} color={Colors.inkSoft} />
            </Pressable>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* Active Windows */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACTIVE WINDOWS</Text>
              <View style={styles.listBox}>
                {office.windows.map((win) => {
                  const isOnline = win.status === 'Online';
                  const isBreak = win.status === 'Break';
                  return (
                    <View key={win.label} style={styles.windowRow}>
                      <View style={styles.windowLeft}>
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isOnline
                                ? Colors.successText
                                : isBreak
                                  ? Colors.warning
                                  : Colors.inkMuted,
                            },
                          ]}
                        />
                        <Text style={styles.windowLabel}>{win.label}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: isOnline
                              ? Colors.matchaSoftBg
                              : isBreak
                                ? Colors.warningSoftBg
                                : Colors.surfaceMuted,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            {
                              color: isOnline
                                ? Colors.successText
                                : isBreak
                                  ? Colors.warningDark
                                  : Colors.inkNeutral,
                            },
                          ]}
                        >
                          {win.status}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Assigned Staff */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ASSIGNED STAFF LOGGED IN</Text>
              {assignedStaff.length === 0 ? (
                <Text style={styles.emptyText}>No staff currently signed in to this office.</Text>
              ) : (
                <View style={styles.listBox}>
                  {assignedStaff.map((win) => (
                    <View key={`${win.label}-${win.staffId}`} style={styles.staffRow}>
                      <View>
                        <Text style={styles.staffName}>{win.staffName}</Text>
                        <Text style={styles.staffMeta}>
                          {win.staffId} • {win.label}
                        </Text>
                      </View>
                      <Text style={styles.staffStatusText}>{win.status}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Waiting Breakdown by Service */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>WAITING TICKETS BY SERVICE</Text>
              <View style={styles.listBox}>
                {office.services.map((srv) => (
                  <View key={srv.id} style={styles.serviceRow}>
                    <Text style={styles.serviceName} numberOfLines={1}>
                      {srv.name}
                    </Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{srv.waitingCount}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
            <Pressable
              onPress={() => onManageOffice(office.id)}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            >
              <Feather name="settings" size={14} color={Colors.surface} />
              <Text style={styles.primaryBtnText}>Manage Office Settings</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.modal,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    maxHeight: '84%',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  prefixChip: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: Colors.surface,
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 16,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  closeIconBtn: {
    padding: 4,
  },
  bodyScroll: {
    maxHeight: 380,
  },
  section: {
    marginBottom: 14,
    gap: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: Colors.inkMuted,
  },
  listBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  windowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  windowLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.ink,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  statusPillText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  staffName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.ink,
  },
  staffMeta: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 1,
  },
  staffStatusText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 8,
  },
  serviceName: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.ink,
  },
  countBadge: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: Colors.ink,
    alignItems: 'center',
  },
  countBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 11.5,
    color: Colors.matcha,
  },
  emptyText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.inkSoft,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.ink,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radii.lg,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.surface,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
