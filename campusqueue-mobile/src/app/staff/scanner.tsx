import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQueue } from '../../context/QueueContext';
import { useStaffQueue } from '../../context/StaffQueueContext';
import { Colors, Fonts, Radii } from '../../theme/tokens';

export default function StaffQRScanner() {
  const router = useRouter();
  const { showToast, triggerHaptic } = useQueue();
  const { scannerConfig, counterWindow, servingTicket, waitingQueue, markTicketVerified } =
    useStaffQueue();
  const [permission, requestPermission] = useCameraPermissions();

  const [isScanning, setIsScanning] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const expectedTicketCode = servingTicket?.ticketNumber ?? scannerConfig.expectedTicket;

  const findActiveTicket = (ticketCode: string) => {
    const clean = ticketCode.trim().toUpperCase();
    if (servingTicket && servingTicket.ticketNumber.toUpperCase() === clean) {
      return servingTicket;
    }
    return waitingQueue.find((item) => item.ticketNumber.toUpperCase() === clean) ?? null;
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!isScanning) return;
    setIsScanning(false);

    const raw = data.trim();
    const v1Match = raw.match(/^cq:v1:([A-Z]-\d{3})(?::(\d+))?/i);
    const serialMatch = raw.match(/^CQ-\d{4}-([A-Z])(\d{3})$/i);

    const parsedTicket = v1Match
      ? v1Match[1].toUpperCase()
      : serialMatch
      ? `${serialMatch[1].toUpperCase()}-${serialMatch[2]}`
      : null;

    if (parsedTicket && parsedTicket.startsWith('R-')) {
      const liveMatch = findActiveTicket(parsedTicket);
      markTicketVerified(liveMatch?.ticketNumber ?? parsedTicket);
      triggerHaptic('success');
      showToast(`Ticket ${parsedTicket} QR verified`, 'matcha');
      return;
    }

    triggerHaptic('warning');
    showToast(scannerConfig.invalidQrError, 'warning');
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.centerFallback} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.matcha} />
        <Text style={styles.fallbackSub}>Initializing camera viewfinder...</Text>
      </SafeAreaView>
    );
  }

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
      </SafeAreaView>
    );
  }

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

      <SafeAreaView style={styles.overlayContainer} edges={['top', 'bottom']}>
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
            <Text style={styles.counterHeaderTitle}>Registrar • {counterWindow}</Text>
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
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
  overlayContainer: { flex: 1 },
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
  torchActiveBtn: { backgroundColor: Colors.matcha },
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
  reticleSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reticleBox: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 42, height: 42 },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderColor: Colors.matcha },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderColor: Colors.matcha },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: Colors.matcha },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderColor: Colors.matcha },
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
});
