export type SleepDateTimeFieldProps = {
  label: string;
  date: string;
  time?: string;
  onChange: (date: string, time?: string) => void;
  disabled?: boolean;
};
