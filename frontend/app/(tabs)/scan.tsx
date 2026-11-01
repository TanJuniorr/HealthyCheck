import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/common/AppHeader';
import { PrimaryButton } from '../../src/components/common/Buttons';
import { Colors } from '../../src/constants/colors';
import { Radius, Shadows, Spacing } from '../../src/constants/spacing';
import { Typography } from '../../src/constants/typography';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemedStyles } from '../../src/contexts/ThemeContext';
import { calculateFoodNutrition } from '../../src/lib/healthCalculations';
import { dataError } from '../../src/lib/dataErrors';
import { foodName } from '../../src/lib/foodPortions';
import { formatNumber } from '../../src/i18n/formatting';
import { addMealItems } from '../../src/services/mealsService';
import { createPersonalEstimatedFood, searchFoods } from '../../src/services/foodsService';
import { FoodScanError, scanFoodPhoto, type FoodScanEstimate } from '../../src/services/foodScanService';
import type { FoodRow, MealType } from '../../src/types/database';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MAX_IMAGE_BASE64_LENGTH = 5_500_000;

type ReviewItem = FoodScanEstimate & {
  gramsText: string;
  query: string;
  candidates: FoodRow[];
  selectedFoodId: string | null;
  searching: boolean;
  showQuickCreate: boolean;
  creatingCustomFood: boolean;
  caloriesPer100gText: string;
  proteinPer100gText: string;
  carbsPer100gText: string;
  fatPer100gText: string;
};

type PickedPhoto = { uri: string; base64: string };

function mealTypeForNow(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snack';
  return 'dinner';
}

function LiveCameraCapture({
  disabled,
  onCaptured,
  onError,
}: {
  disabled: boolean;
  onCaptured: (photo: PickedPhoto) => void;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(baseStyles);
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const capture = async () => {
    if (!cameraReady || capturing || disabled || !cameraRef.current) return;
    setCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.55, base64: true, exif: false });
      if (!picture.base64 || picture.base64.length > MAX_IMAGE_BASE64_LENGTH) {
        onError();
        return;
      }
      onCaptured({ uri: picture.uri, base64: picture.base64 });
    } catch {
      onError();
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      <CameraView
        ref={cameraRef}
        style={styles.cameraPreview}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
        onMountError={onError}
      />
      <View pointerEvents="none" style={styles.cameraHint}>
        <Text style={styles.cameraHintText}>{t('foodScan.cameraHint')}</Text>
      </View>
      <View style={styles.cameraControls}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('foodScan.takePhoto')}
          accessibilityState={{ disabled: !cameraReady || capturing || disabled, busy: capturing }}
          disabled={!cameraReady || capturing || disabled}
          onPress={() => void capture()}
          style={[styles.shutterOuter, (!cameraReady || capturing || disabled) && styles.shutterDisabled]}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function FoodScanTab() {
  const { user } = useAuth();
  return user ? <FoodScanScreen key={user.id} /> : null;
}

function FoodScanScreen() {
  const styles = useThemedStyles(baseStyles);
  const { t, i18n } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const language = i18n.resolvedLanguage ?? 'vi';
  const router = useRouter();
  const isFocused = useIsFocused();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [mealType, setMealType] = useState<MealType>(mealTypeForNow);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const requestId = useRef(0);
  const catalogSearchIds = useRef<Record<number, number>>({});
  const requestedPermissionForFocus = useRef(false);
  const lock = useRef(false);

  const selectedCount = items.filter(item => item.selectedFoodId !== null).length;
  const creatingFood = items.some(item => item.creatingCustomFood);
  const cameraHeight = Math.max(380, Math.min(650, Math.floor(windowHeight * 0.75)));

  useEffect(() => {
    if (!isFocused) {
      requestedPermissionForFocus.current = false;
      return;
    }
    if (!cameraPermission || cameraPermission.granted || requestedPermissionForFocus.current) return;
    requestedPermissionForFocus.current = true;
    void requestCameraPermission();
  }, [cameraPermission, isFocused, requestCameraPermission]);

  const setPickedPhoto = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64 || asset.base64.length > MAX_IMAGE_BASE64_LENGTH) {
      setError(t('foodScan.imageTooLarge'));
      return;
    }
    requestId.current += 1;
    catalogSearchIds.current = {};
    setPhoto({ uri: asset.uri, base64: asset.base64 });
    setItems([]);
    setSaved(false);
    setSavedNotice(false);
    setError(null);
    setNotice(null);
  };

  const retakePhoto = () => {
    requestId.current += 1;
    catalogSearchIds.current = {};
    setPhoto(null);
    setItems([]);
    setSaved(false);
    setSavedNotice(false);
    setError(null);
    setNotice(null);
  };

  const choosePhoto = async () => {
    if (analyzing || saving) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.55,
        base64: true,
        exif: false,
      });
      setPickedPhoto(result);
    } catch {
      setError(t('foodScan.photoError'));
    }
  };

  const loadCatalogMatches = async (index: number, query: string, fallbackQuery = '') => {
    const scanRequest = requestId.current;
    const searchRequest = (catalogSearchIds.current[index] ?? 0) + 1;
    catalogSearchIds.current[index] = searchRequest;
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, searching: true } : item));
    try {
      let matches = (await searchFoods(query, { pageSize: 6 })).data;
      if (!matches.length && fallbackQuery && fallbackQuery.toLocaleLowerCase() !== query.toLocaleLowerCase()) {
        matches = (await searchFoods(fallbackQuery, { pageSize: 6 })).data;
      }
      if (requestId.current !== scanRequest || catalogSearchIds.current[index] !== searchRequest) return;
      setItems(current => current.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        candidates: matches,
        selectedFoodId: matches.length === 1 ? matches[0].id : null,
        searching: false,
      } : item));
      setSaved(false);
      setSavedNotice(false);
    } catch {
      if (requestId.current === scanRequest && catalogSearchIds.current[index] === searchRequest) {
        setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, candidates: [], searching: false } : item));
      }
    }
  };

  const analyze = async () => {
    if (!photo || analyzing || saving) return;
    const id = ++requestId.current;
    catalogSearchIds.current = {};
    setAnalyzing(true);
    setError(null);
    setNotice(null);
    setItems([]);
    setSaved(false);
    setSavedNotice(false);
    try {
      const result = await scanFoodPhoto(photo.base64);
      if (requestId.current !== id) return;
      if (!result.is_food || !result.items.length) {
        setError(t('foodScan.notFood'));
        return;
      }
      const reviews: ReviewItem[] = result.items.map(item => ({
        ...item,
        gramsText: String(item.estimated_grams),
        query: item.name_vi,
        candidates: [],
        selectedFoodId: null,
        searching: true,
        showQuickCreate: false,
        creatingCustomFood: false,
        caloriesPer100gText: String(item.calories_per_100g ?? (item.estimated_grams > 0 ? item.estimated_kcal * 100 / item.estimated_grams : item.estimated_kcal)),
        proteinPer100gText: String(item.protein_per_100g ?? 0),
        carbsPer100gText: String(item.carbs_per_100g ?? 0),
        fatPer100gText: String(item.fat_per_100g ?? 0),
      }));
      setItems(reviews);
      await Promise.all(reviews.map(async (item, index) => {
        const searchRequest = 1;
        catalogSearchIds.current[index] = searchRequest;
        try {
          let matches = (await searchFoods(item.name_vi, { pageSize: 6 })).data;
          if (!matches.length && item.name_en) matches = (await searchFoods(item.name_en, { pageSize: 6 })).data;
          if (requestId.current !== id || catalogSearchIds.current[index] !== searchRequest) return;
          setItems(current => current.map((currentItem, currentIndex) => currentIndex === index ? {
            ...currentItem,
            candidates: matches,
            selectedFoodId: matches.length === 1 ? matches[0].id : null,
            searching: false,
          } : currentItem));
        } catch {
          if (requestId.current === id && catalogSearchIds.current[index] === searchRequest) {
            setItems(current => current.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, searching: false } : currentItem));
          }
        }
      }));
    } catch (cause) {
      if (requestId.current === id) {
        const code = cause instanceof FoodScanError ? cause.code : null;
        const key = code === 'unauthenticated' ? 'errorUnauthenticated'
          : code === 'quota_exceeded' ? 'errorQuota'
            : code === 'not_configured' ? 'errorNotConfigured'
              : code === 'timeout' ? 'errorTimeout'
                : code === 'network' ? 'errorNetwork'
                  : code === 'image_too_large' ? 'imageTooLarge'
                    : 'errorFailed';
        setError(t(`foodScan.${key}`));
      }
    } finally {
      if (requestId.current === id) setAnalyzing(false);
    }
  };

  const updateItem = (index: number, changes: Partial<ReviewItem>) => {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
    setSaved(false);
    setSavedNotice(false);
    setError(null);
    setNotice(null);
  };

  const createQuickFood = async (index: number) => {
    const item = items[index];
    if (!item || item.creatingCustomFood) return;
    const numberFrom = (value: string) => Number(value.trim().replace(',', '.'));
    const nutritionText = [item.caloriesPer100gText, item.proteinPer100gText, item.carbsPer100gText, item.fatPer100gText];
    const nutrition = nutritionText.map(numberFrom);
    if (!item.name_vi.trim() || !item.name_en.trim()) {
      setError(t('foodScan.requiredBilingualNames'));
      return;
    }
    if (nutritionText.some(value => !value.trim())
      || nutrition.some(value => !Number.isFinite(value) || value < 0)
      || nutrition[0] > 1000 || nutrition.slice(1).some(value => value > 100)) {
      setError(t('foodScan.invalidEstimatedNutrition'));
      return;
    }

    setError(null);
    setNotice(null);
    updateItem(index, { creatingCustomFood: true });
    try {
      const food = await createPersonalEstimatedFood({
        name_vi: item.name_vi,
        name_en: item.name_en,
        calories_per_100g: nutrition[0],
        protein_per_100g: nutrition[1],
        carbs_per_100g: nutrition[2],
        fat_per_100g: nutrition[3],
      });
      setItems(current => current.map((currentItem, itemIndex) => itemIndex === index ? {
        ...currentItem,
        candidates: [food],
        selectedFoodId: food.id,
        query: item.name_vi,
        showQuickCreate: false,
        creatingCustomFood: false,
      } : currentItem));
      setSaved(false);
      setSavedNotice(false);
      setNotice(t('foodScan.customFoodAdded'));
    } catch (cause) {
      setItems(current => current.map((currentItem, itemIndex) => itemIndex === index ? { ...currentItem, creatingCustomFood: false } : currentItem));
      setError(dataError(cause).message || t('foodScan.saveError'));
    }
  };

  const save = async () => {
    if (lock.current || !selectedCount || saving || creatingFood) {
      if (!selectedCount) setError(t('foodScan.selectAtLeastOne'));
      return;
    }
    const chosenItems = items.filter(item => item.selectedFoodId !== null);
    const invalidServing = chosenItems.some(item => {
      const grams = Number(item.gramsText.replace(',', '.'));
      return !Number.isFinite(grams) || grams < 1 || grams > 3000;
    });
    if (invalidServing) {
      setError(t('foodScan.invalidGrams'));
      return;
    }
    const consumedAt = new Date().toISOString();
    const selected = chosenItems.flatMap(item => {
      const food = item.candidates.find(candidate => candidate.id === item.selectedFoodId);
      const quantity = Number(item.gramsText.replace(',', '.'));
      return food ? [{ food_id: food.id, quantity_g: quantity, meal_type: mealType, consumed_at: consumedAt }] : [];
    });
    if (!selected.length) {
      setError(t('foodScan.selectAtLeastOne'));
      return;
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await addMealItems(selected);
      setSaved(true);
      setSavedNotice(true);
    } catch (cause) {
      setError(dataError(cause).message || t('foodScan.saveError'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title={t('foodScan.title')} showBack={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.cameraCard, { height: cameraHeight }]}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.cameraPreview} resizeMode="cover" accessibilityLabel={t('foodScan.title')} />
          ) : isFocused && cameraPermission?.granted ? (
            <LiveCameraCapture
              disabled={analyzing || saving || creatingFood}
              onCaptured={captured => {
                requestId.current += 1;
                catalogSearchIds.current = {};
                setPhoto(captured);
                setItems([]);
                setSaved(false);
                setSavedNotice(false);
                setError(null);
                setNotice(null);
              }}
              onError={() => setError(t('foodScan.photoError'))}
            />
          ) : (
            <View style={styles.cameraPermissionPanel}>
              <Ionicons name="camera-outline" size={38} color={Colors.white} />
              <Text style={styles.cameraPermissionText}>
                {cameraPermission ? t('foodScan.cameraPermissionRequired') : t('foodScan.cameraStarting')}
              </Text>
              {cameraPermission && !cameraPermission.granted ? (
                <PrimaryButton title={t('foodScan.cameraPermissionAction')} onPress={() => void requestCameraPermission()} />
              ) : null}
            </View>
          )}
          {photo ? (
            <>
              <View pointerEvents="none" style={styles.cameraHint}>
                <Text style={styles.cameraHintText}>{t('foodScan.photoReady')}</Text>
              </View>
              <View style={styles.cameraControls}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('foodScan.retake')} onPress={retakePhoto} style={styles.retakeButton}>
                <Ionicons name="refresh-outline" size={22} color={Colors.white} />
                <Text style={styles.controlLabel}>{t('foodScan.retake')}</Text>
                </TouchableOpacity>
                <View style={styles.controlSpacer} />
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('foodScan.choosePhoto')} disabled={analyzing || saving} onPress={() => void choosePhoto()} style={styles.galleryButton}>
              <Ionicons name="images-outline" size={25} color={Colors.white} />
              <View style={styles.galleryPlus}><Ionicons name="add" size={12} color={Colors.primaryDark} /></View>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('foodScan.choosePhoto')} accessibilityState={{ disabled: analyzing || saving }} disabled={analyzing || saving} onPress={() => void choosePhoto()} style={styles.galleryButton}>
              <Ionicons name="images-outline" size={25} color={Colors.white} />
              <View style={styles.galleryPlus}><Ionicons name="add" size={12} color={Colors.primaryDark} /></View>
            </TouchableOpacity>
          )}
        </View>

        {photo ? (
          <PrimaryButton title={t(analyzing ? 'foodScan.analyzing' : 'foodScan.analyze')} onPress={analyze} loading={analyzing} disabled={saving || creatingFood} style={styles.analyzeButton} />
        ) : null}

        {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
        {notice ? <Text accessibilityRole="status" style={styles.noticeText}>{notice}</Text> : null}

        {items.length > 0 ? (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>{t('foodScan.results')}</Text>
            <Text style={styles.disclaimer}>{t('foodScan.estimateDisclaimer')}</Text>
            <Text style={styles.mealLabel}>{t('foodScan.selectMeal')}</Text>
            <View style={styles.mealPicker}>
              {MEAL_TYPES.map(type => (
                <TouchableOpacity key={type} accessibilityRole="button" accessibilityState={{ selected: mealType === type }} onPress={() => { setMealType(type); setSaved(false); setSavedNotice(false); setNotice(null); }} style={[styles.mealChip, mealType === type && styles.mealChipSelected]}>
                  <Text style={[styles.mealChipText, mealType === type && styles.mealChipTextSelected]}>{t(`meals.${type}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {items.map((item, index) => {
              const selectedFood = item.candidates.find(candidate => candidate.id === item.selectedFoodId) ?? null;
              const grams = Number(item.gramsText.replace(',', '.'));
              const catalogCalories = selectedFood && Number.isFinite(grams) && grams > 0
                ? calculateFoodNutrition(selectedFood, grams).calories
                : null;
              return (
                <View key={`${item.name_vi}-${index}`} style={styles.foodCard}>
                  <View style={styles.foodNameRow}>
                    <View style={styles.foodIcon}><Ionicons name="restaurant-outline" size={20} color={Colors.orange} /></View>
                    <View style={styles.foodHeading}>
                      <Text style={styles.foodName}>{language.startsWith('vi') ? item.name_vi : item.name_en}</Text>
                      <Text style={styles.estimateText}>{t('foodScan.approx', { grams: formatNumber(item.estimated_grams), calories: formatNumber(item.estimated_kcal) })}</Text>
                    </View>
                    <Text style={styles.confidence}>{t('foodScan.confidence', { value: Math.round(item.confidence * 100) })}</Text>
                  </View>
                  <View style={styles.gramsRow}>
                    <Text style={styles.fieldLabel}>{t('foodScan.grams')}</Text>
                    <TextInput
                      accessibilityLabel={t('foodScan.grams')}
                      value={item.gramsText}
                      onChangeText={value => updateItem(index, { gramsText: value.replace(/[^0-9.,]/g, '') })}
                      keyboardType="decimal-pad"
                      maxLength={6}
                      style={styles.gramsInput}
                    />
                  </View>
                  <Text style={styles.catalogLabel}>{t('foodScan.catalogTitle')}</Text>
                  <View style={styles.searchRow}>
                    <TextInput
                      accessibilityLabel={t('foodScan.catalogSearch')}
                      value={item.query}
                      onChangeText={value => updateItem(index, { query: value })}
                      onSubmitEditing={() => void loadCatalogMatches(index, item.query.trim() || item.name_vi, item.name_en)}
                      returnKeyType="search"
                      maxLength={120}
                      placeholder={t('foodScan.catalogSearch')}
                      placeholderTextColor={Colors.textMuted}
                      style={styles.searchInput}
                    />
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('foodScan.search')} disabled={item.searching || !item.query.trim()} onPress={() => void loadCatalogMatches(index, item.query.trim(), item.name_en)} style={styles.searchButton}>
                      <Ionicons name="search" size={19} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                  {item.searching ? <Text style={styles.loadingText}>{t('common.loading')}</Text> : null}
                  {!item.searching && !item.candidates.length ? <Text style={styles.noMatch}>{t('foodScan.searchNoResults')}</Text> : null}
                  <View style={styles.candidates}>
                    {item.candidates.map(food => {
                      const isSelected = item.selectedFoodId === food.id;
                      const foodCalories = calculateFoodNutrition(food, Number.isFinite(grams) && grams > 0 ? grams : item.estimated_grams).calories;
                      return (
                        <TouchableOpacity key={food.id} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => updateItem(index, { selectedFoodId: food.id })} style={[styles.candidate, isSelected && styles.candidateSelected]}>
                          <View style={styles.candidateCopy}>
                            <Text style={styles.candidateName}>{foodName(food, language)}</Text>
                            <Text style={styles.candidateCalories}>{t('foodScan.catalogCalories', { calories: formatNumber(foodCalories, 1) })}</Text>
                          </View>
                          <Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={isSelected ? Colors.primary : Colors.textMuted} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {selectedFood && catalogCalories !== null ? <Text style={styles.selectedKcal}>{t('foodScan.catalogCalories', { calories: formatNumber(catalogCalories, 1) })}</Text> : null}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ expanded: item.showQuickCreate, disabled: item.creatingCustomFood }}
                    disabled={item.creatingCustomFood}
                    onPress={() => updateItem(index, { showQuickCreate: !item.showQuickCreate })}
                    style={styles.quickAddToggle}
                  >
                    <Ionicons name={item.showQuickCreate ? 'remove-circle-outline' : 'add-circle-outline'} size={20} color={Colors.primaryDark} />
                    <Text style={styles.quickAddToggleText}>{t('foodScan.quickAdd')}</Text>
                  </TouchableOpacity>
                  {item.showQuickCreate ? (
                    <View style={styles.quickCreateCard}>
                      <Text style={styles.quickCreateTitle}>{t('foodScan.quickCreateTitle')}</Text>
                      <Text style={styles.quickCreateHint}>{t('foodScan.quickCreateHint')}</Text>
                      <TextInput
                        accessibilityLabel={t('foodScan.nameVi')}
                        value={item.name_vi}
                        onChangeText={value => updateItem(index, { name_vi: value })}
                        maxLength={100}
                        placeholder={t('foodScan.nameVi')}
                        placeholderTextColor={Colors.textMuted}
                        style={styles.quickCreateInput}
                      />
                      <TextInput
                        accessibilityLabel={t('foodScan.nameEn')}
                        value={item.name_en}
                        onChangeText={value => updateItem(index, { name_en: value })}
                        maxLength={100}
                        placeholder={t('foodScan.nameEn')}
                        placeholderTextColor={Colors.textMuted}
                        style={styles.quickCreateInput}
                      />
                      <View style={styles.nutritionInputs}>
                        {([
                          ['caloriesPer100g', 'caloriesPer100gText', 7],
                          ['proteinPer100g', 'proteinPer100gText', 6],
                          ['carbsPer100g', 'carbsPer100gText', 6],
                          ['fatPer100g', 'fatPer100gText', 6],
                        ] as const).map(([labelKey, valueKey, maxLength]) => (
                          <View key={valueKey} style={styles.nutritionInputCell}>
                            <Text style={styles.nutritionInputLabel}>{t(`foodScan.${labelKey}`)}</Text>
                            <TextInput
                              accessibilityLabel={t(`foodScan.${labelKey}`)}
                              value={item[valueKey]}
                              onChangeText={value => updateItem(index, { [valueKey]: value.replace(/[^0-9.,]/g, '') })}
                              keyboardType="decimal-pad"
                              maxLength={maxLength}
                              placeholder="0"
                              placeholderTextColor={Colors.textMuted}
                              style={styles.quickCreateInput}
                            />
                          </View>
                        ))}
                      </View>
                      <PrimaryButton
                        title={t('foodScan.createAndSelect')}
                        onPress={() => void createQuickFood(index)}
                        loading={item.creatingCustomFood}
                        disabled={item.creatingCustomFood || analyzing || saving}
                        style={styles.quickCreateSubmit}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={item.creatingCustomFood}
                        onPress={() => updateItem(index, { showQuickCreate: false })}
                        style={styles.quickCreateCancel}
                      >
                        <Text style={styles.quickCreateCancelText}>{t('foodScan.cancelQuickAdd')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {items.some(item => !item.selectedFoodId) ? <Text style={styles.unmatchedText}>{t('foodScan.unmatched')}</Text> : null}
            <PrimaryButton title={t('foodScan.save', { count: selectedCount })} onPress={save} loading={saving} disabled={saved || !selectedCount || creatingFood} style={styles.saveButton} />
            {savedNotice ? (
              <View style={styles.savedBox}>
                <Text accessibilityRole="status" style={styles.savedText}>{t('foodScan.saved')}</Text>
                <PrimaryButton title={t('foodScan.viewNutrition')} onPress={() => router.push('/health/nutrition')} />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.lg, paddingBottom: 30 },
  cameraCard: { backgroundColor: '#101719', borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.md, position: 'relative' },
  cameraPreview: { ...StyleSheet.absoluteFill },
  cameraPermissionPanel: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  cameraPermissionText: { ...Typography.body, color: Colors.white, textAlign: 'center', lineHeight: 22 },
  cameraHint: { position: 'absolute', left: 14, right: 14, top: 14, alignItems: 'center' },
  cameraHintText: { ...Typography.labelSmall, color: Colors.white, backgroundColor: 'rgba(0,0,0,0.48)', overflow: 'hidden', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 8 },
  cameraControls: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  controlSpacer: { width: 72, height: 72 },
  shutterOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterDisabled: { opacity: 0.48 },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.white },
  galleryButton: { position: 'absolute', right: 22, bottom: 28, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  galleryPlus: { position: 'absolute', right: 3, top: 2, width: 17, height: 17, borderRadius: 9, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  retakeButton: { position: 'absolute', left: 18, bottom: 28, minWidth: 72, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 1 },
  controlLabel: { ...Typography.supporting, color: Colors.white, fontSize: 10 },
  analyzeButton: { marginBottom: Spacing.md },
  errorText: { ...Typography.body, color: Colors.error, backgroundColor: Colors.errorLight, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.md },
  noticeText: { ...Typography.body, color: Colors.success, backgroundColor: Colors.successLight, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.md },
  resultsSection: { marginTop: Spacing.sm },
  sectionTitle: { ...Typography.sectionTitle, color: Colors.textPrimary, marginBottom: Spacing.xs },
  disclaimer: { ...Typography.supporting, color: Colors.textSecondary, lineHeight: 19, marginBottom: Spacing.md },
  mealLabel: { ...Typography.labelSmall, color: Colors.textSecondary, marginBottom: Spacing.xs },
  mealPicker: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md },
  mealChip: { flex: 1, minHeight: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 3 },
  mealChipSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  mealChipText: { ...Typography.labelSmall, color: Colors.textSecondary, fontSize: 11 },
  mealChipTextSelected: { color: Colors.primaryDark, fontWeight: '700' },
  foodCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadows.sm },
  foodNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  foodIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.orangeLight, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  foodHeading: { flex: 1 },
  foodName: { ...Typography.cardTitle, fontSize: 16, color: Colors.textPrimary },
  estimateText: { ...Typography.supporting, color: Colors.textSecondary, marginTop: 3 },
  confidence: { ...Typography.labelSmall, color: Colors.textMuted, marginLeft: 6 },
  gramsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  fieldLabel: { ...Typography.label, color: Colors.textSecondary },
  gramsInput: { minWidth: 96, height: 40, textAlign: 'right', color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, ...Typography.body },
  catalogLabel: { ...Typography.labelSmall, color: Colors.textPrimary, marginBottom: Spacing.xs },
  searchRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  searchInput: { flex: 1, minHeight: 42, color: Colors.textPrimary, backgroundColor: Colors.background, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, ...Typography.body },
  searchButton: { width: 44, height: 42, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...Typography.supporting, color: Colors.textMuted, marginVertical: Spacing.xs },
  noMatch: { ...Typography.supporting, color: Colors.textMuted, marginVertical: Spacing.xs },
  candidates: { gap: 6 },
  candidate: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.sm },
  candidateSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  candidateCopy: { flex: 1 },
  candidateName: { ...Typography.label, color: Colors.textPrimary },
  candidateCalories: { ...Typography.supporting, color: Colors.textSecondary, marginTop: 2 },
  selectedKcal: { ...Typography.labelSmall, color: Colors.primaryDark, marginTop: Spacing.sm },
  quickAddToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', marginTop: Spacing.md, paddingVertical: Spacing.xs },
  quickAddToggleText: { ...Typography.label, color: Colors.primaryDark, flexShrink: 1 },
  quickCreateCard: { marginTop: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  quickCreateTitle: { ...Typography.label, color: Colors.textPrimary },
  quickCreateHint: { ...Typography.supporting, color: Colors.textSecondary, lineHeight: 19 },
  quickCreateInput: { minHeight: 42, color: Colors.textPrimary, backgroundColor: Colors.white, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, ...Typography.body },
  nutritionInputs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.sm },
  nutritionInputCell: { width: '48%', gap: 4 },
  nutritionInputLabel: { ...Typography.supporting, color: Colors.textSecondary, minHeight: 30 },
  quickCreateSubmit: { marginTop: Spacing.xs },
  quickCreateCancel: { alignItems: 'center', paddingVertical: Spacing.sm },
  quickCreateCancelText: { ...Typography.label, color: Colors.textSecondary },
  unmatchedText: { ...Typography.supporting, color: Colors.warning, lineHeight: 19, marginBottom: Spacing.sm },
  saveButton: { marginTop: Spacing.xs },
  savedBox: { backgroundColor: Colors.successLight, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.md },
  savedText: { ...Typography.body, color: Colors.success, textAlign: 'center', fontWeight: '600' },
});
