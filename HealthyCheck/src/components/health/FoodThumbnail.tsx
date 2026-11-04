import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { FoodRow } from '../../types/database';
import { foodGroup, type FoodGroup } from '../../lib/foodPortions';
import { foodImageNames, getSavedFoodImageUrl, resolveFoodImageUrl } from '../../services/foodImages';

type Props = { food: FoodRow; size?: number; containerStyle?: StyleProp<ViewStyle> };

const groupIcons = {
  meat: 'restaurant-outline',
  grains: 'basket-outline',
  vegetables: 'leaf-outline',
  fruits: 'nutrition-outline',
  dairy_legumes: 'egg-outline',
  seasonings: 'flask-outline',
  prepared: 'fast-food-outline',
  beverages: 'cafe-outline',
} as const satisfies Record<FoodGroup, React.ComponentProps<typeof Ionicons>['name']>;

export function FoodThumbnail({ food, size = 48, containerStyle }: Props) {
  const savedUrl = getSavedFoodImageUrl(food);
  const foodKey = JSON.stringify([food.id, savedUrl, foodImageNames(food)]);
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);
  const [failed, setFailed] = useState<{ key: string; url: string } | null>(null);
  const imageUrl = savedUrl ?? (resolved?.key === foodKey ? resolved.url : null);
  const imageFailed = failed?.key === foodKey && failed.url === imageUrl;
  const group = foodGroup(food);

  useEffect(() => {
    if (savedUrl) return;
    let active = true;
    void resolveFoodImageUrl(food).then(url => {
      if (active) setResolved({ key: foodKey, url });
    });
    return () => { active = false; };
  }, [food, foodKey, savedUrl]);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: Math.min(size * 0.22, 12) }, containerStyle]}>
      {imageUrl && !imageFailed ? (
        <Image
          accessibilityLabel={food.catalog_metadata?.name_vi ?? food.name}
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailed({ key: foodKey, url: imageUrl })}
        />
      ) : (
        <Ionicons name={group ? groupIcons[group] : 'nutrition-outline'} size={Math.max(20, size * 0.45)} color={Colors.orange} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: Colors.orangeLight },
  image: { width: '100%', height: '100%' },
});
