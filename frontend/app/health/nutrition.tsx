import React from 'react';
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
import { nutritionData, meals } from '../../src/data/nutrition';

export default function NutritionScreen() {
  const router = useRouter();

  const caloriesRemaining = Math.max(0, nutritionData.caloriesGoal - nutritionData.caloriesConsumed);

  const handleAddMeal = () => {
    router.push('/meals/add');
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Nutrition" showBack />

      <ScreenContainer>
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
                  {nutritionData.caloriesConsumed.toLocaleString()}
                </Text>
                <Text style={styles.ringSubtext}>kcal consumed</Text>
                <View style={styles.goalPill}>
                  <Text style={styles.ringGoal}>Goal: {nutritionData.caloriesGoal.toLocaleString()} kcal</Text>
                </View>
              </View>
            </ProgressRing>
          </View>

          {/* Calorie Breakdown Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Consumed</Text>
              <Text style={[styles.metricValue, { color: Colors.orange }]}>
                {nutritionData.caloriesConsumed} <Text style={styles.metricUnit}>kcal</Text>
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Remaining</Text>
              <Text style={[styles.metricValue, { color: Colors.primaryDark }]}>
                {caloriesRemaining} <Text style={styles.metricUnit}>kcal</Text>
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Daily Target</Text>
              <Text style={[styles.metricValue, { color: Colors.textPrimary }]}>
                {nutritionData.caloriesGoal} <Text style={styles.metricUnit}>kcal</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Macronutrients Section */}
        <SectionHeader title="Macronutrients" />

        <View style={styles.card}>
          {/* Protein */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <View style={styles.macroTitleRow}>
                <View style={[styles.macroDot, { backgroundColor: nutritionData.protein.color }]} />
                <Text style={styles.macroName}>Protein</Text>
              </View>
              <Text style={styles.macroValues}>
                <Text style={styles.macroCurrent}>{nutritionData.protein.current}g</Text>
                <Text style={styles.macroGoal}> / {nutritionData.protein.goal}g</Text>
              </Text>
            </View>
            <ProgressBar
              progress={nutritionData.protein.current / nutritionData.protein.goal}
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
                <Text style={styles.macroName}>Carbohydrates</Text>
              </View>
              <Text style={styles.macroValues}>
                <Text style={styles.macroCurrent}>{nutritionData.carbs.current}g</Text>
                <Text style={styles.macroGoal}> / {nutritionData.carbs.goal}g</Text>
              </Text>
            </View>
            <ProgressBar
              progress={nutritionData.carbs.current / nutritionData.carbs.goal}
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
                <Text style={styles.macroName}>Fat</Text>
              </View>
              <Text style={styles.macroValues}>
                <Text style={styles.macroCurrent}>{nutritionData.fat.current}g</Text>
                <Text style={styles.macroGoal}> / {nutritionData.fat.goal}g</Text>
              </Text>
            </View>
            <ProgressBar
              progress={nutritionData.fat.current / nutritionData.fat.goal}
              color={nutritionData.fat.color}
              trackColor={Colors.orangeLight}
              height={8}
              showLabel={false}
            />
          </View>
        </View>

        {/* Meals Section */}
        <SectionHeader
          title="Today's Meals"
          actionText="+ Quick Add"
          onAction={handleAddMeal}
        />

        <View style={styles.mealsContainer}>
          {meals.map((meal) => {
            const isLogged = meal.items && meal.items.length > 0;

            return (
              <View key={meal.id} style={styles.mealCard}>
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
                        {isLogged ? meal.time : 'Scheduled'}
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
                        onPress={handleAddMeal}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={14} color={Colors.primary} />
                        <Text style={styles.logNowText}>Log</Text>
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
                        <Text style={styles.mealItemName}>{item.name}</Text>
                        <Text style={styles.mealItemCalories}>{item.calories} kcal</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.unloggedContainer}>
                    <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                    <Text style={styles.unloggedText}>Not yet logged</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Bottom Action Button */}
        <View style={styles.actionContainer}>
          <PrimaryButton
            title="Add Meal"
            onPress={handleAddMeal}
            style={styles.addButton}
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
