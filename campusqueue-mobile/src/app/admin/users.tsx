import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminUsersSkeleton } from '../../components/admin/AdminSkeleton';
import { EditUserRoleAndOfficeModal } from '../../components/admin/EditUserRoleAndOfficeModal';
import { ProvisionStaffOrAdminModal } from '../../components/admin/ProvisionStaffOrAdminModal';
import { ResetUserPasswordModal } from '../../components/admin/ResetUserPasswordModal';
import { ToggleAccountStatusModal } from '../../components/admin/ToggleAccountStatusModal';
import { useAdmin } from '../../context/AdminContext';
import { useQueue } from '../../context/QueueContext';
import { Colors, Fonts, Radii, Shadows } from '../../theme/tokens';
import { AdminUserRecord, AdminUserRole } from '../../types/admin';

/**
 * Screen 4.3: User & Role Access Management (/admin/users)
 */
export default function AdminUsersScreen() {
  const {
    users,
    offices,
    isLoadingLive,
    hasLoadedLive,
    usersError,
    refreshAdminData,
    directoryTotalBadges,
    provisionUser,
    updateStaffAssignment,
    resetUserPassword,
    toggleAccountStatus,
  } = useAdmin();
  const { triggerHaptic } = useQueue();

  useFocusEffect(
    useCallback(() => {
      void refreshAdminData(undefined, true);
    }, [refreshAdminData])
  );

  const officeFilterOptions = useMemo(
    () => [
      { id: 'all', label: 'All Offices' },
      ...offices.map((o) => ({ id: o.id, label: o.shortLabel || o.name })),
    ],
    [offices]
  );

  const [activeTab, setActiveTab] = useState<AdminUserRole>('staff');
  const [searchQuery, setSearchQuery] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [editStaffUser, setEditStaffUser] = useState<AdminUserRecord | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<AdminUserRecord | null>(null);
  const [toggleStatusUser, setToggleStatusUser] = useState<AdminUserRecord | null>(null);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (u.role !== activeTab) return false;
      if (activeTab === 'staff' && officeFilter !== 'all' && u.assignedOfficeId !== officeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.identifier.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [activeTab, officeFilter, searchQuery, users]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>Users & Access</Text>
          <Text style={styles.headerSub}>Provision staff, manage roles & security</Text>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic('light');
            setShowProvisionModal(true);
          }}
          style={({ pressed }) => [styles.provisionBtn, pressed && styles.pressed]}
        >
          <Feather name="user-plus" size={14} color={Colors.surface} />
          <Text style={styles.provisionBtnText}>Provision</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isLoadingLive}
            onRefresh={() => {
              void refreshAdminData();
            }}
            tintColor={Colors.ink}
          />
        }
      >
        {/* Role Directory Tabs */}
        <View style={styles.tabBar}>
          {(
            [
              {
                key: 'staff',
                label: `Campus Staff (${directoryTotalBadges.staff})`,
              },
              {
                key: 'student',
                label: `Students (${directoryTotalBadges.students.toLocaleString()})`,
              },
              {
                key: 'admin',
                label: `Admins (${directoryTotalBadges.admins})`,
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  triggerHaptic('light');
                  setActiveTab(tab.key);
                }}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search Input */}
        <View style={styles.searchWrap}>
          <Feather name="search" size={15} color={Colors.inkMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by USN (23**********), Employee ID, or Name..."
            placeholderTextColor={Colors.inkMuted}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Feather name="x-circle" size={15} color={Colors.inkMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* Office Filter Dropdown Chips (Staff Tab Only) */}
        {activeTab === 'staff' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {officeFilterOptions.map((opt) => {
              const active = officeFilter === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setOfficeFilter(opt.id)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Sync Error Banner */}
        {usersError ? (
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              void refreshAdminData();
            }}
            style={[styles.errorCard, Shadows.card]}
          >
            <Feather name="alert-triangle" size={16} color={Colors.danger} />
            <View style={styles.flex}>
              <Text style={styles.errorCardTitle}>Unable to sync user directory.</Text>
              <Text style={styles.errorCardSub}>{usersError} Tap to retry.</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Directory List */}
        {(isLoadingLive || !hasLoadedLive) && users.length === 0 ? (
          <AdminUsersSkeleton />
        ) : filteredUsers.length === 0 ? (
          <View style={[styles.emptyCard, Shadows.card]}>
            <Feather name="users" size={24} color={Colors.inkMuted} />
            <Text style={styles.emptyTitle}>No user accounts match your search criteria.</Text>
          </View>
        ) : (
          filteredUsers.map((user) => {
            const isActive = user.status === 'active';
            const roleLabel =
              user.role === 'staff' ? 'Staff' : user.role === 'admin' ? 'Admin' : 'Student';

            return (
              <View key={user.id} style={[styles.userCard, Shadows.card]}>
                <View style={styles.userTopRow}>
                  <View style={styles.flex}>
                    <View style={styles.nameBadgeRow}>
                      <Text style={styles.userName}>{user.fullName}</Text>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.userIdEmail}>
                      <Text style={styles.monoId}>{user.identifier}</Text> • {user.email}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isActive ? Colors.matchaSoftBg : Colors.dangerSoftBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: isActive ? Colors.successText : Colors.danger },
                      ]}
                    >
                      {isActive ? 'Active' : 'Suspended'}
                    </Text>
                  </View>
                </View>

                {/* Context Tag */}
                <View style={styles.tagRow}>
                  {user.role === 'staff' && user.assignedOfficeName ? (
                    <View style={styles.metaTag}>
                      <Feather name="layers" size={11} color={Colors.registrar} />
                      <Text style={styles.metaTagText}>
                        {user.assignedOfficeName}
                        {user.defaultWindow ? ` • ${user.defaultWindow}` : ''}
                      </Text>
                    </View>
                  ) : null}
                  {user.role === 'student' && user.courseYear ? (
                    <View style={styles.metaTag}>
                      <Feather name="book-open" size={11} color={Colors.accounting} />
                      <Text style={styles.metaTagText}>{user.courseYear}</Text>
                    </View>
                  ) : null}
                  {user.mustChangePassword ? (
                    <View style={[styles.metaTag, { backgroundColor: Colors.warningSoftBg }]}>
                      <Text style={[styles.metaTagText, { color: Colors.warningDark }]}>
                        Pwd Reset Pending
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Action Row */}
                <View style={styles.userActions}>
                  {user.role === 'staff' ? (
                    <Pressable
                      onPress={() => {
                        triggerHaptic('light');
                        setEditStaffUser(user);
                      }}
                      style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                    >
                      <Feather name="sliders" size={12} color={Colors.ink} />
                      <Text style={styles.actionBtnText}>Edit Assignment</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    onPress={() => {
                      triggerHaptic('light');
                      setResetPwdUser(user);
                    }}
                    style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  >
                    <Feather name="key" size={12} color={Colors.ink} />
                    <Text style={styles.actionBtnText}>Reset Password</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      triggerHaptic('light');
                      setToggleStatusUser(user);
                    }}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      isActive ? styles.actionBtnDanger : styles.actionBtnSuccess,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Feather
                      name={isActive ? 'slash' : 'check-circle'}
                      size={12}
                      color={isActive ? Colors.danger : Colors.successText}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: isActive ? Colors.danger : Colors.successText },
                      ]}
                    >
                      {isActive ? 'Suspend' : 'Activate'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal 4.3A: ProvisionStaffOrAdminModal */}
      <ProvisionStaffOrAdminModal
        visible={showProvisionModal}
        offices={offices}
        existingUsers={users}
        onClose={() => setShowProvisionModal(false)}
        onProvision={provisionUser}
      />

      {/* Modal 4.3B: EditUserRoleAndOfficeModal */}
      <EditUserRoleAndOfficeModal
        user={editStaffUser}
        offices={offices}
        onClose={() => setEditStaffUser(null)}
        onSave={updateStaffAssignment}
      />

      {/* Modal 4.3C: ResetUserPasswordModal */}
      <ResetUserPasswordModal
        user={resetPwdUser}
        onClose={() => setResetPwdUser(null)}
        onConfirmReset={resetUserPassword}
      />

      {/* Modal 4.3D: ToggleAccountStatusModal */}
      <ToggleAccountStatusModal
        user={toggleStatusUser}
        onClose={() => setToggleStatusUser(null)}
        onConfirm={toggleAccountStatus}
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
  provisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.ink,
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  provisionBtnText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.surface,
  },
  pressed: { opacity: 0.84 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 112,
    gap: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: Radii.pill,
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: Colors.ink,
  },
  tabText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.inkSoft,
  },
  tabTextActive: {
    fontFamily: Fonts.bodyBold,
    color: Colors.matcha,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.ink,
    padding: 0,
  },
  filterRow: {
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  filterChipText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.inkSoft,
  },
  filterChipTextActive: {
    color: Colors.surface,
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
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  userTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontFamily: Fonts.displayBold,
    fontSize: 14.5,
    color: Colors.ink,
  },
  roleBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  roleBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10,
    color: Colors.inkNeutral,
  },
  userIdEmail: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  monoId: {
    fontFamily: Fonts.monoSemiBold,
    color: Colors.ink,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  statusBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 10.5,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  metaTagText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11,
    color: Colors.ink,
  },
  userActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  actionBtnDanger: {
    backgroundColor: Colors.dangerSoftBg,
    borderColor: Colors.dangerBorder,
  },
  actionBtnSuccess: {
    backgroundColor: Colors.matchaSoftBg,
    borderColor: Colors.borderSubtle,
  },
  actionBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    color: Colors.ink,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radii.card,
    backgroundColor: Colors.dangerSoftBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  errorCardTitle: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12.5,
    color: Colors.danger,
  },
  errorCardSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11.5,
    color: Colors.inkSoft,
    marginTop: 1,
  },
});
