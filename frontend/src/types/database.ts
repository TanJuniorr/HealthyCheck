// Maintained from the eight-table schema verified and supplied by the project owner.
// No CLI-generated schema was available in this workspace. Regenerate when connected.
export type Numeric = number | string;
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type ProfileGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ProfileRow = { id: string; full_name: string | null; date_of_birth: string | null; height_cm: Numeric | null; gender: ProfileGender | null; avatar_url: string | null; created_at: string; updated_at: string };
export type ProfileUpdate = Partial<Pick<ProfileRow, 'full_name' | 'date_of_birth' | 'height_cm' | 'gender' | 'avatar_url'>>;
export type HealthGoalRow = { id: string; user_id: string; daily_steps: number | null; daily_calories: number | null; daily_water_ml: number | null; target_sleep_minutes: number | null; effective_from: string; created_at: string };
export type HealthGoalInsert = { daily_steps?: number; daily_calories?: number; daily_water_ml?: number; target_sleep_minutes?: number; effective_from?: string };
export type StepRecordRow = { id: string; user_id: string; record_date: string; steps: number; distance_km: Numeric | null; active_minutes: number | null; created_at: string; updated_at: string };
export type StepRecordInsert = Pick<StepRecordRow, 'record_date' | 'steps'> & Partial<Pick<StepRecordRow, 'distance_km' | 'active_minutes'>>;
export type SleepRecordRow = { id: string; user_id: string; sleep_start: string; sleep_end: string; quality_rating: number | null; notes: string | null; created_at: string };
export type SleepRecordInsert = Pick<SleepRecordRow, 'sleep_start' | 'sleep_end'> & Partial<Pick<SleepRecordRow, 'quality_rating' | 'notes'>>;
export type FoodRow = { id: string; name: string; calories_per_100g: Numeric; protein_per_100g: Numeric; carbs_per_100g: Numeric; fat_per_100g: Numeric; created_at: string; category: string | null; serving_size: string | null; calories: Numeric | null; protein_g: Numeric | null; carbs_g: Numeric | null; fat_g: Numeric | null };
export type MealRecordRow = { id: string; user_id: string; food_id: string; meal_type: MealType; quantity_g: Numeric; consumed_at: string; created_at: string };
export type MealRecordInsert = Pick<MealRecordRow, 'food_id' | 'meal_type' | 'quantity_g'> & Partial<Pick<MealRecordRow, 'consumed_at'>>;
export type WeightRecordRow = { id: string; user_id: string; weight_kg: Numeric; recorded_at: string; created_at: string };
export type WeightRecordInsert = Pick<WeightRecordRow, 'weight_kg'> & Partial<Pick<WeightRecordRow, 'recorded_at'>>;
export type WaterRecordRow = { id: string; user_id: string; amount_ml: number; recorded_at: string; created_at: string };
export type WaterRecordInsert = Pick<WaterRecordRow, 'amount_ml'> & Partial<Pick<WaterRecordRow, 'recorded_at'>>;
export type PrivacyLevel = 'specific' | 'family' | 'community';
export type SharingStatus = 'active' | 'paused' | 'revoked';
export type SharingInviteRow = {
  id: string;
  owner_id: string;
  recipient_label: string;
  recipient_email: string | null;
  privacy_level: PrivacyLevel;
  share_steps: boolean;
  share_sleep: boolean;
  share_nutrition: boolean;
  share_heart: boolean;
  share_cycle: boolean;
  notify_on_view: boolean;
  weekly_digest: boolean;
  status: SharingStatus;
  created_at: string;
  updated_at: string;
};
export type SharingInviteInsert = {
  recipient_label: string;
  recipient_email?: string | null;
  privacy_level: PrivacyLevel;
  share_steps?: boolean;
  share_sleep?: boolean;
  share_nutrition?: boolean;
  share_heart?: boolean;
  share_cycle?: boolean;
  notify_on_view?: boolean;
  weekly_digest?: boolean;
  status?: SharingStatus;
  created_at?: string;
  updated_at?: string;
};
export type SharingInviteUpdate = Partial<
  Pick<
    SharingInviteRow,
    | 'recipient_label'
    | 'recipient_email'
    | 'privacy_level'
    | 'share_steps'
    | 'share_sleep'
    | 'share_nutrition'
    | 'share_heart'
    | 'share_cycle'
    | 'notify_on_view'
    | 'weekly_digest'
    | 'status'
    | 'updated_at'
  >
>;
export type Rows = { profiles: ProfileRow; health_goals: HealthGoalRow; step_records: StepRecordRow; sleep_records: SleepRecordRow; foods: FoodRow; meal_records: MealRecordRow; weight_records: WeightRecordRow; water_records: WaterRecordRow };
export type PersonalTable = Exclude<keyof Rows, 'profiles' | 'foods'>;
export type Inputs = { health_goals: HealthGoalInsert; step_records: StepRecordInsert; sleep_records: SleepRecordInsert; meal_records: MealRecordInsert; weight_records: WeightRecordInsert; water_records: WaterRecordInsert };
type Table<R, I, U = Partial<I>> = { Row: R; Insert: I; Update: U; Relationships: [] };
export type Database = { public: { Tables: {
  profiles: Table<ProfileRow, { id: string } & ProfileUpdate>;
  health_goals: Table<HealthGoalRow, HealthGoalInsert & { user_id: string }>;
  step_records: Table<StepRecordRow, StepRecordInsert & { user_id: string }>;
  sleep_records: Table<SleepRecordRow, SleepRecordInsert & { user_id: string }>;
  foods: Table<FoodRow, Omit<FoodRow, 'id' | 'created_at'>>;
  meal_records: Omit<Table<MealRecordRow, MealRecordInsert & { user_id: string }>, 'Relationships'> & { Relationships: [{ foreignKeyName: string; columns: ['food_id']; isOneToOne: false; referencedRelation: 'foods'; referencedColumns: ['id'] }] };
  weight_records: Table<WeightRecordRow, WeightRecordInsert & { user_id: string }>;
  water_records: Table<WaterRecordRow, WaterRecordInsert & { user_id: string }>;
  sharing_invites: Table<SharingInviteRow, SharingInviteInsert & { owner_id: string }, SharingInviteUpdate>;
}; Views: { [_ in never]: never }; Functions: { [_ in never]: never }; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } };
