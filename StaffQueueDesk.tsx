import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { CQTheme } from '../../../../theme/campusQueueTheme';
import sampleData from './sampleData.json';

type DeskStatus = 'online' | 'break' | 'closed';

interface QueueTicket {
  id: string;
  ticketNumber: string;
  studentName: string;
  usn: string;
  program: string;
  serviceType: string;
  waitMinutes: number;
  issuedAt: string;
  notes?: string;
  isQrVerified: boolean;
}

const DESK_DATA = sampleData.desk;
const INITIAL_SERVING: QueueTicket = DESK_DATA.initialServing as QueueTicket;
const INITIAL_WAITING: QueueTicket[] = DESK_DATA.initialWaiting as QueueTicket[];
const SERVICES: string[] = DESK_DATA.services;

export default function StaffQueueDesk() {
  const router = useRouter();
  const [counterWindow, setCounterWindow] = useState(DESK_DATA.initialCounterWindow);
  const [deskStatus, setDeskStatus] = useState<DeskStatus>('online');
  const [servingTicket, setServingTicket] = useState<QueueTicket | null>(INITIAL_SERVING);
  const [waitingQueue, setWaitingQueue] = useState(INITIAL_WAITING);
  const [elapsedSeconds, setElapsedSeconds] = useState(DESK_DATA.initialElapsedSeconds);
  const [recallCount, setRecallCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('All Services');
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [inspectedTicket, setInspectedTicket] = useState<QueueTicket | null>(null);
  const [staffRemarks, setStaffRemarks] = useState('');
  const [skipReason, setSkipReason] = useState('Student did not appear after recall');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!servingTicket || deskStatus !== 'online') return;
    const interval = setInterval(
      () => setElapsedSeconds((seconds: number) => seconds + 1),
      1000
    );
    return () => clearInterval(interval);
  }, [servingTicket, deskStatus]);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  const formatTimer = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const showToast = (message: string) => setToastMessage(message);

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

  const callNext = () => {
    if (waitingQueue.length === 0) return;
    const [nextTicket, ...rest] = waitingQueue;
    setServingTicket(nextTicket);
    setWaitingQueue(rest);
    setElapsedSeconds(0);
    setRecallCount(0);
    showToast(`Now serving ${nextTicket.ticketNumber}`);
  };

  const completeCurrent = (advance: boolean) => {
    const completedNumber = servingTicket?.ticketNumber;
    setShowCompleteModal(false);
    setStaffRemarks('');
    setRecallCount(0);

    if (advance && waitingQueue.length > 0) {
      const [nextTicket, ...rest] = waitingQueue;
      setServingTicket(nextTicket);
      setWaitingQueue(rest);
      setElapsedSeconds(0);
      showToast(`${completedNumber} completed. Now serving ${nextTicket.ticketNumber}.`);
    } else {
      setServingTicket(null);
      setElapsedSeconds(0);
      showToast(`${completedNumber} completed.`);
    }
  };

  const sendRecall = () => {
    setRecallCount((count) => Math.min(count + 1, 3));
    setShowRecallModal(false);
    showToast(`Recall alert sent to ${servingTicket?.ticketNumber}.`);
  };

  const skipCurrent = () => {
    const skippedNumber = servingTicket?.ticketNumber;
    setShowSkipModal(false);
    setRecallCount(0);

    if (waitingQueue.length > 0) {
      const [nextTicket, ...rest] = waitingQueue;
      setServingTicket(nextTicket);
      setWaitingQueue(rest);
      setElapsedSeconds(0);
      showToast(`Ticket ${skippedNumber} skipped. Now serving ${nextTicket.ticketNumber}.`);
    } else {
      setServingTicket(null);
      setElapsedSeconds(0);
      showToast(`Ticket ${skippedNumber} marked as skipped.`);
    }
  };

  const statusConfig = {
    online: { label: 'Online', dot: '#22C55E', bg: CQTheme.colors.emeraldSoft, text: '#166534' },
    break: { label: 'On Break', dot: CQTheme.colors.amberBadge, bg: CQTheme.colors.amberSoft, text: '#92400E' },
    closed: { label: 'Closed', dot: '#EF4444', bg: '#FEE2E2', text: '#991B1B' },
  }[deskStatus];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {toastMessage && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={18} color={CQTheme.colors.limeAccent} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <View style={styles.topHeader}>
        <View style={styles.idRow}>
          <View style={styles.empBadge}>
            <Text style={styles.empBadgeText}>ID: {DESK_DATA.staffId}</Text>
          </View>
          <Text style={styles.campusLabel}>{DESK_DATA.office}</Text>
        </View>

        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.staffGreeting}>{DESK_DATA.staffName}</Text>
            <Text style={styles.subRoleText}>Staff Counter Console</Text>
          </View>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push('/screens/staff/scanner')}
            activeOpacity={0.8}
          >
            <Ionicons name="qr-code-outline" size={18} color={CQTheme.colors.textInverse} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusPill, { backgroundColor: statusConfig.bg }]}
            onPress={() => setShowCounterModal(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.statusDot, { backgroundColor: statusConfig.dot }]} />
            <Text style={[styles.statusPillText, { color: statusConfig.text }]}>
              {counterWindow} • {statusConfig.label}
            </Text>
            <Ionicons name="chevron-down" size={14} color={statusConfig.text} />
          </TouchableOpacity>
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
                  <Ionicons name="volume-high-outline" size={18} color={CQTheme.colors.darkCard} />
                  <Text style={styles.recallButtonText}>Recall</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => setShowCompleteModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={18} color={CQTheme.colors.limeText} />
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
              <Ionicons name="checkmark-done-circle-outline" size={42} color={CQTheme.colors.limeAccent} />
              <Text style={styles.emptyServingTitle}>Queue is clear</Text>
              <Text style={styles.emptyServingText}>Call the next waiting student.</Text>
              <TouchableOpacity style={styles.callNextButton} onPress={callNext} activeOpacity={0.85}>
                <Text style={styles.callNextText}>Call next</Text>
                <Ionicons name="arrow-forward" size={18} color={CQTheme.colors.limeText} />
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
              <TouchableOpacity style={styles.nextButton} onPress={callNext} activeOpacity={0.85}>
                <Ionicons name="arrow-forward" size={16} color={CQTheme.colors.limeText} />
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={CQTheme.colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search ticket, name, or USN"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serviceFilterRow}
          >
            {SERVICES.map((service) => {
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
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
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

      <Modal visible={showCounterModal} transparent animationType="fade" onRequestClose={() => setShowCounterModal(false)}>
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
                {counterWindow === window && <Ionicons name="checkmark-circle" size={20} color={CQTheme.colors.emeraldBadge} />}
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
                {deskStatus === status && <Ionicons name="checkmark-circle" size={20} color={CQTheme.colors.emeraldBadge} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalPrimary} onPress={() => setShowCounterModal(false)}>
              <Text style={styles.modalPrimaryText}>Save settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCompleteModal} transparent animationType="fade" onRequestClose={() => setShowCompleteModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconSuccess}>
              <Ionicons name="checkmark" size={26} color={CQTheme.colors.limeText} />
            </View>
            <Text style={styles.modalTitle}>Complete ticket?</Text>
            <Text style={styles.modalBody}>
              Mark {servingTicket?.ticketNumber} as completed and record optional remarks.
            </Text>
            <TextInput
              value={staffRemarks}
              onChangeText={setStaffRemarks}
              placeholder="Staff remarks (optional)"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
              multiline
            />
            <TouchableOpacity style={styles.modalPrimary} onPress={() => completeCurrent(true)}>
              <Text style={styles.modalPrimaryText}>Complete and call next</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondary} onPress={() => completeCurrent(false)}>
              <Text style={styles.modalSecondaryText}>Complete without calling next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRecallModal} transparent animationType="fade" onRequestClose={() => setShowRecallModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="volume-high" size={34} color={CQTheme.colors.tealBadge} />
            <Text style={styles.modalTitle}>Send recall alert?</Text>
            <Text style={styles.modalBody}>Notify the student that {servingTicket?.ticketNumber} is now being served.</Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={sendRecall}>
              <Text style={styles.modalPrimaryText}>Send recall</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowRecallModal(false)}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSkipModal} transparent animationType="fade" onRequestClose={() => setShowSkipModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="close-circle" size={34} color="#DC2626" />
            <Text style={styles.modalTitle}>Skip this ticket?</Text>
            <Text style={styles.modalBody}>Choose a reason for skipping {servingTicket?.ticketNumber}.</Text>
            <TextInput
              value={skipReason}
              onChangeText={setSkipReason}
              style={styles.modalInput}
              multiline
            />
            <TouchableOpacity style={[styles.modalPrimary, styles.dangerPrimary]} onPress={skipCurrent}>
              <Text style={styles.modalPrimaryText}>Confirm skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSecondary} onPress={() => setShowSkipModal(false)}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!inspectedTicket} transparent animationType="fade" onRequestClose={() => setInspectedTicket(null)}>
        <View style={styles.modalBackdrop}>
          {inspectedTicket && (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{inspectedTicket.ticketNumber}</Text>
              <Text style={styles.modalBody}>{inspectedTicket.studentName}</Text>
              <Text style={styles.detailText}>USN: {inspectedTicket.usn}</Text>
              <Text style={styles.detailText}>Program: {inspectedTicket.program}</Text>
              <Text style={styles.detailText}>Service: {inspectedTicket.serviceType}</Text>
              <Text style={styles.detailText}>Wait time: {inspectedTicket.waitMinutes} minutes</Text>
              {inspectedTicket.notes ? <Text style={styles.detailText}>Notes: {inspectedTicket.notes}</Text> : null}
              <TouchableOpacity style={styles.modalPrimary} onPress={() => setInspectedTicket(null)}>
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
    backgroundColor: CQTheme.colors.canvas,
  },
  toastBanner: {
    position: 'absolute',
    zIndex: 20,
    top: Platform.OS === 'ios' ? 54 : 32,
    left: 20,
    right: 20,
    minHeight: 48,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.darkCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  toastText: {
    flex: 1,
    color: CQTheme.colors.textInverse,
    fontWeight: '700',
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 14,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  empBadge: {
    backgroundColor: CQTheme.colors.surfaceMuted,
    borderRadius: CQTheme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  empBadgeText: {
    color: CQTheme.colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '800',
  },
  campusLabel: {
    marginLeft: 8,
    color: CQTheme.colors.textSecondary,
    fontSize: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffGreeting: {
    color: CQTheme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
  },
  subRoleText: {
    color: CQTheme.colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    maxWidth: 178,
    height: 42,
    borderRadius: CQTheme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  scanButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CQTheme.colors.darkCard,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 112,
  },
  nowServingCard: {
    position: 'relative',
    backgroundColor: CQTheme.colors.darkCard,
    borderRadius: CQTheme.radii.card,
    padding: 20,
    overflow: 'visible',
  },
  ticketNotch: {
    position: 'absolute',
    bottom: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: CQTheme.colors.canvas,
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
    backgroundColor: CQTheme.colors.tealBadge,
    borderRadius: CQTheme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  officeChipText: {
    color: CQTheme.colors.textInverse,
    fontSize: 12,
    fontWeight: '900',
  },
  windowText: {
    color: '#A1A1AA',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
  },
  ticketMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 22,
  },
  microLabel: {
    color: '#A1A1AA',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    marginBottom: 6,
  },
  heroTicketNumber: {
    color: CQTheme.colors.textInverse,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '900',
  },
  timerContainer: {
    alignItems: 'flex-end',
  },
  timerValue: {
    color: CQTheme.colors.limeAccent,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 28,
    fontWeight: '900',
  },
  verificationBanner: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedBg: {
    backgroundColor: CQTheme.colors.emeraldSoft,
  },
  unverifiedBg: {
    backgroundColor: CQTheme.colors.amberSoft,
  },
  verificationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  recallBadge: {
    backgroundColor: CQTheme.colors.darkCard,
    borderRadius: CQTheme.radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  recallBadgeText: {
    color: CQTheme.colors.limeAccent,
    fontSize: 11,
    fontWeight: '900',
  },
  divider: {
    height: 1,
    backgroundColor: '#383B3E',
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
    backgroundColor: '#303438',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: CQTheme.colors.limeAccent,
    fontWeight: '900',
  },
  studentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    color: CQTheme.colors.textInverse,
    fontSize: 17,
    fontWeight: '900',
  },
  studentMeta: {
    color: '#A1A1AA',
    marginTop: 3,
    fontSize: 12,
  },
  serviceName: {
    color: CQTheme.colors.textInverse,
    marginTop: 7,
    fontSize: 13,
    fontWeight: '700',
  },
  notesBox: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: '#25282B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  notesText: {
    flex: 1,
    color: '#D4D4D8',
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
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  recallButtonText: {
    color: CQTheme.colors.darkCard,
    fontWeight: '900',
  },
  completeButton: {
    flex: 1.35,
    height: 46,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.limeAccent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  completeButtonText: {
    color: CQTheme.colors.limeText,
    fontWeight: '900',
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
    color: '#FCA5A5',
    fontWeight: '800',
  },
  emptyServing: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyServingTitle: {
    color: CQTheme.colors.textInverse,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyServingText: {
    color: '#A1A1AA',
    marginTop: 5,
  },
  callNextButton: {
    height: 46,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.limeAccent,
    marginTop: 18,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callNextText: {
    color: CQTheme.colors.limeText,
    fontWeight: '900',
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
    color: CQTheme.colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
  },
  sectionTitle: {
    color: CQTheme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  nextButton: {
    height: 38,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.limeAccent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
  },
  nextButtonText: {
    color: CQTheme.colors.limeText,
    fontWeight: '900',
  },
  searchBox: {
    height: 48,
    marginTop: 14,
    borderRadius: CQTheme.radii.inner,
    backgroundColor: CQTheme.colors.surface,
    borderWidth: 1,
    borderColor: CQTheme.colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: CQTheme.colors.textPrimary,
  },
  serviceFilterRow: {
    gap: 8,
    paddingVertical: 12,
  },
  filterChip: {
    height: 36,
    borderRadius: CQTheme.radii.pill,
    borderWidth: 1,
    borderColor: CQTheme.colors.borderLight,
    backgroundColor: CQTheme.colors.surface,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: CQTheme.colors.darkCard,
    borderColor: CQTheme.colors.darkCard,
  },
  filterChipText: {
    color: CQTheme.colors.textPrimary,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: CQTheme.colors.textInverse,
  },
  queueCard: {
    minHeight: 108,
    marginBottom: 10,
    borderRadius: CQTheme.radii.card,
    backgroundColor: CQTheme.colors.surface,
    borderWidth: 1,
    borderColor: CQTheme.colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  queuePosition: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CQTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuePositionText: {
    color: CQTheme.colors.textSecondary,
    fontWeight: '900',
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
    color: CQTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  waitTime: {
    color: CQTheme.colors.textSecondary,
    fontSize: 12,
  },
  queueStudentName: {
    color: CQTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  serviceChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.tealSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  serviceChipText: {
    color: CQTheme.colors.tealBadge,
    fontSize: 11,
    fontWeight: '900',
  },
  emptyQueue: {
    height: 120,
    borderRadius: CQTheme.radii.card,
    borderWidth: 1,
    borderColor: CQTheme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyQueueText: {
    color: CQTheme.colors.textSecondary,
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22,24,26,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: CQTheme.radii.card,
    backgroundColor: CQTheme.colors.surface,
    padding: 20,
  },
  modalIconSuccess: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CQTheme.colors.limeAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: CQTheme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  modalBody: {
    color: CQTheme.colors.textSecondary,
    marginTop: 8,
    marginBottom: 14,
  },
  modalLabel: {
    color: CQTheme.colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  optionRow: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CQTheme.colors.borderLight,
    marginBottom: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowActive: {
    backgroundColor: CQTheme.colors.emeraldSoft,
    borderColor: CQTheme.colors.emeraldBadge,
  },
  optionText: {
    color: CQTheme.colors.textPrimary,
    fontWeight: '700',
  },
  modalInput: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CQTheme.colors.borderLight,
    backgroundColor: CQTheme.colors.surfaceMuted,
    color: CQTheme.colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalPrimary: {
    height: 48,
    marginTop: 14,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.limeAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerPrimary: {
    backgroundColor: '#DC2626',
  },
  modalPrimaryText: {
    color: CQTheme.colors.limeText,
    fontWeight: '900',
  },
  modalSecondary: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: CQTheme.colors.textSecondary,
    fontWeight: '800',
  },
  detailText: {
    color: CQTheme.colors.textPrimary,
    marginTop: 6,
  },
});
