import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Office } from '../../types/queue';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';

interface RequestTicketSheetProps {
  office: Office | null;
  onClose: () => void;
  onConfirm: (selection: {
    serviceId?: string;
    serviceName: string;
    notes: string;
    requestId: string;
  }) => void | Promise<void>;
}

function makeRequestId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function RequestTicketSheet(props: RequestTicketSheetProps) {
  return props.office ? <TicketRequestForm key={props.office.id} {...props} /> : null;
}

function TicketRequestForm({ office, onClose, onConfirm }: RequestTicketSheetProps) {
  const [selectedServiceId, setSelectedServiceId] = useState(office?.services[0]?.id ?? '');
  const [selectedServiceName, setSelectedServiceName] = useState(office?.services[0]?.name ?? '');
  const [ticketNotes, setTicketNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestIdRef = useRef(makeRequestId());
  const submitting = useRef(false);



  if (!office) return null;

  const handleSelectService = (id: string, name: string) => {
    if (id !== selectedServiceId) {
      requestIdRef.current = makeRequestId();
    }
    setSelectedServiceId(id);
    setSelectedServiceName(name);
  };

  const handleSubmit = async () => {
    if (submitting.current || !selectedServiceName) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm({
        serviceId: selectedServiceId || undefined,
        serviceName: selectedServiceName,
        notes: ticketNotes,
        requestId: requestIdRef.current,
      });
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={Boolean(office)}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, Shadows.modal]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{office.name}</Text>
              <Text style={styles.subtitle}>
                {office.waitingCount} waiting • Now Serving {office.nowServing || '—'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close ticket sheet"
              hitSlop={8}
              style={styles.closeBtn}
            >
              <Feather name="x" size={16} color={Colors.ink} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.servicesScroll}
            contentContainerStyle={styles.servicesList}
            showsVerticalScrollIndicator={false}
          >
            {office.services.length === 0 ? (
              <View style={styles.serviceItemDefault}>
                <Text style={styles.serviceMeta}>
                  No active services are configured for this office right now.
                </Text>
              </View>
            ) : (
              office.services.map((srv) => {
                const isSelected = selectedServiceId
                  ? selectedServiceId === srv.id
                  : selectedServiceName === srv.name;
                return (
                  <Pressable
                    key={srv.id}
                    onPress={() => handleSelectService(srv.id, srv.name)}
                    style={[
                      styles.serviceItem,
                      isSelected ? styles.serviceItemSelected : styles.serviceItemDefault,
                    ]}
                  >
                    <View style={styles.serviceCopy}>
                      <Text
                        style={[
                          styles.serviceName,
                          isSelected && styles.serviceNameSelected,
                        ]}
                      >
                        {srv.name}
                      </Text>
                      <Text
                        style={[
                          styles.serviceMeta,
                          isSelected && styles.serviceMetaSelected,
                        ]}
                      >
                        Est. {srv.duration}m{srv.docs ? ` • Bring: ${srv.docs}` : ''}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.checkCircle,
                        isSelected ? styles.checkCircleSelected : styles.checkCircleDefault,
                      ]}
                    >
                      {isSelected ? <Feather name="check" size={12} color={Colors.ink} /> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <TextInput
            value={ticketNotes}
            onChangeText={(text) => {
              setTicketNotes(text);
              requestIdRef.current = makeRequestId();
            }}
            maxLength={120}
            placeholder="Optional notes (e.g., document or purpose)"
            placeholderTextColor="rgba(18, 20, 23, 0.42)"
            style={styles.notesInput}
          />

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={isSubmitting}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void handleSubmit();
              }}
              disabled={isSubmitting || !selectedServiceName}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: office.themeColor },
                (pressed || isSubmitting || !selectedServiceName) && styles.pressed,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={Colors.surface} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm &amp; Issue Ticket</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.sheet,
    borderTopRightRadius: Radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(18, 20, 23, 0.15)',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts.displayExtraBold,
    fontSize: 18,
    letterSpacing: -0.4,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: Colors.inkSoft,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesScroll: {
    maxHeight: 240,
  },
  servicesList: {
    gap: 8,
  },
  serviceItem: {
    padding: 12,
    borderRadius: Radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  serviceItemDefault: {
    backgroundColor: Colors.surfaceSubtle,
    borderColor: Colors.border,
  },
  serviceItemSelected: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  serviceCopy: {
    flex: 1,
  },
  serviceName: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.ink,
  },
  serviceNameSelected: {
    color: Colors.surface,
  },
  serviceMeta: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 10.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  serviceMetaSelected: {
    color: Colors.matcha,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDefault: {
    borderColor: 'rgba(18, 20, 23, 0.25)',
  },
  checkCircleSelected: {
    backgroundColor: Colors.matcha,
    borderColor: Colors.matcha,
  },
  notesInput: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.ink,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.ink,
  },
  confirmBtn: {
    flex: 1.25,
    paddingVertical: 12,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
});
