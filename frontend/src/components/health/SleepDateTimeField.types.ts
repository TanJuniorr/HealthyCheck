export type SleepDateTimePickerMode = 'date' | 'time' | null;

export type SleepDateTimeFieldProps = {
  label: string;
  date: string;
  time?: string;
  activeMode: SleepDateTimePickerMode;
  onActiveModeChange: (mode: SleepDateTimePickerMode) => void;
  onChange: (date: string, time?: string) => void;
  disabled?: boolean;
};
