import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { getThemedColor, useTheme, useThemedStyles } from '../../contexts/ThemeContext';

interface ProgressRingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  progress,
  size = 140,
  strokeWidth = 10,
  color = Colors.primary,
  trackColor = Colors.border,
  children,
}: ProgressRingProps) {
  const styles = useThemedStyles(baseStyles);
  const { isDark } = useTheme();
  const themedColor = getThemedColor(color, isDark);
  const themedTrackColor = getThemedColor(trackColor, isDark, 'background');
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={themedTrackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={themedColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  trackColor?: string;
  height?: number;
  label?: string;
  value?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  progress,
  color = Colors.primary,
  trackColor = Colors.border,
  height = 8,
  label,
  value,
  showLabel = true,
}: ProgressBarProps) {
  const styles = useThemedStyles(baseStyles);
  const { isDark } = useTheme();
  const themedColor = getThemedColor(color, isDark);
  const themedTrackColor = getThemedColor(trackColor, isDark, 'background');
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={styles.barContainer}>
      {showLabel && (label || value) ? (
        <View style={styles.barLabelRow}>
          {label ? <Text style={styles.barLabel}>{label}</Text> : null}
          {value ? <Text style={styles.barValue}>{value}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.barTrack, { height, backgroundColor: themedTrackColor, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${clampedProgress * 100}%`,
              backgroundColor: themedColor,
              height,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barContainer: {
    width: '100%',
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barLabel: {
    ...Typography.supporting,
    color: Colors.textSecondary,
  },
  barValue: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  barTrack: {
    width: '100%',
    overflow: 'hidden',
  },
  barFill: {},
});
