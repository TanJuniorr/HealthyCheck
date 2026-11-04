import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../i18n/formatting';
import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { getThemedColor, useTheme, useThemedStyles } from '../../contexts/ThemeContext';

interface LineDataItem {
  label: string;
  value: number;
}

interface TrendLineChartProps {
  data: LineDataItem[];
  color?: string;
  height?: number;
  showDots?: boolean;
  showLabels?: boolean;
  showGrid?: boolean;
  yAxisSuffix?: string;
}

export function TrendLineChart({
  data,
  color = Colors.primary,
  height = 160,
  showDots = true,
  showLabels = true,
  showGrid = true,
  yAxisSuffix = '',
}: TrendLineChartProps) {
  const styles = useThemedStyles(baseStyles);
  const { isDark } = useTheme();
  const themedColor = getThemedColor(color, isDark);
  useTranslation();
  const screenWidth = Dimensions.get('window').width - Spacing.screenPadding * 2;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = showLabels ? 30 : 16;
  const chartWidth = screenWidth - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const labelStride = Math.max(1,Math.ceil(data.length / Math.max(2,Math.floor(chartWidth / 48))));

  const maxValue = Math.max(1,...data.map((d) => d.value)) * 1.15;
  const minValue = (data.length ? Math.min(...data.map((d) => d.value)) : 0) * 0.85;
  const range = maxValue - minValue || 1;

  const points = data.map((item, index) => {
    const x = paddingLeft + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((item.value - minValue) / range) * chartHeight;
    return { x, y, ...item };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Generate 3 grid lines
  const gridLines = [0, 0.5, 1].map((pct) => {
    const y = paddingTop + chartHeight * (1 - pct);
    const val = Math.round(minValue + range * pct);
    return { y, val };
  });

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={screenWidth} height={height}>
        {/* Grid lines */}
        {showGrid &&
          gridLines.map((line, i) => (
            <React.Fragment key={i}>
              <Line
                x1={paddingLeft}
                y1={line.y}
                x2={screenWidth - paddingRight}
                y2={line.y}
                stroke={Colors.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={paddingLeft - 6}
                y={line.y + 4}
                textAnchor="end"
                fill={Colors.textMuted}
                fontSize={10}
              >
                {formatNumber(line.val)}{yAxisSuffix}
              </SvgText>
            </React.Fragment>
          ))}

        {/* Line */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={themedColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <React.Fragment key={i}>
              <Circle cx={p.x} cy={p.y} r={5} fill={Colors.white} stroke={themedColor} strokeWidth={2.5} />
            </React.Fragment>
          ))}

        {/* X Labels */}
        {showLabels &&
          points.map((p, i) => i % labelStride === 0 ? (
            <SvgText
              key={`label-${i}`}
              x={p.x}
              y={height - 6}
              textAnchor="middle"
              fill={Colors.textMuted}
              fontSize={11}
            >
              {p.label}
            </SvgText>
          ) : null)}
      </Svg>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
