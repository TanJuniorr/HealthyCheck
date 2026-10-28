import { useTranslation } from 'react-i18next';
import { formatNumber,formatTime,formatDate } from '../../src/i18n/formatting';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { AppHeader, SectionHeader } from '../../src/components/common/AppHeader';
import { ScreenContainer } from '../../src/components/common/ScreenContainer';
import { PrimaryButton } from '../../src/components/common/Buttons';
import { ProgressRing, ProgressBar } from '../../src/components/charts/ProgressRing';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { getMealsByDate } from '../../src/services/mealsService';
import { toLocalDateKey } from '../../src/lib/dateUtils';
import { getCurrentGoals } from '../../src/services/healthGoalsService';
import { aggregateNutrition, calculateFoodNutrition } from '../../src/lib/healthCalculations';
import { safeNumber } from '../../src/lib/dataValidation';
import { DataFeedback } from '../../src/components/common/DataFeedback';
import { CalendarDatePicker } from '../../src/components/common/CalendarDatePicker';

export default function NutritionScreen() {
  const { t } = useTranslation();

  const router = useRouter();
  const [selectedDate,setSelectedDate] = useState(toLocalDateKey());
  const [calendarVisible,setCalendarVisible] = useState(false);
  const query = useHealthQuery(async () => { const [rows,goals] = await Promise.all([getMealsByDate(selectedDate),getCurrentGoals(selectedDate)]); return { rows,summary:aggregateNutrition(rows,selectedDate,selectedDate,goals?.daily_calories ?? null) }; },'nutrition-screen:'+selectedDate);
  const summary = query.data?.summary;
  const nutritionData = { caloriesGoal:summary?.calorieGoal ?? 0,caloriesConsumed:summary?.calories ?? 0,progress:(summary?.progressPercent ?? 0)/100,protein:{ current:summary?.protein ?? 0,goal:0,color:Colors.primary },carbs:{ current:summary?.carbs ?? 0,goal:0,color:Colors.blue },fat:{ current:summary?.fat ?? 0,goal:0,color:Colors.orange } };
  const meals = (['breakfast','lunch','dinner','snack'] as const).map(type => { const rows = query.data?.rows.filter(row => row.meal_type === type) ?? []; return { id:type,type:t(`meals.${type}`),icon:'restaurant-outline',time:rows.length ? formatTime(new Date(rows[0].consumed_at),{ hour:'2-digit',minute:'2-digit' }) : '',totalCalories:formatNumber(summary?.byMealType[type].calories,0) ?? '—',items:rows.map(row => ({ name:row.food?.name ?? t("nutrition.unavailableFood"),quantity:formatNumber(safeNumber(row.quantity_g)),calories:row.food ? formatNumber(calculateFoodNutrition(row.food,safeNumber(row.quantity_g)).calories,0) : '—' })) }; });
  const caloriesRemaining = Math.max(0, nutritionData.caloriesGoal - nutritionData.caloriesConsumed);

  const handleAddMeal = (mealType = 'dinner') => {
    router.push({ pathname:'/meals/add' as any,params:{ mealType,date:selectedDate } });
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t("health.nutrition")} showBack rightIcon="calendar-outline" rightAccessibilityLabel="calendar.chooseDate" onRightPress={() => setCalendarVisible(true)} />
      <Text style={styles.selectedDate}>{formatDate(selectedDate)}</Text>

      <ScreenContainer>
        <DataFeedback {...query} empty={summary?.recordCount === 0} />
        {/* Calorie Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.ringSection}>
            <ProgressRing
              progress={nutritionData.progress}
              size={168}
              strokeWidth={14}
              color={Colors.orange}
              trackColor={Colors.orangeLight}
            >
              <View style={styles.ringContent}>
                <Ionicons name="flame" size={22} color={Colors.orange} style={styles.flameIcon} />
                <Text style={styles.ringValue}>
                  {summary ? formatNumber(nutritionData.caloriesConsumed,0) : '—'}
                </Text>
                <Text style={styles.ringSubtext}>{t("nutrition.consumedUnit")}</Text>
                <View style={styles.goalPill}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.ringGoal}>{t("nutrition.goalPrefix")}{' '}{formatNumber(nutritionData.caloriesGoal)} kcal</Text>
                </View>
              </View>
            </ProgressRing>
          </View>

          {/* Calorie Breakdown Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{t("nutrition.consumed")}</Text>
              <Text style={[styles.metricValue, { color: Colors.orange }]}>
                {nutritionData.caloriesConsumed} <Text style={styles.metricUnit}>kcal</Text>
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{t("nutrition.remaining")}</Text>
              <Text style={[styles.metricValue, { color: Colors.primaryDark }]}>
                {summary?.calorieGoal != null ? formatNumber(caloriesRemaining,0) : '—'} <Text style={styles.metricUnit}>kcal</Text>
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{t("nutrition.dailyTarget")}</Text>
              <Text style={[styles.metricValue, { color: Colors.textPrimary }]}>
                {formatNumber(summary?.calorieGoal)} <Text style={styles.metricUnit}>kcal</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Macronutrients Section */}
        <SectionHeader title={t("nutrition.macros")} />

        <View style={styles.card}>
          {/* Protein */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <View style={styles.macroTitleRow}>
                <View style={[styles.macroDot, { backgroundColor: nutritionData.protein.color }]} />
                <Text style={styles.macroName}>{t("nutrition.protein")}</Text>
              </View>
              <Text style={styles.macroValues}>
                <Text style={styles.macroCurrent}>{summary ? formatNumber(nutritionData.protein.current,1) : '—'}g</Text>
                <Text style={styles.macroGoal}> {' '}{t("nutrition.noMacroTarget")}</Text>
              </Text>
            </View>
            <ProgressBar
              progress={0}
              color={nutritionData.protein.color}
              trackColor={Colors.primaryLight}
              height={8}
              showLabel={false}
            />
          </View>

          {/* Carbs */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <View style={styles.macroTitleRow}>
                <View style={[styles.macroDot, { backgroundColor: nutritionData.carbs.color }]} />
                <Text style={styles.macroName}>{t("nutrition.carbs")}</Text>
              </View>
              <Text style={styles.macroValues}>
                <Text style={styles.macroCurrent}>{summary ? formatNumber(nutritionData.carbs.current,1) : '—'}g</Text>
                <Text style={styles.macroGoal}> {' '}{t("nutrition.noMacroTarget")}</Text>
              </Text>
            </View>
            <ProgressBar
              progress={0}
              color={nutritionData.carbs.color}
              trackColor={Colors.blueLight}
              height={8}
              showLabel={false}
            />
          </View>

          {/* Fat */}
          <View style={[styles.macroBlock, styles.macroBlockLast]}>
            <View style={styles.macroHeader}>
              <View style={styles.macroTitleRow}>
                <View style={[styles.macroDot, { backgroundColor: nutritionData.fat.color }]} />
                <Text style={styles.macroName}>{t("nutrition.fat")}</Text>
              </View>
              <Text style={styles.macroValues}>
                <Text style={styles.macroCurrent}>{summary ? formatNumber(nutritionData.fat.current,1) : '—'}g</Text>
                <Text style={styles.macroGoal}> {' '}{t("nutrition.noMacroTarget")}</Text>
              </Text>
            </View>
            <ProgressBar
              progress={0}
              color={nutritionData.fat.color}
              trackColor={Colors.orangeLight}
              height={8}
              showLabel={false}
            />
          </View>
        </View>

        {/* Meals Section */}
        <SectionHeader
          title={t("nutrition.mealsForDate",{date:formatDate(selectedDate)})}
          actionText={t("nutrition.quickAdd")}
          onAction={() => handleAddMeal('dinner')}
        />

        <View style={styles.mealsContainer}>
          {meals.map((meal) => {
            const isLogged = meal.items && meal.items.length > 0;

            return (
              <TouchableOpacity key={meal.id} style={styles.mealCard} onPress={() => handleAddMeal(meal.id)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('nutrition.editMeal',{meal:meal.type})}>
                <View style={styles.mealHeader}>
                  <View style={styles.mealHeaderLeft}>
                    <View
                      style={[
                        styles.mealIconWrapper,
                        { backgroundColor: isLogged ? Colors.orangeLight : Colors.divider },
                      ]}
                    >
                      <Ionicons
                        name={meal.icon as any}
                        size={20}
                        color={isLogged ? Colors.orange : Colors.textMuted}
                      />
                    </View>
                    <View>
                      <Text style={styles.mealTitle}>{meal.type}</Text>
                      <Text style={styles.mealTime}>
                        {isLogged ? meal.time : t("nutrition.scheduled")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mealHeaderRight}>
                    {isLogged ? (
                      <View style={styles.mealCalorieBadge}>
                        <Text style={styles.mealCalorieText}>{meal.totalCalories}</Text>
                        <Text style={styles.mealCalorieUnit}> kcal</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.logNowBadge}
                        onPress={() => handleAddMeal(meal.id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={t(isLogged ? 'common.edit' : 'nutrition.log') + ` ${meal.type}`}
                      >
                        <Ionicons name={isLogged ? 'create-outline' : 'add'} size={14} color={Colors.primary} />
                        <Text style={styles.logNowText}>{t(isLogged ? 'common.edit' : 'nutrition.log')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {isLogged ? (
                  <View style={styles.mealItemsList}>
                    {meal.items.map((item, idx) => (
                      <View
                        key={`${item.name}-${idx}`}
                        style={[
                          styles.mealItemRow,
                          idx === meal.items.length - 1 && styles.mealItemRowLast,
                        ]}
                      >
                        <View style={styles.mealItemBullet} />
                        <Text style={styles.mealItemName}>{item.name} · {item.quantity} g</Text>
                        <Text style={styles.mealItemCalories}>{item.calories} kcal</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.unloggedContainer}>
                    <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                    <Text style={styles.unloggedText}>{t("nutrition.notLogged")}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Action Button */}
        <View style={styles.actionContainer}>
          <PrimaryButton
            title={t("meals.add")}
            onPress={() => handleAddMeal('dinner')}
            style={styles.addButton}
          />
        </View>
      </ScreenContainer>
      <CalendarDatePicker key={`${calendarVisible}-${selectedDate}`} visible={calendarVisible} date={selectedDate} title={t('calendar.chooseDate')} onClose={() => setCalendarVisible(false)} onSelect={value => { setSelectedDate(value); setCalendarVisible(false); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  selectedDate: { ...Typography.supporting, color:Colors.textMuted, backgroundColor:Colors.white, paddingHorizontal:Spacing.screenPadding, paddingVertical:Spacing.sm },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginTop: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ringSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  ringContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameIcon: {
    marginBottom: 2,
  },
  ringValue: {
    ...Typography.statLarge,
    fontSize: 30,
    lineHeight: 34,
    color: Colors.textPrimary,
  },
  ringSubtext: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  goalPill: {
    marginTop: 6,
    backgroundColor: Colors.orangeLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  ringGoal: {
    ...Typography.labelSmall,
    fontSize: 10,
    color: Colors.orange,
    fontWeight: '600',
    maxWidth: 112,
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    ...Typography.cardTitle,
    fontSize: 17,
    fontWeight: '700',
  },
  metricUnit: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  metricDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  macroBlock: {
    marginBottom: Spacing.lg,
  },
  macroBlockLast: {
    marginBottom: 0,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  macroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  macroName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  macroValues: {
    ...Typography.label,
  },
  macroCurrent: {
    ...Typography.label,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  macroGoal: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  mealsContainer: {
    gap: Spacing.md,
  },
  mealCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mealIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  mealTime: {
    ...Typography.supporting,
    color: Colors.textMuted,
    marginTop: 2,
  },
  mealHeaderRight: {
    alignItems: 'flex-end',
  },
  mealCalorieBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: Colors.orangeLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  mealCalorieText: {
    ...Typography.label,
    fontWeight: '700',
    color: Colors.orange,
  },
  mealCalorieUnit: {
    ...Typography.labelSmall,
    color: Colors.orange,
    fontSize: 10,
  },
  logNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  logNowText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  mealItemsList: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: Spacing.sm,
  },
  mealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealItemRowLast: {},
  mealItemBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.textMuted,
    marginRight: Spacing.sm,
  },
  mealItemName: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    flex: 1,
  },
  mealItemCalories: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  unloggedContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  unloggedText: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  addButton: {
    backgroundColor: Colors.orange,
  },
});
