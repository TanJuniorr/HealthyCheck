import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { MetricListItem } from '../../src/components/health/HealthComponents';
import { healthMetrics } from '../../src/data/health';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';

export default function HealthDataScreen() {
  return (
    <View style={styles.container}>
      <AppHeader title="Health Data" showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
        {/* Intro Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headline}>All Tracked Metrics</Text>
          <Text style={styles.subheadline}>
            Comprehensive overview of your daily vitals, physical activity, and wellness data.
          </Text>
        </View>

        {/* Metrics List Card */}
        <View style={styles.metricsCard}>
          {healthMetrics.map((metric, index) => (
            <View key={metric.id}>
              <MetricListItem
                name={metric.name}
                value={metric.value}
                unit={metric.unit}
                icon={metric.icon}
                color={metric.color}
                bgColor={metric.bgColor}
                route={metric.route}
              />
            </View>
          ))}
        </View>

        {/* Bottom Note */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            Tap any metric to view detailed trends, breakdowns, and historical insights.
          </Text>
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
  headerSection: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headline: {
    ...Typography.sectionTitle,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subheadline: {
    ...Typography.supporting,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  metricsCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
    marginTop: Spacing.sm,
  },
  noteContainer: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  noteText: {
    ...Typography.supporting,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
