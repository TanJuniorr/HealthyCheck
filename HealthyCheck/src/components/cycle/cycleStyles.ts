import { StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Radius, Spacing } from '../../constants/spacing';
export const cycleStyles = StyleSheet.create({
 container: { flex: 1, backgroundColor: Colors.background }, content: { gap: Spacing.lg, paddingBottom: Spacing.xxl },
 card: { padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, gap: Spacing.md },
 title: { ...Typography.cardTitle, color: Colors.textPrimary }, text: { ...Typography.bodySmall, color: Colors.textPrimary }, hint: { ...Typography.supporting, color: Colors.textSecondary },
 emphasis: { ...Typography.sectionTitle, color: Colors.primary }, error: { ...Typography.supporting, color: Colors.error }, success: { ...Typography.supporting, color: Colors.primary },
 row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
 chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }, chip: { minHeight: 44, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
 selected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight }, muted: { opacity: 0.5 },
 dateButton: { minHeight: 48, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.background, gap: Spacing.xs },
 backdrop: { flex: 1, justifyContent: 'center', padding: Spacing.screenPadding, backgroundColor: 'rgba(0,0,0,0.45)' }, dialog: { maxHeight: '90%', width: '100%', maxWidth: 440, alignSelf: 'center', padding: Spacing.lg, backgroundColor: Colors.white, borderRadius: Radius.xl },
 separator: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md, gap: Spacing.sm },
});
