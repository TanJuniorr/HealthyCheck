import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../src/i18n/formatting';
import { localizeMessage,localizeStaticData } from '../../src/i18n/localize';
import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing, Radius, Shadows } from '../../src/constants/spacing';
import { AppHeader } from '../../src/components/common/AppHeader';
import { PrimaryButton } from '../../src/components/common/Buttons';
import { fetchFoods } from '../../src/lib/healthData';
import { useHealthQuery } from '../../src/hooks/useHealthQuery';
import { addMealItems, deleteMealRecord, getMealsByDateRange, updateMealRecord } from '../../src/services/mealsService';
import { calculateFoodNutrition } from '../../src/lib/healthCalculations';
import { safeNumber } from '../../src/lib/dataValidation';
import { dataError } from '../../src/lib/dataErrors';
import type { MealType } from '../../src/types/database';
import type { MealWithFood } from '../../src/types/health';
import { parseLocalDate, toLocalDateKey } from '../../src/lib/dateUtils';

const rawMEAL_TYPES = [
  { id: 'breakfast', label: "meals.breakfast", icon: 'sunny-outline' },
  { id: 'lunch', label: "meals.lunch", icon: 'partly-sunny-outline' },
  { id: 'dinner', label: "meals.dinner", icon: 'moon-outline' },
  { id: 'snack', label: "meals.snack", icon: 'cafe-outline' },
];
const normalizeSearch = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,character => character === 'Đ' ? 'D' : 'd').toLocaleLowerCase();
const EMPTY_ROWS: MealWithFood[] = [];
const EMPTY_ITEMS: Record<string,number> = {};

export default function AddMealScreen() {
  const { t } = useTranslation();
  const MEAL_TYPES = localizeStaticData(rawMEAL_TYPES);

  const router = useRouter();
  const params = useLocalSearchParams<{ mealType?: string; date?: string }>();
  const insets = useSafeAreaInsets();
  const today = toLocalDateKey();
  const dateParam = typeof params.date === 'string' ? params.date : today;
  const mealDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const requestedMealType = ['breakfast','lunch','dinner','snack'].includes(params.mealType ?? '') ? params.mealType as MealType : 'dinner';
  const [selectedMealType, setSelectedMealType] = useState<MealType>(requestedMealType);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftState,setDraftState] = useState<{ date:string; values:Record<MealType,Record<string,number>> } | null>(null);
  const existingMeals = useHealthQuery(() => getMealsByDateRange(mealDate,mealDate),'meal-editor:'+mealDate);
  const savedRows = existingMeals.data ?? EMPTY_ROWS;
  const savedDrafts = useMemo(() => {
    const next: Record<MealType,Record<string,number>> = { breakfast:{},lunch:{},dinner:{},snack:{} };
    for (const row of savedRows) next[row.meal_type][row.food_id] = (next[row.meal_type][row.food_id] ?? 0) + safeNumber(row.quantity_g);
    return next;
  },[savedRows]);
  const drafts = draftState?.date === mealDate ? draftState.values : savedDrafts;
  const selectedItems = drafts[selectedMealType] ?? EMPTY_ITEMS;
  const setSelectedItems = (update: (items:Record<string,number>) => Record<string,number>) => {
    setDraftState(previous => {
      const values = previous?.date === mealDate ? previous.values : savedDrafts;
      return { date:mealDate,values:{ ...values,[selectedMealType]:update(values[selectedMealType] ?? {}) } };
    });
  };
  const catalogue = useHealthQuery(fetchFoods,'food-catalogue');
  const foods = useMemo(() => catalogue.data ?? [],[catalogue.data]);
  const isLoadingFoods = catalogue.isLoading;
  const foodsError = catalogue.error;
  const loadFoods = catalogue.refresh;
  const [saving,setSaving] = useState(false);
  const [saveError,setSaveError] = useState('');
  const pending = useRef(false);
  // Match Vietnamese names whether or not the search text contains accents.
  const filteredFoods = useMemo(() => {
    const query = normalizeSearch(searchQuery.trim());
    if (!query) return foods;

    return foods.filter((food) =>
      normalizeSearch(food.name).includes(query) ||
      normalizeSearch(food.serving_size ?? '').includes(query) ||
      normalizeSearch(food.category ?? '').includes(query)
    );
  }, [foods, searchQuery]);

  // Add or increment item
  const handleAddItem = (name: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [name]: (prev[name] || 0) + 100,
    }));
  };

  // Decrement or remove item
  const handleRemoveItem = (name: string) => {
    setSelectedItems((prev) => {
      const current = prev[name] || 0;
      if (current <= 100) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: current - 100 };
    });
  };

  // Calculate totals
  const totalCalories = useMemo(() => {
    return Object.entries(selectedItems).reduce((sum, [name, qty]) => {
      const food = foods.find((f) => f.id === name);
      return sum + (food && qty > 0 ? calculateFoodNutrition(food,qty).calories : 0);
    }, 0);
  }, [selectedItems, foods]);

  const totalCount = useMemo(() => {
    return Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
  }, [selectedItems]);

  const handleLogMeal = async () => {
    if (pending.current) return; pending.current = true; setSaving(true); setSaveError('');
    try {
      if (existingMeals.isLoading || existingMeals.data === null || existingMeals.error) {
        setSaveError(existingMeals.error ? localizeMessage(existingMeals.error) : t('meals.waitForExisting'));
        return;
      }
      const existingByFood = new Map<string,typeof savedRows>();
      for (const row of savedRows.filter(item => item.meal_type === selectedMealType)) {
        const group = existingByFood.get(row.food_id) ?? [];
        group.push(row);
        existingByFood.set(row.food_id,group);
      }
      const actions: Promise<unknown>[] = [];
      const newItems: { food_id:string;quantity_g:number;meal_type:MealType;consumed_at:string }[] = [];
      const consumedAtDate = parseLocalDate(mealDate);
      consumedAtDate.setHours(12,0,0,0);
      for (const [food_id,rows] of existingByFood) {
        const quantity = selectedItems[food_id] ?? 0;
        if (quantity <= 0) rows.forEach(row => actions.push(deleteMealRecord(row.id)));
        else {
          actions.push(updateMealRecord(rows[0].id,{ quantity_g:quantity }));
          rows.slice(1).forEach(row => actions.push(deleteMealRecord(row.id)));
        }
      }
      for (const [food_id,quantity_g] of Object.entries(selectedItems)) {
        if (quantity_g > 0 && !existingByFood.has(food_id)) newItems.push({ food_id,quantity_g,meal_type:selectedMealType,consumed_at:consumedAtDate.toISOString() });
      }
      await Promise.all(actions);
      if (newItems.length) await addMealItems(newItems);
      router.back();
    } catch (error) { setSaveError(dataError(error).message); }
    finally { pending.current = false; setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t("meals.add")} showBack />

      {/* Meal Type Selector Tabs */}
      <View style={styles.mealTypeBar}>
        {MEAL_TYPES.map((type) => {
          const isSelected = selectedMealType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.mealTypeTab, isSelected && styles.mealTypeTabSelected]}
              onPress={() => setSelectedMealType(type.id as MealType)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={type.icon as any}
                size={16}
                color={isSelected ? Colors.primary : Colors.textMuted}
              />
              <Text
                style={[styles.mealTypeLabel, isSelected && styles.mealTypeLabelSelected]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Input Container */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("meals.search")}
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Food Items List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.listHeaderRow}>
          <Text style={styles.listSectionTitle}>{t("meals.quickFoods")}</Text>
          <Text style={styles.itemCountText}>{t('units.items',{count:filteredFoods.length,value:formatNumber(filteredFoods.length)})}</Text>
        </View>

        {isLoadingFoods ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-download-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("meals.loading")}</Text>
            <Text style={styles.emptySubtitle}>{t("meals.loadingDescription")}</Text>
          </View>
        ) : foodsError ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("meals.loadError")}</Text>
            <Text style={styles.emptySubtitle}>{localizeMessage(foodsError)}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => void loadFoods()}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
              <Text style={styles.addButtonText}>{t("common.retry")}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredFoods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {foods.length === 0 ? t("meals.emptyCatalogue") : t("meals.emptySearch")}
            </Text>
            <Text style={styles.emptySubtitle}>
              {foods.length === 0
                ? t("meals.catalogueHint")
                : t("meals.searchHint")}
            </Text>
          </View>
        ) : (
          filteredFoods.map((item) => {
            const qty = selectedItems[item.id] || 0;
            const isSelected = qty > 0;

            return (
              <View key={item.id} style={styles.foodRow}>
                <View style={styles.foodIconWrapper}>
                  <Ionicons name="nutrition-outline" size={20} color={Colors.orange} />
                </View>

                <View style={styles.foodInfo}>
                  <Text style={styles.foodName}>{item.name}</Text>
                  <Text style={styles.foodServing}>
                    {t("meals.addQuantity")}{' '}
                    <Text style={styles.foodCalories}>
                      {formatNumber(safeNumber(item.calories_per_100g))} {t("meals.caloriesPer100")}</Text>
                  </Text>
                </View>

                {isSelected ? (
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => handleRemoveItem(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove" size={16} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <TextInput style={[styles.stepperCount,{ minWidth:50 }]} accessibilityLabel={t('meals.gramsLabel',{name:item.name})} keyboardType="numeric" value={String(qty)} onChangeText={text => { const grams = Number(text); if (Number.isFinite(grams) && grams >= 0) setSelectedItems(previous => ({ ...previous,[item.id]:grams })); }} />
                    <Text style={styles.stepperCount}>g</Text>
                    <TouchableOpacity
                      style={[styles.stepperButton, styles.stepperButtonAdd]}
                      onPress={() => handleAddItem(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add" size={16} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAddItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color={Colors.primary} />
                    <Text style={styles.addButtonText}>{t("common.add")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {existingMeals.error ? <TouchableOpacity accessibilityRole="button" onPress={() => void existingMeals.refresh()} style={{ padding:Spacing.md }}><Text accessibilityRole="alert" style={{ color:Colors.error }}>{localizeMessage(existingMeals.error)} · {t('common.retry')}</Text></TouchableOpacity> : null}
      {saveError ? <Text accessibilityRole="alert" style={{ color:Colors.error,padding:Spacing.md }}>{localizeMessage(saveError)}</Text> : null}
      {/* Floating Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={styles.summaryBar}>
          <View>
            <Text style={styles.summaryLabel}>{t("meals.totalSelected")}</Text>
            <Text style={styles.summaryValue}>
              {formatNumber(totalCalories,0)}{' '}
              <Text style={styles.summaryUnit}>kcal</Text>
              {totalCount > 0 && (
                <Text style={styles.summaryCount}> {t('units.gramTotal',{value:formatNumber(totalCount)})}</Text>
              )}
            </Text>
          </View>

          <PrimaryButton
            title={t('meals.logType',{meal:t(`meals.${selectedMealType.toLowerCase()}`)})}
            onPress={handleLogMeal}
            loading={saving}
            disabled={totalCount <= 0 || isLoadingFoods || !!foodsError || existingMeals.isLoading || existingMeals.data === null}
            style={styles.logButton}
         
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mealTypeBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  mealTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 6,
    backgroundColor: Colors.background,
  },
  mealTypeTabSelected: {
    backgroundColor: Colors.primaryLight,
  },
  mealTypeLabel: {
    ...Typography.labelSmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  mealTypeLabelSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.screenPadding,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  listSectionTitle: {
    ...Typography.sectionTitle,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  itemCountText: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  foodIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  foodServing: {
    ...Typography.supporting,
    color: Colors.textMuted,
  },
  foodCalories: {
    color: Colors.orange,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: '#D8F1EE',
  },
  addButtonText: {
    ...Typography.labelSmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonAdd: {
    backgroundColor: Colors.primary,
  },
  stepperCount: {
    ...Typography.label,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.cardTitle,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screenPadding,
    ...Shadows.lg,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.labelSmall,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  summaryValue: {
    ...Typography.cardTitle,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.orange,
  },
  summaryUnit: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  summaryCount: {
    ...Typography.supporting,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  logButton: {
    minWidth: 150,
  },
});
