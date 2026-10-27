import { useTranslation } from 'react-i18next';
import { localizeMessage } from '../../i18n/localize';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import { TextButton } from './Buttons';
export function DataFeedback({ isLoading, error, empty, refresh }: { isLoading: boolean; error: string | null; empty?: boolean; refresh: () => Promise<void> }) {
  const { t } = useTranslation();

 return <View style={{ paddingVertical: Spacing.sm }}>
  {isLoading ? <ActivityIndicator color={Colors.primary} accessibilityLabel={t('common.loading')} /> : null}
  {error ? <><Text accessibilityRole="alert" style={{ ...Typography.supporting,color:Colors.error }}>{localizeMessage(error)}</Text><TextButton title={t("common.retry")} onPress={refresh} /></> : !isLoading && empty ? <Text style={{ ...Typography.supporting,color:Colors.textSecondary }}>{t('common.emptyDateRange')}</Text> : null}
 </View>;
}
