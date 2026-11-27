import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQueue } from '../../context/QueueContext';
import { useStaffQueue } from '../../context/StaffQueueContext';
import { Colors, Fonts, Radii } from '../../theme/tokens';
import { VerifiedTicketData } from '../../types/staff';
import { formatDisplayTimestamp } from '../../utils/waitTime';

export default function StaffQRScanner() {
  const router = useRouter();
  const { showToast, triggerHaptic, liveVerify } = useQueue();
  const {
    activeStaff,
    counterWindow,
    servingTicket,
    completeCurrent,
    skipCurrent,
    cancelCurrent,
    refreshDesk,
  } = useStaffQueue();
  const [permission, requestPermission] = useCameraPermissions();

  // Scanner Controls
  const [isScanning, setIsScanning] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<'Completed' | 'No-Show' | 'Cancelled'>(
    'Completed'
  );
  const [outcomeRemarks, setOutcomeRemarks] = useState('');

  // Modals State
  const [verifiedTicket, setVerifiedTicket] = useState<VerifiedTicketData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual Fallback Inputs
  const [manualTicketNum, setManualTicketNum] = useState('');
  const [manualUsnLast4, setManualUsnLast4] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refreshDesk(false, true);
    }, [refreshDesk])
  );

  const officeTitle = activeStaff.officeShort || activeStaff.office || 'Campus Office';
  const expectedTicketCode = servingTicket?.ticketNumber ?? 'None called';
  const expectedUsnSuffix = servingTicket?.usn.slice(-4) ?? '0000';

  // Verify QR payload or manual ticket/USN strictly against live `POST /api/staff`
  const verifyLive = async (data: Parameters<typeof liveVerify>[0]) => {
    setIsVerifying(true);
    try {
      setVerifiedTicket(await liveVerify(data));
      triggerHaptic('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Ticket verification failed.');
      triggerHaptic('warning');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    setIsScanning(false);
    void verifyLive({ qrPayload: data.trim() });
  };

  const handleManualVerify = () => {
    const cleanTicket = manualTicketNum.trim().toUpperCase();
    const cleanUsn = manualUsnLast4.trim();

    if (!cleanTicket || !/^\d{4}$/.test(cleanUsn)) {
      setShowManualModal(false);
      setIsScanning(false);
      triggerHaptic('warning');
      setErrorMessage('Enter a valid ticket number and the 4-digit USN suffix.');
      return;
    }

    setShowManualModal(false);
    setIsScanning(false);
    setManualTicketNum('');
    setManualUsnLast4('');
    void verifyLive({ ticketNumber: cleanTicket, usnSuffix: cleanUsn });
  };

  const resetScanner = () => {
    setErrorMessage(null);
    setVerifiedTicket(null);
    setSelectedOutcome('Completed');
    setOutcomeRemarks('');
    setIsScanning(true);
  };

  const handleReturnToDesk = () => {
    const verifiedNum = verifiedTicket?.ticketNumber;
    setVerifiedTicket(null);
    setSelectedOutcome('Completed');
    setOutcomeRemarks('');
    if (verifiedNum) {
      showToast(`Ticket ${verifiedNum} QR verified`, 'matcha');
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/staff/registrar');
    }
  };

  const handleFinalizeOutcome = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      const cleanRemarks = outcomeRemarks.trim();
      let finalizedNumber: string | undefined;
      let nextTicket: { ticketNumber: string } | undefined;

      if (selectedOutcome === 'Completed') {
        const res = await completeCurrent(true, cleanRemarks || undefined);
        finalizedNumber = res.completedNumber;
        nextTicket = res.nextTicket;
      } else if (selectedOutcome === 'No-Show') {
        const res = await skipCurrent(cleanRemarks || 'Student did not appear at counter');
        finalizedNumber = res.skippedNumber;
        nextTicket = res.nextTicket;
      } else {
        const res = await cancelCurrent(cleanRemarks || 'Cancelled by counter staff');
        finalizedNumber = res.cancelledNumber;
        nextTicket = res.nextTicket;
      }

      if (!finalizedNumber) return;
      setVerifiedTicket(null);
      setSelectedOutcome('Completed');
      setOutcomeRemarks('');
      triggerHaptic(selectedOutcome === 'Completed' ? 'success' : 'warning');

      const verb =
        selectedOutcome === 'Completed'
          ? 'completed'
          : selectedOutcome === 'No-Show'
            ? 'marked as No-Show'
            : 'cancelled';
      const tone = selectedOutcome === 'Completed' ? 'matcha' : 'warning';

      if (nextTicket) {
        showToast(
          `${finalizedNumber} ${verb}. Now serving ${nextTicket.ticketNumber}.`,
          tone
        );
      } else {
        showToast(`${finalizedNumber} ${verb} and archived to History.`, tone);
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/staff/registrar');
      }
    } finally {
      setIsCompleting(false);
    }
  };

  const modals = (
    <>
      {/* Modal 3.2A: QR Verification Success */}
      <Modal
        visible={!!verifiedTicket}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleReturnToDesk}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.successBadgeCircle}>
              <Ionicons name="checkmark-sharp" size={32} color="#166534" />
            </View>

            <Text style={styles.modalTitleCenter}>Ticket Verified</Text>
            <Text style={styles.verifiedTicketHero}>{verifiedTicket?.ticketNumber}</Text>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Student</Text>
                <Text style={styles.detailValue}>{verifiedTicket?.studentName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>USN</Text>
                <Text style={styles.detailValue}>{verifiedTicket?.usn}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Program</Text>
                <Text style={styles.detailValue}>{verifiedTicket?.program || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue}>{verifiedTicket?.serviceType}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Issued At</Text>
                <Text style={styles.detailValue}>
                  {formatDisplayTimestamp(verifiedTicket?.issuedAt, 'short')}
                </Text>
              </View>
            </View>

            <Text style={styles.outcomeSectionLabel}>Select Final Outcome</Text>
            <View style={styles.outcomeRow}>
              {(['Completed', 'No-Show', 'Cancelled'] as const).map((option) => {
                const active = selectedOutcome === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.outcomeChip,
                      active &&
                        (option === 'Completed'
                          ? styles.outcomeChipComplete
                          : option === 'No-Show'
                            ? styles.outcomeChipNoShow
                            : styles.outcomeChipCancel),
                    ]}
                    onPress={() => setSelectedOutcome(option)}
                    disabled={isCompleting}
                  >
                    <Text
                      style={[
                        styles.outcomeChipText,
                        active && styles.outcomeChipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={outcomeRemarks}
              onChangeText={setOutcomeRemarks}
              placeholder="Optional remarks or reason..."
              placeholderTextColor={Colors.inkTabInactive}
              style={styles.outcomeInput}
              editable={!isCompleting}
            />

            <TouchableOpacity
              style={[
                styles.primaryEmeraldBtn,
                selectedOutcome === 'No-Show' && styles.primaryWarningBtn,
                selectedOutcome === 'Cancelled' && styles.primaryDangerBtn,
              ]}
              onPress={() => {
                void handleFinalizeOutcome();
              }}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <ActivityIndicator size="small" color={Colors.surface} />
              ) : (
                <Text style={styles.primaryEmeraldBtnText}>
                  Mark {selectedOutcome} &amp; Advance
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={handleReturnToDesk}
              disabled={isCompleting}
            >
              <Text style={styles.modalSecondaryText}>Return to Service Desk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 3.2B: QR Verification Error */}
      <Modal
        visible={!!errorMessage}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={resetScanner}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.errorBadgeCircle}>
              <Ionicons name="close" size={32} color="#991B1B" />
            </View>

            <Text style={styles.modalTitleCenter}>Verification Failed</Text>
            <Text style={styles.errorMessageText}>{errorMessage}</Text>

            <TouchableOpacity style={styles.primaryEmeraldBtn} onPress={resetScanner}>
              <Text style={styles.primaryEmeraldBtnText}>Scan Again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => {
                setErrorMessage(null);
                setShowManualModal(true);
              }}
            >
              <Text style={styles.modalSecondaryText}>Enter Ticket Code Manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual Ticket Verification */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowManualModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.manualBadgeCircle}>
              <Ionicons name="keypad-outline" size={28} color={Colors.ink} />
            </View>

            <Text style={styles.modalTitleCenter}>Manual Verification</Text>
            <Text style={styles.manualHint}>
              Enter the ticket number and the last four digits of the student USN.
            </Text>

            <Text style={styles.inputLabel}>Ticket number</Text>
            <TextInput
              value={manualTicketNum}
              onChangeText={setManualTicketNum}
              placeholder={expectedTicketCode}
              placeholderTextColor={Colors.inkTabInactive}
              autoCapitalize="characters"
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>Last 4 digits of USN</Text>
            <TextInput
              value={manualUsnLast4}
              onChangeText={setManualUsnLast4}
              placeholder={expectedUsnSuffix}
              placeholderTextColor={Colors.inkTabInactive}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.textInput}
            />

            <TouchableOpacity style={styles.primaryEmeraldBtn} onPress={handleManualVerify}>
              <Text style={styles.primaryEmeraldBtnText}>Verify Ticket</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => setShowManualModal(false)}
            >
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );

  // 1. Loading Permission State
  if (!permission) {
    return (
      <SafeAreaView style={styles.centerFallback} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.matcha} />
        <Text style={styles.fallbackSub}>Initializing camera viewfinder...</Text>
      </SafeAreaView>
    );
  }

  // 2. Permission Denied / Fallback State
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerFallback} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.permissionIconCircle}>
          <Ionicons name="camera-outline" size={36} color={Colors.matcha} />
        </View>
        <Text style={styles.fallbackTitle}>Camera Permission Required</Text>
        <Text style={styles.fallbackSub}>
          CampusQueue needs camera access to scan and verify student digital queue passes at{' '}
          {counterWindow}.
        </Text>

        <TouchableOpacity style={styles.primaryLimeBtn} onPress={requestPermission}>
          <Text style={styles.primaryLimeBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryDarkBtn}
          onPress={() => setShowManualModal(true)}
        >
          <Ionicons name="keypad-outline" size={18} color={Colors.surface} />
          <Text style={styles.secondaryDarkBtnText}>Enter Ticket Code Manually</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backTextBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/staff/registrar');
            }
          }}
        >
          <Text style={styles.backTextLabel}>Back to Counter Console</Text>
        </TouchableOpacity>

        {modals}
      </SafeAreaView>
    );
  }

  // 3. Full-Bleed Live Camera Scanner
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchEnabled}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
      />

      {/* Darkened Viewfinder Overlay */}
      <SafeAreaView style={styles.overlayContainer} edges={['top', 'bottom']}>
        {/* Top Overlay Header */}
        <View style={styles.topOverlay}>
          <TouchableOpacity
            style={styles.circleIconBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/staff/registrar');
              }
            }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.surface} />
          </TouchableOpacity>

          <View style={styles.counterHeaderPill}>
            <Text style={styles.counterHeaderTitle}>
              {officeTitle} • {counterWindow}
            </Text>
            <Text style={styles.counterHeaderSub}>Expected: {expectedTicketCode}</Text>
          </View>

          <TouchableOpacity
            style={[styles.circleIconBtn, torchEnabled && styles.torchActiveBtn]}
            onPress={() => setTorchEnabled((prev) => !prev)}
          >
            <Ionicons
              name={torchEnabled ? 'flash' : 'flash-outline'}
              size={20}
              color={torchEnabled ? Colors.ink : Colors.surface}
            />
          </TouchableOpacity>
        </View>

        {/* Center Reticle Frame */}
        <View style={styles.reticleSection}>
          <View style={styles.reticleBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={styles.scanLaserLine} />
          </View>
          <Text style={styles.scanHintText}>
            {isVerifying
              ? 'Verifying student pass with CampusQueue...'
              : "Align the student's CampusQueue QR pass inside the frame"}
          </Text>
          {isVerifying ? (
            <ActivityIndicator size="large" color={Colors.matcha} style={{ marginTop: 14 }} />
          ) : null}
        </View>

        {/* Bottom Manual Lookup Bar */}
        <View style={styles.bottomOverlay}>
          <TouchableOpacity
            style={styles.manualFallbackBtn}
            onPress={() => setShowManualModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="keypad-outline" size={18} color={Colors.surface} />
            <Text style={styles.manualFallbackText}>Manual Code Lookup</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {modals}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink,
    paddingHorizontal: 28,
  },
  fallbackTitle: {
    color: Colors.surface,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 18,
  },
  fallbackSub: {
    color: Colors.inkTabInactive,
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.darkNode,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLimeBtn: {
    height: 50,
    width: '100%',
    maxWidth: 360,
    borderRadius: Radii.pill,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryLimeBtnText: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 14,
  },
  secondaryDarkBtn: {
    height: 50,
    width: '100%',
    maxWidth: 360,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.inkNeutral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  secondaryDarkBtnText: {
    color: Colors.surface,
    fontFamily: Fonts.bodyBold,
  },
  backTextBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTextLabel: {
    color: Colors.inkTabInactive,
    fontFamily: Fonts.bodyMedium,
    marginTop: 10,
  },
  overlayContainer: {
    flex: 1,
  },
  topOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(18, 20, 23, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchActiveBtn: {
    backgroundColor: Colors.matcha,
  },
  counterHeaderPill: {
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(18, 20, 23, 0.88)',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  counterHeaderTitle: {
    color: Colors.surface,
    fontFamily: Fonts.displayBold,
    fontSize: 13,
  },
  counterHeaderSub: {
    color: Colors.matcha,
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  reticleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleBox: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: Colors.matcha,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: Colors.matcha,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: Colors.matcha,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: Colors.matcha,
  },
  scanLaserLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 130,
    height: 2,
    backgroundColor: Colors.matcha,
  },
  scanHintText: {
    maxWidth: 300,
    color: Colors.surface,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    backgroundColor: 'rgba(18, 20, 23, 0.88)',
    borderRadius: Radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 18,
    textAlign: 'center',
  },
  bottomOverlay: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  manualFallbackBtn: {
    height: 50,
    width: '100%',
    maxWidth: 360,
    borderRadius: Radii.pill,
    backgroundColor: Colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manualFallbackText: {
    color: Colors.surface,
    fontFamily: Fonts.displayExtraBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.backdropAlert,
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
  successBadgeCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.matchaSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  errorBadgeCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  manualBadgeCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.matcha,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  modalTitleCenter: {
    color: Colors.ink,
    fontFamily: Fonts.displayExtraBold,
    fontSize: 22,
    textAlign: 'center',
    marginTop: 14,
  },
  verifiedTicketHero: {
    color: Colors.ink,
    fontFamily: Fonts.monoBold,
    fontSize: 38,
    textAlign: 'center',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  detailsContainer: {
    marginTop: 16,
  },
  detailRow: {
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyMedium,
  },
  detailValue: {
    maxWidth: '65%',
    color: Colors.ink,
    fontFamily: Fonts.bodyBold,
    textAlign: 'right',
  },
  errorMessageText: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyRegular,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  manualHint: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyRegular,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  inputLabel: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    marginTop: 14,
    marginBottom: 6,
  },
  textInput: {
    height: 50,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    color: Colors.ink,
    fontFamily: Fonts.monoMedium,
    paddingHorizontal: 14,
  },
  primaryEmeraldBtn: {
    height: 50,
    borderRadius: Radii.pill,
    backgroundColor: Colors.successText,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryWarningBtn: {
    backgroundColor: Colors.warningDark,
  },
  primaryDangerBtn: {
    backgroundColor: Colors.danger,
  },
  outcomeSectionLabel: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyBold,
    fontSize: 11.5,
    marginTop: 14,
    marginBottom: 8,
  },
  outcomeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  outcomeChip: {
    flex: 1,
    height: 36,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeChipComplete: {
    backgroundColor: Colors.successText,
    borderColor: Colors.successText,
  },
  outcomeChipNoShow: {
    backgroundColor: Colors.warningDark,
    borderColor: Colors.warningDark,
  },
  outcomeChipCancel: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  outcomeChipText: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
  },
  outcomeChipTextActive: {
    color: Colors.surface,
  },
  outcomeInput: {
    height: 44,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    color: Colors.ink,
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  primaryEmeraldBtnText: {
    color: Colors.surface,
    fontFamily: Fonts.displayExtraBold,
  },
  modalSecondaryBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: Colors.inkSoft,
    fontFamily: Fonts.bodyBold,
  },
});
