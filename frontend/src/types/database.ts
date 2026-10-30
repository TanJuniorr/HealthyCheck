import type { ArticleRow, ArticleTranslation, ArticleCategory, ArticleInput, ArticleDetail, ArticleStats, ArticleCardRow, CategoryInput } from './articles';
// Maintained from the verified application schema.
// No CLI-generated schema was available in this workspace. Regenerate when connected.
export type SleepScheduleInput = { bedtime: string; wake_time: string; active_days: number[]; reminder_enabled: boolean; reminder_minutes_before: number };
export type SleepScheduleRow = SleepScheduleInput & { id: string; user_id: string; created_at: string; updated_at: string };
export type Numeric = number | string;
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type ProfileGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ProfileRow = { health_onboarding_completed_at: string | null; id: string; full_name: string | null; date_of_birth: string | null; height_cm: Numeric | null; gender: ProfileGender | null; avatar_url: string | null; created_at: string; updated_at: string };
export type ProfileUpdate = Partial<Pick<ProfileRow, 'full_name' | 'date_of_birth' | 'height_cm' | 'gender' | 'avatar_url'>>;
export type HealthGoalRow = { id: string; user_id: string; daily_steps: number | null; daily_calories: number | null; daily_water_ml: number | null; target_sleep_minutes: number | null; effective_from: string; created_at: string };
export type HealthGoalInsert = { daily_steps?: number; daily_calories?: number; daily_water_ml?: number; target_sleep_minutes?: number; effective_from?: string };
export type StepRecordRow = { id: string; user_id: string; record_date: string; steps: number; distance_km: Numeric | null; active_minutes: number | null; created_at: string; updated_at: string };
export type StepRecordInsert = Pick<StepRecordRow, 'record_date' | 'steps'> & Partial<Pick<StepRecordRow, 'distance_km' | 'active_minutes'>>;
export type SleepRecordRow = { id: string; user_id: string; sleep_start: string; sleep_end: string; quality_rating: number | null; notes: string | null; created_at: string };
export type SleepRecordInsert = Pick<SleepRecordRow, 'sleep_start' | 'sleep_end'> & Partial<Pick<SleepRecordRow, 'quality_rating' | 'notes'>>;
export type FoodMetadata = { name_vi?: string; name_en?: string; aliases?: string[]; selectable?: boolean; selection_source_id?: string; edible_portion?: boolean; group?: string; source?: string; source_id?: string; source_url?: string; source_description?:string; source_license?:string; data_type?:string; canonical_key?:string; selection_key?:string; preparation_state?:'raw'|'cooked'|'dried'|'processed'|'prepared'; reference_method?:string; cooked_weight_basis?:boolean; base_unit?: 'g'; unit_weight_g?: number; unit_kind?:'fruit'|'egg'|'slice'; unit_description?: string; unit_description_vi?:string; portion_source_id?: string; recipe_reference?: boolean };
export type FoodRow = { catalog_metadata?: FoodMetadata | null; id: string; name: string; calories_per_100g: Numeric; protein_per_100g: Numeric; carbs_per_100g: Numeric; fat_per_100g: Numeric; created_at: string; category: string | null; serving_size: string | null; calories: Numeric | null; protein_g: Numeric | null; carbs_g: Numeric | null; fat_g: Numeric | null };
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
    | 'share_cycle'
    | 'notify_on_view'
    | 'weekly_digest'
    | 'status'
    | 'updated_at'
  >
>;
export type AppNotificationRow = { id: string; recipient_user_id: string; kind: string; payload: Record<string, unknown>; reference_id: string | null; created_at: string; read_at: string | null };
export type MenstrualCycleSettingsRow = { user_id: string; last_period_start: string | null; cycle_length: number; period_length: number; reminder_enabled: boolean; reminder_days_before: number; updated_at: string };
export type CycleFlowStatus = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
export type CycleMood = 'happy' | 'okay' | 'low' | 'tired' | 'stressed';
export type MenstrualCycleLogRow = { id: string; user_id: string; log_date: string; flow_status: CycleFlowStatus; mood: CycleMood | null; symptoms: string[]; created_at: string; updated_at: string };
export type Rows = { profiles: ProfileRow; health_goals: HealthGoalRow; step_records: StepRecordRow; sleep_records: SleepRecordRow; foods: FoodRow; meal_records: MealRecordRow; weight_records: WeightRecordRow; water_records: WaterRecordRow };
export type PersonalTable = Exclude<keyof Rows, 'profiles' | 'foods'>;
export type Inputs = { health_goals: HealthGoalInsert; step_records: StepRecordInsert; sleep_records: SleepRecordInsert; meal_records: MealRecordInsert; weight_records: WeightRecordInsert; water_records: WaterRecordInsert };
type Table<R, I, U = Partial<I>> = { Row: R; Insert: I; Update: U; Relationships: [] };
export type Database = { public: { Tables: {
  user_roles: Table<{user_id:string;role:'admin'|'user';created_at:string},{user_id:string;role?:'admin'|'user'}>;
  articles: Table<ArticleRow,ArticleInput & {author_id:string},Partial<ArticleInput>>;
  article_translations: Table<ArticleTranslation & {id:string;article_id:string;updated_at:string},ArticleTranslation & {article_id:string}>;
  article_categories: Table<ArticleCategory,CategoryInput>;
  article_bookmarks: Table<{id:string;user_id:string;article_id:string;created_at:string},{user_id:string;article_id:string},never>;
  article_read_history: Table<{id:string;user_id:string;article_id:string;last_read_at:string;read_count:number},never,never>;
  article_category_preferences: Table<{user_id:string;category_id:string;created_at:string},{user_id:string;category_id:string},never>;
  sleep_schedules: Table<SleepScheduleRow, SleepScheduleInput & { user_id: string }>;
  profiles: Table<ProfileRow, { id: string } & ProfileUpdate>;
  health_goals: Table<HealthGoalRow, HealthGoalInsert & { user_id: string }>;
  step_records: Table<StepRecordRow, StepRecordInsert & { user_id: string }>;
  sleep_records: Table<SleepRecordRow, SleepRecordInsert & { user_id: string }>;
  foods: Table<FoodRow, Omit<FoodRow, 'id' | 'created_at'>>;
  meal_records: Omit<Table<MealRecordRow, MealRecordInsert & { user_id: string }>, 'Relationships'> & { Relationships: [{ foreignKeyName: string; columns: ['food_id']; isOneToOne: false; referencedRelation: 'foods'; referencedColumns: ['id'] }] };
  weight_records: Table<WeightRecordRow, WeightRecordInsert & { user_id: string }>;
  water_records: Table<WaterRecordRow, WaterRecordInsert & { user_id: string }>;
  sharing_invites: Table<SharingInviteRow, SharingInviteInsert & { owner_id: string }, SharingInviteUpdate>;
  app_notifications: Table<AppNotificationRow, Omit<AppNotificationRow, 'id' | 'created_at' | 'read_at'> & Partial<Pick<AppNotificationRow, 'id' | 'created_at' | 'read_at'>>, Partial<Pick<AppNotificationRow, 'read_at'>>>;
  menstrual_cycle_settings: Table<MenstrualCycleSettingsRow, Omit<MenstrualCycleSettingsRow, 'updated_at'> & Partial<Pick<MenstrualCycleSettingsRow, 'updated_at'>>, Partial<Omit<MenstrualCycleSettingsRow, 'user_id'>>>;
  menstrual_cycle_logs: Table<MenstrualCycleLogRow, Omit<MenstrualCycleLogRow, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<MenstrualCycleLogRow, 'id' | 'created_at' | 'updated_at'>>, Partial<Omit<MenstrualCycleLogRow, 'id' | 'user_id' | 'log_date' | 'created_at'>>>;
}; Views: { [_ in never]: never }; Functions: {
 article_feed:{Args:{p_language?:string;p_query?:string;p_category?:string|null;p_mode?:string;p_offset?:number;p_limit?:number;p_status?:string|null};Returns:{data:ArticleCardRow[];total:number}};
 get_article:{Args:{p_id:string;p_language?:string};Returns:ArticleDetail|null};
 save_article:{Args:{p_id:string|null;p_expected_updated_at:string|null;p_article:ArticleInput;p_translations:ArticleTranslation[]};Returns:ArticleRow};
 record_article_read:{Args:{p_article_id:string};Returns:undefined};
 article_admin_stats:{Args:Record<string,never>;Returns:ArticleStats};
 search_foods: { Args: { p_query?:string; p_category?:string|null; p_offset?:number; p_limit?:number }; Returns:{data:FoodRow[];total:number} }; complete_health_onboarding: { Args: { p_date_of_birth:string; p_gender:string; p_height_cm:number; p_weight_kg:number }; Returns:ProfileRow[] } }; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } };
