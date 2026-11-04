import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../src/i18n/formatting';
import { localizeStaticData } from '../../src/i18n/localize';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { MetricListItem } from '../../src/components/health/HealthComponents';
import { healthMetrics as rawMetricDefinitions } from '../../src/data/health';
import { useHealthOverview } from '../../src/hooks/healthHooks';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';

export default function HealthDataScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t } = useTranslation();
  const { profile } = useAuth();
  const metricDefinitions = localizeStaticData(rawMetricDefinitions).filter(metric => metric.id !== 'cycle' || profile?.gender === 'female');

  const query = useHealthOverview(); const summary = query.data;
  const values: Record<string,string> = { steps:summary ? formatNumber(summary.steps.total) : '—',sleep:summary?.sleep.minutes != null ? t('units.hourValue',{value:formatNumber(summary.sleep.minutes/60,1)}) : '—',bmi:(summary?.weight.bmi == null ? undefined : formatNumber(summary?.weight.bmi,1)) ?? '—',nutrition:summary ? formatNumber(summary.nutrition.calories,0) : '—',calories:t("common.unavailable"),heart:t("common.comingSoon"),cycle:t("common.comingSoon"),'double-support':t("common.unavailable") };
  const healthMetrics = metricDefinitions.map(metric => ({ ...metric,value:values[metric.id] ?? '—',unit:['heart','cycle','calories','double-support'].includes(metric.id) ? '' : metric.unit }));
  return (
    <View style={styles.container}>
      <AppHeader title={t("health.data")} showBack={true} />
      <ScreenContainer scrollable={true} padded={true}>
        <DataFeedback {...query} />
        {/* Intro Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headline}>{t("health.allMetrics")}</Text>
          <Text style={styles.subheadline}>
            {t("health.dataDescription")}</Text>
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
            {t("health.dataHint")}</Text>
        </View>
      </ScreenContainer>
    </View>
  );
}

const baseStyles = StyleSheet.create({
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
