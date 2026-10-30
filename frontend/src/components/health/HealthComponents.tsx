import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, Radius } from '../../constants/spacing';
import { getThemedColor, useTheme, useThemedStyles } from '../../contexts/ThemeContext';

interface HealthMetricCardProps {
  detail?: string;
  progressPercent?: number;
  category: string;
  value: string;
  unit?: string;
  icon: string;
  color: string;
  bgColor: string;
  route: string;
}

export function HealthMetricCard({
  category,
  value,
  unit,
  icon,
  color,
  bgColor,
  route,
  detail,
  progressPercent,
}: HealthMetricCardProps) {
  const styles = useThemedStyles(baseStyles);
  const { isDark } = useTheme();
  const themedColor = getThemedColor(color, isDark);
  const themedBgColor = getThemedColor(bgColor, isDark, 'background');
  const router = useRouter();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={[category,value,unit,detail].filter(Boolean).join(' · ')}
      style={[styles.card, { backgroundColor: themedBgColor }]}
      onPress={() => router.push(route as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: themedColor + '18' }]}>
        <Ionicons name={getIonIcon(icon)} size={20} color={themedColor} />
      </View>
      <Text style={styles.category}>{category}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: themedColor }]}>{value}</Text>
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </View>
      {detail && <Text style={styles.unit}>{detail}</Text>}
      {progressPercent !== undefined && <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.min(100,Math.max(0,progressPercent))}} style={{height:6,borderRadius:3,backgroundColor:Colors.border,marginTop:10,overflow:'hidden'}}><View style={{height:6,width:`${Math.min(100,Math.max(0,progressPercent))}%`,backgroundColor:themedColor}}/></View>}
    </TouchableOpacity>
  );
}

interface MetricListItemProps {
  name: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
  bgColor: string;
  route: string;
}

export function MetricListItem({
  name,
  value,
  unit,
  icon,
  color,
  bgColor,
  route,
}: MetricListItemProps) {
  const styles = useThemedStyles(baseStyles);
  const { isDark } = useTheme();
  const router = useRouter();
  const themedColor = getThemedColor(color, isDark);
  const themedBgColor = getThemedColor(bgColor, isDark, 'background');

  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => router.push(route as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.listIconContainer, { backgroundColor: themedBgColor }]}>
        <Ionicons name={icon as any} size={20} color={themedColor} />
      </View>
      <View style={styles.listContent}>
        <Text style={styles.listName}>{name}</Text>
        <Text style={styles.listValue}>
          {value} <Text style={styles.listUnit}>{unit}</Text>
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

interface StatPillProps {
  label: string;
  value: string;
  icon: string;
}

export function StatPill({ label, value, icon }: StatPillProps) {
  const styles = useThemedStyles(baseStyles);
  return (
    <View style={styles.pill}>
      <Ionicons name={icon as any} size={16} color={Colors.primary} />
      <View style={styles.pillText}>
        <Text style={styles.pillValue}>{value}</Text>
        <Text style={styles.pillLabel}>{label}</Text>
      </View>
    </View>
  );
}

interface CategoryChipProps {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  selected?: boolean;
  onPress?: () => void;
}

export function CategoryChip({
  label,
  icon,
  color,
  bgColor,
  selected = false,
  onPress,
}: CategoryChipProps) {
  const styles = useThemedStyles(baseStyles);
  const { isDark } = useTheme();
  const themedColor = getThemedColor(color, isDark);
  const themedBgColor = getThemedColor(bgColor, isDark, 'background');
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { backgroundColor: selected ? themedColor : themedBgColor },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={16} color={selected ? Colors.white : themedColor} />
      <Text style={[styles.chipLabel, { color: selected ? Colors.white : themedColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

interface SettingsRowProps {
  title: string;
  value?: string;
  icon: string;
  onPress?: () => void;
  showChevron?: boolean;
}

export function SettingsRow({ title, value, icon, onPress, showChevron = true }: SettingsRowProps) {
  const styles = useThemedStyles(baseStyles);
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.settingsLeft}>
        <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
        <Text style={styles.settingsTitle}>{title}</Text>
      </View>
      <View style={styles.settingsRight}>
        {value && <Text style={styles.settingsValue}>{value}</Text>}
        {showChevron && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
      </View>
    </TouchableOpacity>
  );
}

function getIonIcon(icon: string): any {
  const iconMap: Record<string, string> = {
    walk: 'walk-outline',
    moon: 'moon-outline',
    nutrition: 'restaurant-outline',
    flower: 'flower-outline',
    heart: 'heart-outline',
    flame: 'flame-outline',
    body: 'body-outline',
  };
  return iconMap[icon] || `${icon}-outline`;
}

const baseStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    minHeight: 120,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  category: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  valueRow: {
    flexWrap:'wrap',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    ...Typography.cardTitle,
    fontSize: 18,
    fontWeight: '700',
  },
  unit: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  // List Item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  listIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  listContent: {
    flex: 1,
  },
  listName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  listValue: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listUnit: {
    color: Colors.textMuted,
  },
  // Stat Pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  pillText: {
    gap: 1,
    flex:1,
    minWidth:0,
  },
  pillValue: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  pillLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
  },
  // Category Chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    gap: 6,
    marginRight: Spacing.sm,
  },
  chipLabel: {
    ...Typography.label,
    fontWeight: '500',
  },
  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  settingsLeft: {
    flex:1,
    minWidth:0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingsRight: {
    flexShrink:1,
    maxWidth:'45%',
    marginLeft:Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingsTitle: {
    flexShrink:1,
    ...Typography.body,
    color: Colors.textPrimary,
  },
  settingsValue: {
    flexShrink:1,
    textAlign:'right',
    ...Typography.supporting,
    color: Colors.textMuted,
  },
});
