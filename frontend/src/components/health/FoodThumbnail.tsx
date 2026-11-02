import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { FoodRow } from '../../types/database';
import { resolveFoodImageUrl } from '../../services/foodImages';

type Props = { food: FoodRow; size?: number; containerStyle?: StyleProp<ViewStyle> };

export function FoodThumbnail({ food, size = 48, containerStyle }: Props) {
  const nameKey = [food.name, food.catalog_metadata?.name_en, food.catalog_metadata?.name_vi, ...(food.catalog_metadata?.aliases ?? [])].join('|');
  const foodKey = `${food.id}:${nameKey}:${food.catalog_metadata?.image_url ?? ''}`;
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = food.catalog_metadata?.image_url ?? (resolved?.key === foodKey ? resolved.url : null);
  const failed = imageUrl !== null && failedUrl === imageUrl;

  useEffect(() => {
    let active = true;
    void resolveFoodImageUrl(food).then(url => {
      if (active) setResolved({ key: foodKey, url });
    });
    return () => { active = false; };
  }, [food, foodKey]);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: Math.min(size * 0.22, 12) }, containerStyle]}>
      {imageUrl && !failed ? (
        <Image
          accessibilityLabel={food.catalog_metadata?.name_vi ?? food.name}
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="contain"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <Ionicons name="nutrition-outline" size={Math.max(20, size * 0.45)} color={Colors.orange} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: Colors.orangeLight },
  image: { width: '100%', height: '100%' },
});
