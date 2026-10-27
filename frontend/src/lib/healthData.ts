import { supabase } from "./supabase";

export type Food = {
  id: string;
  name: string;
  category: string | null;
  serving_size: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  [key: string]: unknown;
};

// This catalogue is shared reference data, not a user's personal health record.
export async function fetchFoods(): Promise<Food[]> {
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Không tải được danh sách thực phẩm: ${error.message}`);
  return (data ?? []) as Food[];
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Không kiểm tra được phiên đăng nhập: ${error.message}`);
  if (!data.user) throw new Error("Ông cần đăng nhập để xem dữ liệu sức khỏe của mình.");
  return data.user.id;
}

// Profile rows conventionally use profiles.id = auth.users.id.
export async function fetchMyProfile() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được hồ sơ: ${error.message}`);
  return data;
}

export type PersonalTable =
  | "health_goals"
  | "step_records"
  | "sleep_records"
  | "meal_records"
  | "weight_records"
  | "water_records";

// These tables are assumed to have a user_id column referencing auth.users.id.
// Keep the table allowlist so a screen cannot query arbitrary table names.
export async function fetchMyRecords(table: PersonalTable) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(`Không tải được dữ liệu ${table}: ${error.message}`);
  return data ?? [];
}

// payload must match the columns of the chosen table in your Supabase schema.
export async function addMyRecord(
  table: Exclude<PersonalTable, "health_goals">,
  payload: Record<string, unknown>
) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(table)
    .insert({ ...payload, user_id: userId })
    .select("*")
    .single();

  if (error) throw new Error(`Không lưu được dữ liệu ${table}: ${error.message}`);
  return data;
}
