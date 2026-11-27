import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddOrEditOfficeModal } from '../../components/admin/AddOrEditOfficeModal';
import { AddOrEditServiceModal } from '../../components/admin/AddOrEditServiceModal';
import { ResetOfficeQueueSequenceModal } from '../../components/admin/ResetOfficeQueueSequenceModal';
import { useAdmin } from '../../context/AdminContext';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminOfficeRecord, AdminServiceItem } from '../../types/admin';

/**
 * Screen 4.2: Campus Offices & Service Catalog Management (/admin/offices)
 */
export default function AdminOfficesScreen() {
  const { focusOfficeId } = useLocalSearchParams<{ focusOfficeId?: string }>();
  const {
    offices,
    toggleOfficeStatus,
    toggleServiceStatus,
    saveOffice,
    saveService,
    resetOfficeSequence,
  } = useAdmin();
  const { triggerHaptic } = useQueue();

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => ({
    registrar: true,
  }));
  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [editingOffice, setEditingOffice] = useState<AdminOfficeRecord | null>(null);

  const [serviceModalOffice, setServiceModalOffice] = useState<AdminOfficeRecord | null>(null);
  const [editingService, setEditingService] = useState<AdminServiceItem | null>(null);

  const [resetTargetOffice, setResetTargetOffice] = useState<AdminOfficeRecord | null>(null);


  const toggleExpand = (id: string) => {
    triggerHaptic('light');
    setExpandedIds((prev) => ({ ...prev, [id]: !(prev[id] ?? focusOfficeId === id) }));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>Offices & Services</Text>
          <Text style={styles.headerSub}>
            Configure queues, prefixes, and service catalogs
          </Text>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic('light');
            setEditingOffice(null);
            setShowOfficeModal(true);
          }}
          style={({ pressed }) => [styles.addOfficeBtn, pressed && styles.pressed]}
        >
          <Feather name="plus" size={15} color={Colors.surface} />
          <Text style={styles.addOfficeBtnText}>Add Office</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {offices.length === 0 ? (
          <View style={[styles.emptyCard, Shadows.card]}>
            <Feather name="layers" size={26} color={Colors.inkMuted} />
            <Text style={styles.emptyTitle}>No campus offices configured.</Text>
            <Text style={styles.emptySub}>
              Tap &apos;+ Add Campus Office&apos; to create one.
            </Text>
          </View>
        ) : (
          offices.map((office) => {
            const isExpanded = (expandedIds[office.id] ?? focusOfficeId === office.id);
            const isOpen = office.status === 'open';
            const lastIssuedLabel = `${office.prefix}-${String(office.lastIssuedNumber).padStart(3, '0')}`;

            return (
              <View key={office.id} style={[styles.officeCard, Shadows.card]}>
                {/* Top Accordion Header */}
                <Pressable onPress={() => toggleExpand(office.id)} style={styles.officeHeader}>
                  <View style={[styles.prefixBadge, { backgroundColor: office.themeColor }]}>
                    <Text style={styles.prefixBadgeText}>{office.prefix}</Text>
                  </View>

                  <View style={styles.flex}>
                    <View style={styles.officeTitleRow}>
                      <Text style={styles.officeName} numberOfLines={1}>
                        {office.name}
                      </Text>
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: isOpen ? Colors.matchaSoftBg : Colors.surfaceMuted },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: isOpen ? Colors.successText : Colors.inkNeutral },
                          ]}
                        >
                          {isOpen ? 'OPEN' : 'CLOSED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.officeMeta}>
                      {office.operatingHours} • Last Issued:{' '}
                      <Text style={styles.monoStrong}>{lastIssuedLabel}</Text>
                    </Text>
                  </View>

                  <Switch
                    value={isOpen}
                    onValueChange={() => toggleOfficeStatus(office.id)}
                    trackColor={{ false: Colors.border, true: Colors.ink }}
                    thumbColor={isOpen ? Colors.matcha : Colors.surface}
                  />
                </Pressable>

                {/* Office Action Toolbar */}
                <View style={styles.toolbarRow}>
                  <Pressable
                    onPress={() => {
                      triggerHaptic('light');
                      setEditingOffice(office);
                      setShowOfficeModal(true);
                    }}
                    style={({ pressed }) => [styles.toolChip, pressed && styles.pressed]}
                  >
                    <Feather name="edit-2" size={12} color={Colors.ink} />
                    <Text style={styles.toolChipText}>Edit Office</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      triggerHaptic('light');
                      setResetTargetOffice(office);
                    }}
                    style={({ pressed }) => [styles.toolChip, pressed && styles.pressed]}
                  >
                    <Feather name="rotate-ccw" size={12} color={Colors.warningDark} />
                    <Text style={[styles.toolChipText, { color: Colors.warningDark }]}>
                      Reset Sequence
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => toggleExpand(office.id)}
                    style={({ pressed }) => [styles.expandToggle, pressed && styles.pressed]}
                  >
                    <Text style={styles.expandText}>
                      {office.services.length} Services
                    </Text>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={Colors.inkSoft}
                    />
                  </Pressable>
                </View>

                {/* Expandable Services List */}
                {isExpanded ? (
                  <View style={styles.servicesSection}>
                    <View style={styles.servicesHeader}>
                      <Text style={styles.servicesLabel}>SERVICE CATALOG</Text>
                      <Pressable
                        onPress={() => {
                          triggerHaptic('light');
                          setServiceModalOffice(office);
                          setEditingService(null);
                        }}
                        style={({ pressed }) => [styles.addServiceBtn, pressed && styles.pressed]}
                      >
                        <Feather name="plus" size={12} color={Colors.ink} />
                        <Text style={styles.addServiceBtnText}>Add Service</Text>
                      </Pressable>
                    </View>

                    {office.services.length === 0 ? (
                      <Text style={styles.noServicesText}>
                        No services added yet. Tap + Add Service to configure.
                      </Text>
                    ) : (
                      office.services.map((srv) => (
                        <View key={srv.id} style={styles.serviceRow}>
                          <Pressable
                            onPress={() => {
                              setServiceModalOffice(office);
                              setEditingService(srv);
                            }}
                            style={styles.flex}
                          >
                            <Text style={styles.serviceName}>{srv.name}</Text>
                            <Text style={styles.serviceMeta}>
                              ~{srv.estimatedDurationMinutes} mins
                              {srv.requiredDocumentsNote ? ` • ${srv.requiredDocumentsNote}` : ''}
                            </Text>
                          </Pressable>

                          <Switch
                            value={srv.isActive}
                            onValueChange={() => toggleServiceStatus(office.id, srv.id)}
                            trackColor={{ false: Colors.border, true: Colors.registrar }}
                            thumbColor={Colors.surface}
                          />
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal 4.2A: AddOrEditOfficeModal */}
      <AddOrEditOfficeModal
        visible={showOfficeModal}
        editingOffice={editingOffice}
        onClose={() => setShowOfficeModal(false)}
        onSave={saveOffice}
      />

      {/* Modal 4.2B: AddOrEditServiceModal */}
      <AddOrEditServiceModal
        visible={Boolean(serviceModalOffice)}
        parentOfficeName={serviceModalOffice?.name ?? ''}
        editingService={editingService}
        onClose={() => {
          setServiceModalOffice(null);
          setEditingService(null);
        }}
        onSave={(input) =>
          serviceModalOffice
            ? saveService(serviceModalOffice.id, input)
            : { ok: false, error: 'Office not selected.' }
        }
      />

      {/* Modal 4.2C: ResetOfficeQueueSequenceModal */}
      <ResetOfficeQueueSequenceModal
        office={resetTargetOffice}
        onClose={() => setResetTargetOffice(null)}
        onConfirmReset={resetOfficeSequence}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 22,
    color: Colors.ink,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  addOfficeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.ink,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addOfficeBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.surface,
  },
  pressed: { opacity: 0.84 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 112,
    gap: 14,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 15,
    color: Colors.ink,
  },
  emptySub: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  officeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.officeCard,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 15,
    gap: 12,
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  prefixBadge: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: Colors.surface,
  },
  officeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  officeName: {
    fontFamily: Fonts.displayBold,
    fontSize: 15,
    color: Colors.ink,
    flexShrink: 1,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  statusPillText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9.5,
  },
  officeMeta: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  monoStrong: {
    fontFamily: Fonts.monoBold,
    color: Colors.ink,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  toolChipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.ink,
  },
  expandToggle: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  expandText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  servicesSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 12,
    gap: 10,
  },
  servicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  servicesLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.7,
    color: Colors.inkMuted,
  },
  addServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
  },
  addServiceBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    color: Colors.ink,
  },
  noServicesText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.inkSoft,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  serviceName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.ink,
  },
  serviceMeta: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
});
