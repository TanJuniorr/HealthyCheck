import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing, Radius, Shadows } from '../src/constants/spacing';
import { AppHeader, SectionHeader } from '../src/components/common/AppHeader';
import { ScreenContainer } from '../src/components/common/ScreenContainer';
import { TextButton } from '../src/components/common/Buttons';
import { MockAvatar } from '../src/components/common/MockAvatar';
import { SettingsRow } from '../src/components/health/HealthComponents';
import { mockUser } from '../src/data/user';

export default function ProfileScreen() {
  const router = useRouter();

  const handleSignOut = () => {
    // Visual sign out confirmation
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Profile"
        showBack
        rightIcon="settings-outline"
        onRightPress={() => router.push('/settings')}
      />

      <ScreenContainer>
        {/* Profile Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatarWrapper}>
            <MockAvatar initials={mockUser.avatarInitials} size={80} />
            <TouchableOpacity style={styles.editAvatarBadge} activeOpacity={0.8}>
              <Ionicons name="camera" size={14} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{mockUser.fullName}</Text>
          <Text style={styles.userEmail}>{mockUser.email}</Text>

          <View style={styles.memberBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
            <Text style={styles.memberBadgeText}>Healthy Check Member</Text>
          </View>
        </View>

        {/* Personal Info Grid */}
        <SectionHeader title="Personal Information" />
        <View style={styles.personalInfoGrid}>
          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>
              {mockUser.age} <Text style={styles.infoUnit}>yrs</Text>
            </Text>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.blueLight }]}>
              <Ionicons name="resize-outline" size={18} color={Colors.blue} />
            </View>
            <Text style={styles.infoLabel}>Height</Text>
            <Text style={styles.infoValue}>
              {mockUser.height} <Text style={styles.infoUnit}>cm</Text>
            </Text>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.orangeLight }]}>
              <Ionicons name="scale-outline" size={18} color={Colors.orange} />
            </View>
            <Text style={styles.infoLabel}>Weight</Text>
            <Text style={styles.infoValue}>
              {mockUser.weight} <Text style={styles.infoUnit}>kg</Text>
            </Text>
          </View>

          <View style={styles.infoBox}>
            <View style={[styles.infoIconBg, { backgroundColor: Colors.purpleLight }]}>
              <Ionicons name="person-outline" size={18} color={Colors.purple} />
            </View>
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={styles.infoValue}>{mockUser.gender}</Text>
          </View>
        </View>

        {/* Daily Goals Section */}
        <SectionHeader title="Daily Goals" />
        <View style={styles.card}>
          {/* Steps */}
          <View style={styles.goalItem}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="footsteps-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>Steps</Text>
              <Text style={styles.goalSubtitle}>Daily active walking</Text>
            </View>
            <Text style={styles.goalValue}>
              {mockUser.dailyGoals.steps.toLocaleString()} <Text style={styles.goalUnit}>steps</Text>
            </Text>
          </View>

          {/* Calories */}
          <View style={styles.goalItem}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.orangeLight }]}>
              <Ionicons name="flame-outline" size={20} color={Colors.orange} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>Active Calories</Text>
              <Text style={styles.goalSubtitle}>Burn & nutrition target</Text>
            </View>
            <Text style={styles.goalValue}>
              {mockUser.dailyGoals.calories.toLocaleString()} <Text style={styles.goalUnit}>kcal</Text>
            </Text>
          </View>

          {/* Water */}
          <View style={styles.goalItem}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.blueLight }]}>
              <Ionicons name="water-outline" size={20} color={Colors.blue} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>Hydration</Text>
              <Text style={styles.goalSubtitle}>Daily fluids intake</Text>
            </View>
            <Text style={styles.goalValue}>
              {mockUser.dailyGoals.water.toLocaleString()} <Text style={styles.goalUnit}>ml</Text>
            </Text>
          </View>

          {/* Sleep */}
          <View style={[styles.goalItem, styles.goalItemLast]}>
            <View style={[styles.goalIconBg, { backgroundColor: Colors.purpleLight }]}>
              <Ionicons name="moon-outline" size={20} color={Colors.purple} />
            </View>
            <View style={styles.goalDetails}>
              <Text style={styles.goalTitle}>Sleep</Text>
              <Text style={styles.goalSubtitle}>Nightly rest duration</Text>
            </View>
            <Text style={styles.goalValue}>
              {mockUser.dailyGoals.sleep} <Text style={styles.goalUnit}>hours</Text>
            </Text>
          </View>
        </View>

        {/* Preferences & Quick Links */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingsRow
            title="Settings"
            value="Config"
            icon="options-outline"
            onPress={() => router.push('/settings')}
          />
          <SettingsRow
            title="Sleep Schedule"
            value="10:00 PM - 7:30 AM"
            icon="alarm-outline"
            onPress={() => router.push('/sleep-schedule')}
          />
          <SettingsRow
            title="Sharing Setup"
            value="Active"
            icon="people-outline"
            onPress={() => router.push('/sharing-setup')}
          />
        </View>

        {/* About Section */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow
            title="App Version"
            value="1.0.0 (Build 42)"
            icon="information-circle-outline"
            showChevron={false}
          />
          <SettingsRow
            title="Privacy Policy"
            icon="lock-closed-outline"
            onPress={() => Alert.alert('Privacy Policy', 'Your personal health data stays securely on your device.')}
          />
          <SettingsRow
            title="Terms of Service"
            icon="document-text-outline"
            onPress={() => Alert.alert('Terms of Service', 'Healthy Check standard terms and conditions.')}
          />
        </View>

        {/* Sign Out Action */}
        <View style={styles.signOutContainer}>
          <TextButton
            title="Sign Out"
            onPress={handleSignOut}
            color={Colors.error}
            style={styles.signOutButton}
          />
        </View>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userName: {
    ...Typography.largeTitle,
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  memberBadgeText: {
    ...Typography.labelSmall,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  personalInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  infoBox: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  infoLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.cardTitle,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  infoUnit: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  goalItemLast: {
    borderBottomWidth: 0,
  },
  goalIconBg: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  goalDetails: {
    flex: 1,
  },
  goalTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  goalSubtitle: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 1,
  },
  goalValue: {
    ...Typography.cardTitle,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  goalUnit: {
    ...Typography.supporting,
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  signOutContainer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  signOutButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
});
