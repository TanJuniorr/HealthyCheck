import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { DarkColors, LightColors, setActiveColorScheme } from '../constants/colors';

const DARK_MODE_STORAGE_KEY = 'healthy-check:dark-mode';

interface ThemeContextValue {
  isDark: boolean;
  setDarkMode: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [isDark, setIsDark] = useState(false);
  const userChangedPreference = useRef(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(DARK_MODE_STORAGE_KEY)
      .then(value => {
        if (mounted && !userChangedPreference.current) {
          const storedDarkMode = value === 'true';
          setActiveColorScheme(storedDarkMode);
          setIsDark(storedDarkMode);
        }
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const setDarkMode = useCallback((enabled: boolean) => {
    userChangedPreference.current = true;
    setActiveColorScheme(enabled);
    setIsDark(enabled);
    void AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, enabled ? 'true' : 'false').catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ isDark, setDarkMode }), [isDark, setDarkMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

function tokenFor(lightValue: string) {
  return (Object.keys(LightColors) as (keyof typeof LightColors)[])
    .find(key => LightColors[key] === lightValue);
}

function tokenForDark(darkValue: string) {
  return (Object.keys(DarkColors) as (keyof typeof DarkColors)[])
    .find(key => DarkColors[key] === darkValue);
}

function parseHexColor(value: string) {
  const normalized = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    return normalized.slice(1).split('').map(channel => Number.parseInt(channel + channel, 16));
  }
  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return [1, 3, 5].map(index => Number.parseInt(normalized.slice(index, index + 2), 16));
  }
  return null;
}

function colorBrightness([red, green, blue]: number[]) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function blendHexColors(first: number[], second: number[], secondWeight: number) {
  return `#${first.map((channel, index) => Math.round(channel * (1 - secondWeight) + second[index] * secondWeight).toString(16).padStart(2, '0')).join('')}`;
}

function darkTextColor(lightValue: string) {
  if (lightValue === LightColors.white) return DarkColors.white;
  const token = tokenFor(lightValue);
  if (!token) {
    const rgb = parseHexColor(lightValue);
    if (rgb && colorBrightness(rgb) < 145) return blendHexColors(rgb, parseHexColor(DarkColors.textPrimary)!, 0.68);
    return lightValue;
  }
  if (token.endsWith('Light')) {
    const solidToken = token.slice(0, -5) as keyof typeof DarkColors;
    return DarkColors[solidToken] ?? lightValue;
  }
  return DarkColors[token];
}

function darkBackgroundColor(lightValue: string) {
  if (lightValue === LightColors.white || lightValue === LightColors.surface) return DarkColors.surface;
  const token = tokenFor(lightValue);
  if (!token) {
    const rgb = parseHexColor(lightValue);
    if (rgb && colorBrightness(rgb) > 185) return blendHexColors(parseHexColor(DarkColors.surface)!, rgb, 0.16);
    return lightValue;
  }
  if (token.endsWith('Light')) return DarkColors[token];
  return DarkColors[token];
}

function darkBorderColor(lightValue: string) {
  if (lightValue === LightColors.white) return DarkColors.white;
  const token = tokenFor(lightValue);
  if (!token) {
    const rgb = parseHexColor(lightValue);
    if (rgb && colorBrightness(rgb) > 130) return blendHexColors(parseHexColor(DarkColors.surface)!, rgb, 0.2);
    return lightValue;
  }
  if (token.endsWith('Light')) {
    const solidToken = token.slice(0, -5) as keyof typeof DarkColors;
    return DarkColors[solidToken] ?? DarkColors.border;
  }
  return DarkColors[token];
}

function lightTextColor(darkValue: string) {
  if (darkValue === DarkColors.white) return LightColors.white;
  const token = tokenForDark(darkValue);
  if (!token) return darkValue;
  if (token.endsWith('Light')) {
    const solidToken = token.slice(0, -5) as keyof typeof LightColors;
    return LightColors[solidToken] ?? darkValue;
  }
  return LightColors[token];
}

function lightBackgroundColor(darkValue: string) {
  if (darkValue === DarkColors.white || darkValue === DarkColors.surface) return LightColors.surface;
  const token = tokenForDark(darkValue);
  return token ? LightColors[token] : darkValue;
}

function lightBorderColor(darkValue: string) {
  if (darkValue === DarkColors.white) return LightColors.white;
  const token = tokenForDark(darkValue);
  if (!token) return darkValue;
  if (token.endsWith('Light')) {
    const solidToken = token.slice(0, -5) as keyof typeof LightColors;
    return LightColors[solidToken] ?? LightColors.border;
  }
  return LightColors[token];
}

function styleForDarkMode(style: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...style };
  for (const [property, value] of Object.entries(style)) {
    if (typeof value !== 'string') continue;
    if (property === 'backgroundColor') result[property] = darkBackgroundColor(value);
    else if (property === 'color' || property === 'tintColor' || property === 'textDecorationColor') {
      result[property] = darkTextColor(value);
    } else if (property === 'borderColor' || property.endsWith('BorderColor') || property === 'shadowColor') {
      result[property] = property === 'shadowColor' ? DarkColors.black : darkBorderColor(value);
    }
  }
  return result;
}

function styleForLightMode(style: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...style };
  for (const [property, value] of Object.entries(style)) {
    if (typeof value !== 'string') continue;
    if (property === 'backgroundColor') result[property] = lightBackgroundColor(value);
    else if (property === 'color' || property === 'tintColor' || property === 'textDecorationColor') {
      result[property] = lightTextColor(value);
    } else if (property === 'borderColor' || property.endsWith('BorderColor') || property === 'shadowColor') {
      result[property] = property === 'shadowColor' ? LightColors.black : lightBorderColor(value);
    }
  }
  return result;
}

export function getThemedColor(
  value: string,
  isDark: boolean,
  role: 'text' | 'background' | 'border' = 'text',
) {
  if (!isDark) return value;
  if (role === 'background') return darkBackgroundColor(value);
  if (role === 'border') return darkBorderColor(value);
  return darkTextColor(value);
}

/** Returns a dark palette version of a light-token StyleSheet and subscribes its component to theme changes. */
export function useThemedStyles<T extends Record<string, any>>(baseStyles: T): T {
  const { isDark } = useTheme();
  return useMemo(() => {
    const themed: Record<string, unknown> = {};
    const flattenedStyles: [string, Record<string, unknown> | undefined, unknown][] = [];
    let containsDarkTokens = false;
    for (const [name, style] of Object.entries(baseStyles)) {
      const flatStyle = StyleSheet.flatten(style as any) as Record<string, unknown> | undefined;
      flattenedStyles.push([name, flatStyle, style]);
      if (flatStyle && Object.entries(flatStyle).some(([property, value]) =>
        typeof value === 'string' &&
        (property === 'backgroundColor' || property === 'color' || property === 'tintColor' || property.endsWith('Color')) &&
        tokenForDark(value) !== undefined,
      )) containsDarkTokens = true;
    }
    if (!isDark && !containsDarkTokens) return baseStyles;
    for (const [name, flatStyle, original] of flattenedStyles) {
      themed[name] = flatStyle ? (isDark ? styleForDarkMode(flatStyle) : styleForLightMode(flatStyle)) : original;
    }
    return StyleSheet.create(themed as any) as T;
  }, [baseStyles, isDark]);
}
