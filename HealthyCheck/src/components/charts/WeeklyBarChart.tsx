import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../i18n/formatting';
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { getThemedColor, useTheme, useThemedStyles } from '../../contexts/ThemeContext';

interface BarDataItem {
  label: string;
  value: number;
  highlighted?: boolean;
}

interface WeeklyBarChartProps {
  data: BarDataItem[];
  maxValue?: number;
  color?: string;
  highlightColor?: string;
  height?: number;
  barWidth?: number;
  showValues?: boolean;
  unit?: string;
}

export function WeeklyBarChart({
  data,
  maxValue,
  color = Colors.primary,
  highlightColor,
  height = 160,
  barWidth = 28,
  showValues = false,
  unit = '',
}: WeeklyBarChartProps) {
  const styles = useThemedStyles(baseStyles);
  const { isDark } = useTheme();
  const themedColor = getThemedColor(color, isDark);
  const themedHighlightColor = highlightColor ? getThemedColor(highlightColor, isDark) : themedColor;
  useTranslation();
  const [totalWidth, setTotalWidth] = useState(0);
  const max = maxValue && maxValue > 0 ? maxValue : Math.max(1,...data.map((d) => d.value)) * 1.1;
  const chartHeight = height - 30; // Reserve space for labels
  barWidth = Math.min(barWidth, totalWidth / Math.max(1, data.length * 1.7));
  const gap = (totalWidth - barWidth * data.length) / (data.length + 1);

  return (
    <View style={[styles.container, { height }]} onLayout={event => setTotalWidth(event.nativeEvent.layout.width)}>
      <Svg width={totalWidth} height={height}>
        {data.map((item, index) => {
          const barHeight = (item.value / max) * chartHeight;
          const x = gap + index * (barWidth + gap);
          const y = chartHeight - barHeight;
          const isHighlighted = item.highlighted;
          const barColor = isHighlighted ? themedHighlightColor : themedColor;
          const opacity = isHighlighted ? 1 : 0.5;

          return (
            <React.Fragment key={index}>
              {/* Track bar */}
              <Rect
                x={x}
                y={4}
                width={barWidth}
                height={chartHeight - 4}
                rx={barWidth / 4}
                fill={Colors.border}
                opacity={0.4}
              />
              {/* Value bar */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 4}
                fill={barColor}
                opacity={opacity}
              />
              {/* Label */}
              <SvgText
                x={x + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                fill={isHighlighted ? Colors.textPrimary : Colors.textMuted}
                fontSize={11}
                fontWeight={isHighlighted ? '600' : '400'}
              >
                {item.label}
              </SvgText>
              {/* Value text */}
              {showValues && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fill={Colors.textSecondary}
                  fontSize={10}
                >
                  {formatNumber(item.value)}{unit}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
