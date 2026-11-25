import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQueue } from '../../context/QueueContext';
import { useStaffQueue } from '../../context/StaffQueueContext';
import { Colors, Fonts, Radii } from '../../theme/tokens';
import { DeskStatus, StaffQueueTicket } from '../../types/staff';

export default function StaffQueueDesk() {
  const router = useRouter();
  const { showToast, triggerHaptic, bumpLoginReset } = useQueue();
  const {
    activeStaff,
    deskConfig,
    counterWindow,
    deskStatus,
    servingTicket,
    waitingQueue,
    elapsedSeconds,
    recallCount,
    setCounterWindow,
    setDeskStatus,
    callNext,
    completeCurrent,
    sendRecall,
    skipCurrent,
  } = useStaffQueue();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('All Services');
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [inspectedTicket, setInspectedTicket] = useState<StaffQueueTicket | null>(null);
  const [staffRemarks, setStaffRemarks] = useState('');
  const [skipReason, setSkipReason] = useState('Student did not appear after recall');

  const formatTimer = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const filteredQueue = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return waitingQueue.filter((ticket) => {
      const matchesService =
        selectedService === 'All Services' || ticket.serviceType === selectedService;
      const matchesQuery =
        !query ||
        ticket.ticketNumber.toLowerCase().includes(query) ||
        ticket.usn.includes(query) ||
        ticket.studentName.toLowerCase().includes(query);
      return matchesService && matchesQuery;
    });
  }, [waitingQueue, selectedService, searchQuery]);

  const handleCallNext = () => {
    const nextTicket = callNext();
    if (!nextTicket) return;
    triggerHaptic('success');
    showToast(`Now serving ${nextTicket.ticketNumber}`, 'matcha');
  };

  const handleCompleteCurrent = (advance: boolean) => {
    const { completedNumber, nextTicket } = completeCurrent(advance, staffRemarks);
    setShowCompleteModal(false);
    setStaffRemarks('');
    triggerHaptic('success');

    if (nextTicket) {
      showToast(`${completedNumber} completed. Now serving ${nextTicket.ticketNumber}.`, 'matcha');
    } else {
      showToast(`${completedNumber} completed.`, 'dark');
    }
  };

  const handleSendRecall = () => {
    sendRecall();
    setShowRecallModal(false);
    triggerHaptic('light');
    showToast(`Recall alert sent to ${servingTicket?.ticketNumber}.`, 'dark');
  };

  const handleSkipCurrent = () => {
    const { skippedNumber, nextTicket } = skipCurrent(skipReason);
    setShowSkipModal(false);
    triggerHaptic('warning');

    if (nextTicket) {
      showToast(
        `Ticket ${skippedNumber} skipped. Now serving ${nextTicket.ticketNumber}.`,
        'warning'
      );
    } else {
      showToast(`Ticket ${skippedNumber} marked as skipped.`, 'warning');
    }
  };

  const handleSignOut = () => {
    bumpLoginReset();
    triggerHaptic('light');
    showToast('Signed out of Staff Console', 'dark');
    router.replace('/auth/login');
  };

  const statusConfig = {
    online: { label: 'Online', dot: '#22C55E', bg: Colors.matchaSoftBg, text: '#166534' },
    break: { label: 'On Break', dot: Colors.warningDark, bg: Colors.warningSoftBg, text: '#92400E' },
    closed: { label: 'Closed', dot: '#EF4444', bg: '#FEE2E2', text: '#991B1B' },
  }[deskStatus];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.topHeader}>
        <View style={styles.idRow}>
          <View style={styles.idLeft}>
            <View style={styles.empBadge}>
              <Text style={styles.empBadgeText}>ID: {activeStaff.staffId}</Text>
            </View>
            <Text style={styles.campusLabel} numberOfLines={1}>
              {activeStaff.office}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleSignOut}
            accessibilityLabel="Sign Out"
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={16} color={Colors.inkSoft} />
          </TouchableOpacity>
        </View>

        <View style={styles.greetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.staffGreeting} numberOfLines={1}>
              {activeStaff.staffName}
            </Text>
            <Text style={styles.subRoleText}>Staff Counter Console</Text>
          </View>

          <View style={styles.headerControls}>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => {
                triggerHaptic('light');
                router.push('/staff/scanner');
              }}
              accessibilityLabel="Open QR Scanner"
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={18} color={Colors.surface} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}
              onPress={() => setShowCounterModal(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
              <Text
                style={[styles.statusPillText, { color: statusConfig.text }]}
                numberOfLines={1}
              >
                {counterWindow} • {statusConfig.label}
              </Text>
              <Ionicons name="chevron-down" size={14} color={statusConfig.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.nowServingCard}>
          <View style={[styles.ticketNotch, styles.notchLeft]} />
          <View style={[styles.ticketNotch, styles.notchRight]} />

          <View style={styles.cardTopRow}>
            <View style={styles.officeChip}>
              <Text style={styles.officeChipText}>NOW SERVING</Text>
            </View>
            <Text style={styles.windowText}>{counterWindow}</Text>
          </View>

          {servingTicket ? (
            <>
              <View style={styles.ticketMainRow}>
                <View>
                  <Text style={styles.microLabel}>QUEUE NUMBER</Text>
                  <Text style={styles.heroTicketNumber}>{servingTicket.ticketNumber}</Text>
                </View>
                <View style={styles.timerContainer}>
                  <Text style={styles.microLabel}>ELAPSED TIME</Text>
                  <Text style={styles.timerValue}>{formatTimer(elapsedSeconds)}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.verificationBanner,
                  servingTicket.isQrVerified ? styles.verifiedBg : styles.unverifiedBg,
                ]}
              >
                <Ionicons
                  name={servingTicket.isQrVerified ? 'shield-checkmark' : 'qr-code-outline'}
                  size={16}
                  color={servingTicket.isQrVerified ? '#166534' : '#92400E'}
                />
                <Text
                  style={[
                    styles.verificationText,
                    { color: servingTicket.isQrVerified ? '#166534' : '#92400E' },
                  ]}
                >
                  {servingTicket.isQrVerified ? 'QR identity verified' : 'QR not verified'}
                </Text>
                {recallCount > 0 && (
                  <View style={styles.recallBadge}>
                    <Text style={styles.recallBadgeText}>Recall {recallCount}/3</Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.studentInfoRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {servingTicket.studentName
                      .split(' ')
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{servingTicket.studentName}</Text>
                  <Text style={styles.studentMeta}>
                    {servingTicket.usn} • {servingTicket.program}
                  </Text>
                  <Text style={styles.serviceName}>{servingTicket.serviceType}</Text>
                </View>
              </View>

              {servingTicket.notes ? (
                <View style={styles.notesBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#CBD5E1" />
                  <Text style={styles.notesText}>{servingTicket.notes}</Text>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.recallButton}
                  onPress={() => setShowRecallModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="volume-high-outline" size={18} color={Colors.ink} />
                  <Text style={styles.recallButtonText}>Recall</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => setShowCompleteModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={18} color={Colors.ink} />
                  <Text style={styles.completeButtonText}>Complete</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => setShowSkipModal(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="close-circle-outline" size={17} color="#FCA5A5" />
                <Text style={styles.skipButtonText}>Skip ticket</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyServing}>
              <Ionicons name="checkmark-done-circle-outline" size={42} color={Colors.matcha} />
              <Text style={styles.emptyServingTitle}>Queue is clear</Text>
              <Text style={styles.emptyServingText}>Call the next waiting student.</Text>
              <TouchableOpacity
                style={styles.callNextButton}
                onPress={handleCallNext}
                activeOpacity={0.85}
              >
                <Text style={styles.callNextText}>Call next</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.ink} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.queueSection}>
          <View style={styles.queueHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>LIVE QUEUE</Text>
              <Text style={styles.sectionTitle}>{waitingQueue.length} waiting</Text>
            </View>
            {servingTicket && waitingQueue.length > 0 ? (
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleCallNext}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-forward" size={16} color={Colors.ink} />
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Colors.inkSoft} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search ticket, name, or USN"
              placeholderTextColor={Colors.inkTabInactive}
              style={styles.searchInput}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serviceFilterRow}
          >
            {deskConfig.services.map((service) => {
              const active = selectedService === service;
              return (
                <TouchableOpacity
                  key={service}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setSelectedService(service)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {service}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {filteredQueue.map((ticket, index) => (
            <TouchableOpacity
              key={ticket.id}
              style={styles.queueCard}
              onPress={() => setInspectedTicket(ticket)}
              activeOpacity={0.85}
            >
              <View style={styles.queuePosition}>
                <Text style={styles.queuePositionText}>{index + 1}</Text>
              </View>
              <View style={styles.queueCardInfo}>
                <View style={styles.queueCardTop}>
                  <Text style={styles.queueTicketNumber}>{ticket.ticketNumber}</Text>
                  <Text style={styles.waitTime}>{ticket.waitMinutes} mins</Text>
                </View>
                <Text style={styles.queueStudentName}>{ticket.studentName}</Text>
                <View style={styles.serviceChip}>
                  <Text style={styles.serviceChipText}>{ticket.serviceType}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.inkTabInactive} />
            </TouchableOpacity>
          ))}

          {filteredQueue.length === 0 && (
            <View style={styles.emptyQueue}>
              <Ionicons name="file-tray-outline" size={30} color="#A3A3A3" />
              <Text style={styles.emptyQueueText}>No tickets match this filter</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showCounterModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowCounterModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Counter settings</Text>
            <Text style={styles.modalLabel}>Window</Text>
            {['Window 1', 'Window 2', 'Window 3'].map((window) => (
              <TouchableOpacity
                key={window}
                style={[styles.optionRow, counterWindow === window && styles.optionRowActive]}
                onPress={() => setCounterWindow(window)}
              >
                <Text style={styles.optionText}>{window}</Text>
                {counterWindow === window && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.successText} />
                )}
              </TouchableOpacity>
            ))}
            <Text style={styles.modalLabel}>Desk status</Text>
            {(['online', 'break', 'closed'] as DeskStatus[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.optionRow, deskStatus === status && styles.optionRowActive]}
                onPress={() => setDeskStatus(status)}
              >
                <Text style={styles.optionText}>{status[0].toUpperCase() + status.slice(1)}</Text>
                {deskStatus === status && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.successText} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => setShowCounterModal(false)}
            >
              <Text style={styles.modalPrimaryText}>Save settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCompleteModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconSuccess}>
              <Ionicons name="checkmark" size={26} color={Colors.ink} />
            </View>
            <Text style={styles.modalTitle}>Complete ticket?</Text>
            <Text style={styles.modalBody}>
              Mark {servingTicket?.ticketNumber} as completed and record optional remarks.
            </Text>
            <TextInput
              value={staffRemarks}
              onChangeText={setStaffRemarks}
              placeholder="Staff remarks (optional)"
              placeholderTextColor={Colors.inkTabInactive}
              style={styles.modalInput}
              multiline
            />
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => handleCompleteCurrent(true)}
            >
              <Text style={styles.modalPrimaryText}>Complete and call next</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => handleCompleteCurrent(false)}
            >
              <Text style={styles.modalSecondaryText}>Complete without calling next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRecallModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowRecallModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="volume-high" size={34} color={Colors.registrar} />
            <Text style={styles.modalTitle}>Send recall alert?</Text>
            <Text style={styles.modalBody}>
              Notify the student that {servingTicket?.ticketNumber} is now being served.
            </Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={handleSendRecall}>
              <Text style={styles.modalPrimaryText}>Send recall</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => setShowRecallModal(false)}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowSkipModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="close-circle" size={34} color={Colors.danger} />
            <Text style={styles.modalTitle}>Skip this ticket?</Text>
            <Text style={styles.modalBody}>
              Choose a reason for skipping {servingTicket?.ticketNumber}.
            </Text>
            <TextInput
              value={skipReason}
              onChangeText={setSkipReason}
              style={styles.modalInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.modalPrimary, styles.dangerPrimary]}
              onPress={handleSkipCurrent}
            >
              <Text style={styles.dangerPrimaryText}>Confirm skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={() => setShowSkipModal(false)}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!inspectedTicket}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setInspectedTicket(null)}
      >
        <View style={styles.modalBackdrop}>
          {inspectedTicket && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{inspectedTicket.ticketNumber}</Text>
              <Text style={styles.modalBody}>{inspectedTicket.studentName}</Text>
              <Text style={styles.detailText}>USN: {inspectedTicket.usn}</Text>
              <Text style={styles.detailText}>Program: {inspectedTicket.program}</Text>
              <Text style={styles.detailText}>Service: {inspectedTicket.serviceType}</Text>
              <Text style={styles.detailText}>Wait time: {inspectedTicket.waitMinutes} minutes</Text>
              {inspectedTicket.notes ? (
                <Text style={styles.detailText}>Notes: {inspectedTicket.notes}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => setInspectedTicket(null)}
              >
                <Text style={styles.modalPrimaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 14,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  idLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  empBadge: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  empBadgeText: {
    color: Colors.ink,
    fontFamily: Fonts.monoBold,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  campusLabel: {
    marginLeft: 8,
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    flexShrink: 1,
  },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  greetingCopy: {
    flex: 1,
    minWidth: 0,
  },
  staffGreeting: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  subRoleText: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12.5,
    marginTop: 2,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    maxWidth: 164,
    height: 40,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    flexShrink: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
  },
  scanButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 116,
  },
  nowServingCard: {
    position: 'relative',
    backgroundColor: Colors.ink,
    borderRadius: Radii.card,
    padding: 20,
    overflow: 'visible',
  },
  ticketNotch: {
    position: 'absolute',
    bottom: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.canvas,
  },
  notchLeft: {
    left: -9,
  },
  notchRight: {
    right: -9,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  officeChip: {
    backgroundColor: Colors.registrar,
    borderRadius: Radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  officeChipText: {
    color: Colors.surface,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  windowText: {
    color: Colors.inkTabInactive,
    fontFamily: Fonts.monoSemiBold,
    fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  ticketMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
  },
  microLabel: {
    color: Colors.inkMuted,
    fontFamily: Fonts.monoSemiBold,
    fontSize: 10.5,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  heroTicketNumber: {
    color: Colors.surface,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.3,
  },
  timerContainer: {
    alignItems: 'flex-end',
  },
  timerValue: {
    color: Colors.matcha,
    fontFamily: Fonts.monoBold,
    fontSize: 27,
    fontVariant: ['tabular-nums'],
  },
  verificationBanner: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedBg: {
    backgroundColor: Colors.matchaSoftBg,
  },
  unverifiedBg: {
    backgroundColor: Colors.warningSoftBg,
  },
  verificationText: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
  },
  recallBadge: {
    backgroundColor: Colors.ink,
    borderRadius: Radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  recallBadgeText: {
    color: Colors.matcha,
    fontFamily: Fonts.monoBold,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: Colors.darkDivider,
    marginVertical: 18,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.darkNode,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.matcha,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 15,
  },
  studentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    color: Colors.surface,
    fontFamily: Fonts.displayBold,
    fontSize: 17,
  },
  studentMeta: {
    color: Colors.inkTabInactive,
    fontFamily: Fonts.bodyRegular,
    marginTop: 3,
    fontSize: 12,
  },
  serviceName: {
    color: Colors.surface,
    fontFamily: Fonts.bodyBold,
    marginTop: 6,
    fontSize: 13,
  },
  notesBox: {
    marginTop: 14,
    borderRadius: Radii.md,
    backgroundColor: Colors.darkRecessed,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  notesText: {
    flex: 1,
    color: '#D4D4D8',
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  recallButton: {
    flex: 1,
    height: 46,
    borderRadius: Radii.pill,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  recallButtonText: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 13.5,
  },
  completeButton: {
    flex: 1.35,
    height: 46,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  completeButtonText: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 13.5,
  },
  skipButton: {
    height: 38,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  skipButtonText: {
    color: Colors.dangerOutlineStrong,
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
  },
  emptyServing: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyServingTitle: {
    color: Colors.surface,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 22,
    marginTop: 10,
  },
  emptyServingText: {
    color: Colors.inkTabInactive,
    fontFamily: Fonts.bodyRegular,
    marginTop: 5,
  },
  callNextButton: {
    height: 46,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
    marginTop: 18,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callNextText: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
  },
  queueSection: {
    marginTop: 22,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionEyebrow: {
    color: Colors.inkSoft,
    fontFamily: Fonts.monoSemiBold,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  nextButton: {
    height: 38,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
  },
  nextButtonText: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 13,
  },
  searchBox: {
    height: 48,
    marginTop: 14,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: Colors.ink,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
  serviceFilterRow: {
    gap: 8,
    paddingVertical: 12,
  },
  filterChip: {
    height: 36,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  filterChipText: {
    color: Colors.ink,
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
  },
  filterChipTextActive: {
    color: Colors.surface,
  },
  queueCard: {
    minHeight: 104,
    marginBottom: 10,
    borderRadius: Radii.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  queuePosition: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuePositionText: {
    color: Colors.inkSoft,
    fontFamily: Fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  queueCardInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  queueCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueTicketNumber: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  waitTime: {
    color: Colors.inkSoft,
    fontFamily: Fonts.monoMedium,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
  },
  queueStudentName: {
    color: Colors.ink,
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    marginTop: 2,
  },
  serviceChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: Radii.pill,
    backgroundColor: Colors.registrarPillBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serviceChipText: {
    color: Colors.registrar,
    fontFamily: Fonts.bodyBold,
    fontSize: 11,
  },
  emptyQueue: {
    height: 120,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyQueueText: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyMedium,
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: Radii.modal,
    backgroundColor: Colors.surface,
    padding: 20,
  },
  modalIconSuccess: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  modalBody: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyRegular,
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 19,
  },
  modalLabel: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyBold,
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
  },
  optionRow: {
    height: 44,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowActive: {
    backgroundColor: Colors.matchaSoftBg,
    borderColor: Colors.successText,
  },
  optionText: {
    color: Colors.ink,
    fontFamily: Fonts.bodyBold,
  },
  modalInput: {
    minHeight: 52,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    color: Colors.ink,
    fontFamily: Fonts.bodyMedium,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalPrimary: {
    height: 48,
    marginTop: 14,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerPrimary: {
    backgroundColor: Colors.danger,
  },
  modalPrimaryText: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 14,
  },
  dangerPrimaryText: {
    color: Colors.surface,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 14,
  },
  modalSecondary: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyBold,
  },
  detailText: {
    color: Colors.ink,
    fontFamily: Fonts.bodyMedium,
    marginTop: 6,
  },
});
