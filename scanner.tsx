// app/scanner.tsx
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CQTheme } from '../../../../theme/campusQueueTheme';
import sampleData from './sampleData.json';

interface VerifiedTicketData {
  ticketNumber: string;
  studentName: string;
  usn: string;
  program: string;
  serviceType: string;
  issuedAt: string;
  method: 'qr_scan' | 'manual_usn_check';
}

const SCANNER_DATA = sampleData.scanner;

export default function StaffQRScanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  // Scanner Controls
  const [isScanning, setIsScanning] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Modals State
  const [verifiedTicket, setVerifiedTicket] = useState<VerifiedTicketData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual Fallback Inputs
  const [manualTicketNum, setManualTicketNum] = useState('');
  const [manualUsnLast4, setManualUsnLast4] = useState('');

  // --- QR Validation Logic (Ready for verifyTicketQR Cloud Function) ---
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    setIsScanning(false); // Debounce duplicate scans immediately

    // Expected payload format: cq:v1:{ticketId}:{hmacSignature}
    if (data.startsWith('cq:v1:') || data.includes(SCANNER_DATA.expectedTicket)) {
      setVerifiedTicket({
        ...SCANNER_DATA.verifiedTicket,
        method: 'qr_scan',
      });
    } else if (data.includes('A-')) {
      setErrorMessage(SCANNER_DATA.wrongOfficeError);
    } else {
      setErrorMessage(SCANNER_DATA.invalidQrError);
    }
  };

  // --- Manual USN Lookup Fallback ---
  const handleManualVerify = () => {
    const cleanTicket = manualTicketNum.trim().toUpperCase();
    const cleanUsn = manualUsnLast4.trim();

    if (!cleanTicket || cleanUsn.length !== 4) {
      setShowManualModal(false);
      setIsScanning(false);
      setErrorMessage(SCANNER_DATA.manualInputError);
      return;
    }

    if (
      cleanTicket === SCANNER_DATA.expectedTicket
      && cleanUsn === SCANNER_DATA.manualUsnSuffix
    ) {
      setShowManualModal(false);
      setIsScanning(false);
      setManualTicketNum('');
      setManualUsnLast4('');
      setVerifiedTicket({
        ...SCANNER_DATA.verifiedTicket,
        method: 'manual_usn_check',
      });
    } else {
      setShowManualModal(false);
      setIsScanning(false);
      setErrorMessage(
        `No active waiting/serving ticket found matching "${cleanTicket}" with USN ending in "${cleanUsn}".`
      );
    }
  };

  const resetScanner = () => {
    setErrorMessage(null);
    setVerifiedTicket(null);
    setIsScanning(true);
  };

  // 1. Loading Permission State
  if (!permission) {
    return (
      <SafeAreaView style={styles.centerFallback}>
        <ActivityIndicator size="large" color={CQTheme.colors.limeAccent} />
        <Text style={styles.fallbackSub}>Initializing camera viewfinder...</Text>
      </SafeAreaView>
    );
  }

  // 2. Permission Denied / Fallback State
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerFallback}>
        <View style={styles.permissionIconCircle}>
          <Ionicons name="camera-outline" size={36} color={CQTheme.colors.limeAccent} />
        </View>
        <Text style={styles.fallbackTitle}>Camera Permission Required</Text>
        <Text style={styles.fallbackSub}>
          CampusQueue needs camera access to scan and verify student digital queue passes at Window 2.
        </Text>

        <TouchableOpacity style={styles.primaryLimeBtn} onPress={requestPermission}>
          <Text style={styles.primaryLimeBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryDarkBtn}
          onPress={() => setShowManualModal(true)}
        >
          <Ionicons name="keypad-outline" size={18} color="#FFFFFF" />
          <Text style={styles.secondaryDarkBtnText}>Enter Ticket Code Manually</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backTextBtn} onPress={() => router.back()}>
          <Text style={styles.backTextLabel}>Back to Counter Console</Text>
        </TouchableOpacity>
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
      <SafeAreaView style={styles.overlayContainer}>
        {/* Top Overlay Header */}
        <View style={styles.topOverlay}>
          <TouchableOpacity style={styles.circleIconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.counterHeaderPill}>
            <Text style={styles.counterHeaderTitle}>Registrar • Window 2</Text>
            <Text style={styles.counterHeaderSub}>Expected: {SCANNER_DATA.expectedTicket}</Text>
          </View>

          <TouchableOpacity
            style={[styles.circleIconBtn, torchEnabled && styles.torchActiveBtn]}
            onPress={() => setTorchEnabled((prev) => !prev)}
          >
            <Ionicons
              name={torchEnabled ? 'flash' : 'flash-outline'}
              size={20}
              color={torchEnabled ? CQTheme.colors.limeText : '#FFFFFF'}
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
            Align the student&apos;s CampusQueue QR pass inside the frame
          </Text>
        </View>

        {/* Bottom Manual Lookup Bar */}
        <View style={styles.bottomOverlay}>
          <TouchableOpacity
            style={styles.manualFallbackBtn}
            onPress={() => setShowManualModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="keypad-outline" size={18} color="#FFFFFF" />
            <Text style={styles.manualFallbackText}>Manual Code Lookup</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ================= MODALS ================= */}

      {/* Modal 3.2A: QR Verification Success */}
      <Modal visible={!!verifiedTicket} transparent animationType="fade">
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
                <Text style={styles.detailValue}>{verifiedTicket?.program}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue}>{verifiedTicket?.serviceType}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Issued At</Text>
                <Text style={styles.detailValue}>{verifiedTicket?.issuedAt}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryEmeraldBtn}
              onPress={() => {
                setVerifiedTicket(null);
                router.back();
              }}
            >
              <Text style={styles.primaryEmeraldBtnText}>Start / Return to Service Desk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal 3.2B: QR Verification Error */}
      <Modal visible={!!errorMessage} transparent animationType="fade">
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
        onRequestClose={() => setShowManualModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.manualBadgeCircle}>
              <Ionicons name="keypad-outline" size={28} color={CQTheme.colors.darkCard} />
            </View>

            <Text style={styles.modalTitleCenter}>Manual Verification</Text>
            <Text style={styles.manualHint}>
              Enter the ticket number and the last four digits of the student USN.
            </Text>

            <Text style={styles.inputLabel}>Ticket number</Text>
            <TextInput
              value={manualTicketNum}
              onChangeText={setManualTicketNum}
              placeholder={SCANNER_DATA.manualPlaceholder}
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>Last 4 digits of USN</Text>
            <TextInput
              value={manualUsnLast4}
              onChangeText={setManualUsnLast4}
              placeholder={SCANNER_DATA.usnPlaceholder}
              placeholderTextColor="#9CA3AF"
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
    backgroundColor: CQTheme.colors.darkCard,
    paddingHorizontal: 28,
  },
  fallbackTitle: {
    color: CQTheme.colors.textInverse,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 18,
  },
  fallbackSub: {
    color: '#A1A1AA',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#303438',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLimeBtn: {
    height: 50,
    width: '100%',
    maxWidth: 360,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.limeAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryLimeBtnText: {
    color: CQTheme.colors.limeText,
    fontWeight: '900',
  },
  secondaryDarkBtn: {
    height: 50,
    width: '100%',
    maxWidth: 360,
    borderRadius: CQTheme.radii.pill,
    borderWidth: 1,
    borderColor: '#52525B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  secondaryDarkBtnText: {
    color: CQTheme.colors.textInverse,
    fontWeight: '800',
  },
  backTextBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTextLabel: {
    color: '#A1A1AA',
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
    backgroundColor: 'rgba(22,24,26,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchActiveBtn: {
    backgroundColor: CQTheme.colors.limeAccent,
  },
  counterHeaderPill: {
    borderRadius: CQTheme.radii.pill,
    backgroundColor: 'rgba(22,24,26,0.88)',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  counterHeaderTitle: {
    color: CQTheme.colors.textInverse,
    fontSize: 13,
    fontWeight: '900',
  },
  counterHeaderSub: {
    color: CQTheme.colors.limeAccent,
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 2,
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
    borderColor: CQTheme.colors.limeAccent,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: CQTheme.colors.limeAccent,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: CQTheme.colors.limeAccent,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: CQTheme.colors.limeAccent,
  },
  scanLaserLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 130,
    height: 2,
    backgroundColor: CQTheme.colors.limeAccent,
  },
  scanHintText: {
    maxWidth: 300,
    color: CQTheme.colors.textInverse,
    backgroundColor: 'rgba(22,24,26,0.88)',
    borderRadius: CQTheme.radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 18,
    textAlign: 'center',
  },
  bottomOverlay: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  manualFallbackBtn: {
    height: 50,
    width: '100%',
    maxWidth: 360,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.darkCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  manualFallbackText: {
    color: CQTheme.colors.textInverse,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22,24,26,0.68)',
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
  successBadgeCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: CQTheme.colors.emeraldSoft,
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
    backgroundColor: CQTheme.colors.limeAccent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  modalTitleCenter: {
    color: CQTheme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 14,
  },
  verifiedTicketHero: {
    color: CQTheme.colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 38,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
  },
  detailsContainer: {
    marginTop: 16,
  },
  detailRow: {
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: CQTheme.colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: CQTheme.colors.textSecondary,
  },
  detailValue: {
    maxWidth: '65%',
    color: CQTheme.colors.textPrimary,
    fontWeight: '800',
    textAlign: 'right',
  },
  errorMessageText: {
    color: CQTheme.colors.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  manualHint: {
    color: CQTheme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  inputLabel: {
    color: CQTheme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  textInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CQTheme.colors.borderLight,
    backgroundColor: CQTheme.colors.surfaceMuted,
    color: CQTheme.colors.textPrimary,
    paddingHorizontal: 14,
  },
  primaryEmeraldBtn: {
    height: 50,
    borderRadius: CQTheme.radii.pill,
    backgroundColor: CQTheme.colors.emeraldBadge,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryEmeraldBtnText: {
    color: CQTheme.colors.textInverse,
    fontWeight: '900',
  },
  modalSecondaryBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: CQTheme.colors.textSecondary,
    fontWeight: '800',
  },
});
