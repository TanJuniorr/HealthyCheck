# HealthyCheck — Supabase Data Access Layer

## Phạm vi và cấu trúc

Triển khai trên frontend hiện tại, giữ AuthProvider, session/recovery và Expo Router. Supabase Client chỉ được bổ sung generic Database; không đổi cấu hình Auth. Không có backend mới, dependency runtime mới, migration, policy, function/view SQL hay thao tác ghi production.

Schema types được bảo trì theo schema tám bảng do chủ dự án xác nhận. Đã chạy SELECT LIMIT 0 thật với toàn bộ cột sử dụng ở tám bảng, bao gồm meal–food embed; tất cả được PostgREST chấp nhận. Đây không phải introspection toàn bộ constraints/default/nullability. Không tuyên bố types được CLI sinh tự động. Không giả định UNIQUE(user_id,record_date), không UPSERT Steps.

Code ban đầu thực tế có fetchFoods, fetchMyProfile, fetchMyRecords, addMyRecord và một truy vấn profile trùng ở profileRepository. fetchMyGoals, getFoodServingGrams, toLocalDateKey được nhắc trong snapshot nhưng chưa có trong file đang làm việc; hiện được bổ sung và xuất qua compatibility surface.

## Service API và mức kiểm chứng

Lịch sử trả Page<T>: data, page, pageSize, total (null nếu server không trả count), hasMore. Mặc định trang 1, 20 hàng; tối đa 200 hàng/trang. Truy vấn range dùng toàn bộ trang, không dừng chỉ vì server trả ít hơn pageSize. Mỗi truy vấn có sort thời gian, created_at khi phù hợp và id để ổn định thứ tự. Offset pagination không cung cấp transactional snapshot khi dữ liệu thay đổi giữa các request; refresh lại khi có ghi đồng thời.

| Service | Implemented functions | Database table | Verification |
|---|---|---|---|
| profileService | getMyProfile, updateMyProfile, ensureMyProfile | profiles | Types, HTTP mock; cột SELECT LIMIT 0 thật |
| healthGoalsService | getCurrentGoals, getGoalsHistory, createGoals, updateGoals, deleteGoals, getGoalsForRange | health_goals | HTTP mock CRUD/thứ tự/effective date; cột LIMIT 0 thật |
| stepsService | getStepsByDate, getStepsByDateRange, getWeeklySteps, getMonthlySteps, getStepsHistory, getStepRecordById, addStepRecord, updateStepRecord, deleteStepRecord, getStepsSummary | step_records | Mock CRUD/owner/pagination, unit aggregation; cột LIMIT 0 thật |
| sleepService | getSleepRecords, getSleepRecordById, getSleepByDateRange, getWeeklySleep, getSleepSummary, addSleepRecord, updateSleepRecord, deleteSleepRecord | sleep_records | Validation, mock partial update/optimistic filters, unit duration; cột LIMIT 0 thật |
| foodsService | getAllFoods, searchFoods, getFoodById, getFoodsByCategory, getFoodCategories, readFoodCatalogue, calculateFoodNutrition, getFoodServingGrams | foods, chỉ đọc | SELECT thật: 15 dòng, search, by-id, category, 6 categories, tính dinh dưỡng finite; unit/mocks |
| mealsService | getMealsByDate, getMealsByDateRange, getMealHistory, getMealRecordById, addMealRecord, addMealItems, updateMealRecord, deleteMealRecord, getDailyNutrition, getWeeklyNutrition, getNutritionSummary | meal_records, embed foods | Mock bulk insert/rollback error/unknown food, unit nutrition; cột và join LIMIT 0 thật |
| weightService | getWeightHistory, getLatestWeight, getWeightByDateRange, addWeightRecord, updateWeightRecord, deleteWeightRecord, getWeightTrend, calculateBMI | weight_records | Mock CRUD, unit trend/BMI; cột LIMIT 0 thật |
| waterService | getWaterRecordsByDate, getWaterRecordsByDateRange, getWaterHistory, addWaterRecord, updateWaterRecord, deleteWaterRecord, getDailyWaterTotal, getWeeklyWaterSummary | water_records | Mock CRUD, unit totals; cột LIMIT 0 thật |
| dashboardService | getDashboardSummary, getWeeklyDashboardSummary | 7 bảng cá nhân + food embed | Mock consistency/query bounds/goal history; không có ghi |

Các hàm by-id/profile trả null khi không có hàng; update/delete không tìm thấy mục tiêu trả DataAccessError NOT_FOUND. getDailyWaterTotal trả WaterSummary, đọc tổng qua totalMl. getLatestWeight hỗ trợ ngày tham chiếu tùy chọn, không lấy bản ghi sau ngày được chọn. Các payload cập nhật không được phép sửa owner/id hoặc cột ngoài allowlist. Trường undefined được bỏ qua, không biến thành null.

## Bảo vệ danh tính và lỗi

requireAuthenticatedUserId lấy danh tính bằng Supabase Auth getUser, chia sẻ request đang chạy cho các truy vấn đồng thời, không lưu cache danh tính lâu dài và không thêm auth listener. getSession kiểm tra lại tài khoản trước/sau khi nhận dữ liệu. Không nhận user_id từ screen làm bằng chứng quyền sở hữu. Khi user đổi trong lúc query chạy, kết quả bị từ chối AUTH_CHANGED. Mọi UPDATE/DELETE đều lọc ID lẫn owner; profiles dùng id=user.id. RLS hiện có vẫn là nơi quyết định quyền trên server.

DataAccessError có các code: UNAUTHENTICATED, AUTH_CHANGED, PERMISSION_DENIED, NOT_FOUND, NETWORK, INVALID_INPUT, CONSTRAINT, DATABASE. Lỗi được dịch sang tiếng Việt, không đưa SQL details/token/health record vào log hay giao diện. Dataset rỗng khác query thất bại. UPDATE bị RLS ẩn hàng cũng có thể biểu hiện NOT_FOUND; cần kiểm chứng SELECT/UPDATE policies bằng client thật, không tự nới policy.

ensureMyProfile đọc trước; chỉ khi thiếu mới UPSERT trên PK id với ignoreDuplicates. Nếu trigger hoặc request khác đã tạo row thì không ghi đè. Full name lấy từ auth metadata chỉ để hiển thị/tạo tên, không dùng trong authorization. Không có email hay gender trong truy vấn profiles; email tiếp tục lấy từ AuthProvider.

## Quy ước số, ngày và công thức

- Numeric wire values có thể là number/string; normalizeRow chuẩn hóa cột số và loại giá trị không hữu hạn. UI không suy diễn số liệu còn thiếu.
- DateInput string là YYYY-MM-DD. Timestamptz input phải là ISO 8601 có Z hoặc offset. toLocalDateKey/getLocalDayBounds dùng múi giờ thiết bị, không hardcode Việt Nam. Query timestamp dùng [đầu ngày, đầu ngày kế tiếp), chuyển boundaries sang ISO. Week là Thứ Hai–Chủ Nhật; Month là tháng lịch. Bounds tính bằng tăng ngày lịch nên hỗ trợ DST.
- Pure summaries giới hạn khoảng lịch 3660 ngày để tránh tạo mảng quá lớn trên mobile. History có thể phân trang ngoài khoảng này; không tự tải toàn bộ lịch sử cho dashboard.
- Steps: cộng nhiều row cùng record_date. averageDailySteps = tổng / số ngày lịch trong range; daysWithRecords tách daysWithActivity (>0). Missing day có hasRecords=false, khác một ngày đã nhập 0. Distance/active minutes chỉ tổng được khi mọi row ngày đó có giá trị; không suy diễn calories/distance từ steps. Goal/progress chọn đúng effective goal cho từng ngày, kể cả thay đổi giữa tuần.
- Sleep: nhóm theo ngày thức dậy địa phương; duration = chênh lệch timestamp / 60000. averageDurationMinutes theo session; averageDailyMinutes theo ngày có session. Không tự gộp/khử trùng các session chồng nhau đã nhập; không có sleep phases. quality là điểm tự đánh giá 1–5, không phải %. Partial update kiểm tra cặp timestamp với row hiện tại và dùng optimistic filters cho cả start/end để tránh ghi đè lịch ngủ đã đổi đồng thời.
- Food/Meal: chỉ dùng per-100g * quantity_g / 100; không cộng lại cột serving calories. Meal records là các food entries, nhóm UI theo ngày/meal_type; schema chưa có meal_id riêng. addMealItems kiểm tra toàn bộ input, kiểm tra các food ID bằng một truy vấn rồi insert một mảng trong một request PostgREST. Không báo thành công nếu server từ chối. Food embed null khiến thống kê báo lỗi thay vì tính 0 giả.
- serving_size chỉ chuyển đổi khi toàn chuỗi là khối lượng rõ ràng như 150 g/0.25 kg; one bowl/one cup không được đoán gram. Add Meal ghi gram tường minh, nút Add tăng 100 g và có ô sửa gram.
- Goal progress có target hợp lệ >0 mới tính, hiển thị tối đa 100%; target thiếu/0 trả null. Nutrition range nhiều ngày không chia tổng cả tuần cho một daily target; daily summary/dashboard có calorieGoal/progress riêng.
- Weight trend dùng phép đo cuối mỗi ngày, giữ nguyên các row gốc; cùng timestamp phân xử theo id. BMI là weight/(height/100)^2, null khi thiếu/không hợp lệ; dùng chiều cao hiện tại, không giả định có lịch sử chiều cao. Không coi BMI là chẩn đoán.

Daily dashboard dùng query theo ngày, profile, effective goal và latest weight tính đến ngày đó. Weekly dashboard dùng các range query một lần rồi tính bảy ngày; kiểm thử giới hạn chín request khi mỗi bảng chỉ có một trang. Overview lấy ngày hôm nay từ weekly result để không tải lại bảy truy vấn daily. Meal queries embed foods, không tải catalogue để tính từng meal.

## Hooks và UI

useHealthQuery và healthHooks xuất useSteps/useSleep/useNutrition/useWater/useWeight/useHealthGoals/useHealthOverview/useWeeklyOverview. Mỗi hook có data, isLoading, error, refresh, refresh theo focus của Expo Router. State gắn owner và query key, request generation hủy kết quả cũ; identity còn được kiểm tra tại service/hook. Không có cache records dùng chung giữa tài khoản, không thêm React Query.

Các màn hình giữ bố cục/style hiện có:

- Profile: profile service dùng chung với AuthProvider, weight thật, current goals thật; có thao tác tạo profile thiếu, không đoán gender/email trong bảng.
- Steps: số/charts theo Today/Week/Month, bỏ dữ liệu hourly giả vì schema chỉ có record_date; thêm form nhập tay tối thiểu.
- Sleep: thời lượng, self-rating /5, chart theo ngày thức dậy và latest session; phases hiển thị unavailable.
- Nutrition: tổng dinh dưỡng thật, nhóm nhiều food entries theo bữa, không tự đặt macro goals vì schema không có các target này.
- Add Meal: giữ tìm kiếm/chọn bữa/stepper; dùng food ID thay tên, gram rõ ràng, bulk save qua service, loading/lỗi và chỉ quay lại sau khi thành công.
- BMI: chiều cao profile + latest weight, trend dùng actual daily weight.
- Calories: food intake từ meal records. Active/resting expenditure là unavailable, không cộng giả từ Steps.
- All Health Data/Dashboard: số thống nhất từ dashboard service, health score unavailable, không tải food catalogue chỉ để log.
- Settings: current goals và form lưu một bộ mục tiêu mới effective hôm nay, giữ lịch sử. Theme/notification switches được ghi rõ là preview tại màn hình, không tuyên bố lưu Supabase.

API update/delete đã hoàn chỉnh cho các bảng cá nhân. Những form sửa/xóa chuyên biệt và form nhập Sleep/Weight/Water chưa có trong UI gốc nên không tự tạo một hệ thống quản lý records mới; có thể nối trực tiếp các service/hook khi bổ sung giao diện phù hợp. Profile update API hỗ trợ bốn trường được xác minh, không thay đổi auth email.

Heart/Cycle giữ màn hình mẫu và nhãn Coming soon/demonstration only. Recurring Sleep Schedule có nhãn preview, nút lưu bị disabled và không báo Saved giả. Không có pedometer/Health Connect, nhắc ngủ persist, clinical health score hoặc dự báo y tế mới.

## Tệp của lần triển khai này

Tạo mới:

- src/types/database.ts, src/types/health.ts.
- src/lib/dataErrors.ts, dateUtils.ts, dataValidation.ts, healthCalculations.ts.
- src/services/queryCore.ts và chín service profile/goals/steps/sleep/foods/meals/weight/water/dashboard.
- src/hooks/useHealthQuery.ts, healthHooks.ts.
- src/components/common/DataFeedback.tsx.
- tests/load-ts.cjs, data.test.cjs, services.test.cjs.
- scripts/check-data-read.cjs và tài liệu này.

Sửa: src/lib/supabase.ts (chỉ generic type), healthData.ts (compatibility wrappers), profileRepository.ts (delegate); app/profile.tsx, settings.tsx, sleep-schedule.tsx, (tabs)/index.tsx, health/steps.tsx, sleep.tsx, nutrition.tsx, bmi.tsx, calories.tsx, index.tsx, heart.tsx, cycle.tsx, meals/add.tsx; hai chart để xử lý empty/zero dataset an toàn; package.json (test script), tsconfig.json (loại dist/web-build/node_modules khỏi kiểm tra source), tests/auth.test.cjs (cập nhật mock import service). Auth routes/provider/client config không bị viết lại. backend/ và các thay đổi Auth có sẵn từ lần trước được giữ nguyên.

## Chạy và kiểm chứng

Từ frontend:

```powershell
npm test
npm run typecheck
npx expo export --platform web
npx expo start
# Chỉ SELECT; dùng hai biến public hiện có trong .env, không in credentials:
node --env-file=.env scripts/check-data-read.cjs --schema
```

Đã chạy unit/service tests với HTTP mock của chính supabase-js, không mock lại công thức hay xây URL truy vấn bằng tay. Bao phủ nutrition, BMI, daily/weekly steps, sleep, water, date/month/year/DST, goal progress, validation, pagination, CRUD owner filters, missing auth, empty/error results, invalid targets, bulk failure, unknown foods, profile idempotence, account change khi query đang chờ, goal effective dates và dashboard consistency/query bounds. Cả bảy test Auth cũ vẫn chạy.

Lint kiểm tra bằng cấu hình Expo tạm có sẵn trong môi trường, không thêm framework/dependency lint vào repository. Kết quả và số lượng test cuối cùng được ghi trong báo cáo bàn giao. Các thao tác write trong tests chỉ gọi fetch giả tại unit-test.invalid. Không gọi đăng ký, insert, update, delete trên project production.

Các kiểm thử cần thực hiện bằng tài khoản test A/B trên môi trường được phép ghi:

1. Đăng nhập A, đọc/insert/update/delete các bảng được RLS cho phép. Sau mutation mở lại màn hình để kiểm tra refresh và con số thống nhất Dashboard/Steps/Nutrition/Settings/Profile/BMI.
2. Dùng authenticated client A truy vấn trực tiếp owner B và thử thay owner khi update/insert; RLS phải chặn. Service filters và LIMIT 0 không chứng minh bước này; không dùng SQL Editor/service role làm bằng chứng.
3. Kiểm tra ensureMyProfile với trigger có sẵn, row thiếu và create đồng thời; không tạo row trùng/ghi đè.
4. Lưu nhiều món cùng bữa, đổi số gram, kiểm tra một request insert và tổng nutrition chính xác.
5. Offline, session hết hạn, logout hoặc đổi account trong lúc đang tải: có lỗi rõ, không thấy record account trước.
6. Chạy iOS/Android thật, kiểm tra keyboard/form, focus refresh, local timezone và Back navigation. Chưa có kết quả device E2E trong nhiệm vụ này.

Tham chiếu API: [Supabase select](https://supabase.com/docs/reference/javascript/select), [range](https://supabase.com/docs/reference/javascript/range), [upsert](https://supabase.com/docs/reference/javascript/upsert), [joins](https://supabase.com/docs/guides/database/joins-and-nesting), [Expo Router SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/router/).


## Kết quả cuối cùng

- npm run typecheck / tsc --noEmit: PASS.
- npm test: 36/36 PASS, gồm 7 test Auth được giữ và 29 test DAL/calculation/service. HTTP write tests chỉ dùng mock.
- ESLint với cấu hình Expo tạm: 0 errors, 2 warnings có sẵn tại app/index.tsx (SCREEN_WIDTH) và src/components/articles/ArticleCard.tsx (Image). Không thêm lint dependencies/config vào commit.
- expo export --platform web: PASS, Metro bundle thành công. Đây là kiểm tra build, không phải kiểm thử thao tác trên device.
- Read-only smoke check thật: foods SELECT/pagination trả một hàng với count tổng 15; by-id/search/category filter hoạt động; đọc được 6 category; per-100g calculation finite. Tám SELECT LIMIT 0 và meal-food embed đều được chấp nhận. Không in dữ liệu bản ghi hoặc credentials.
- Chưa chạy authenticated-client CRUD/RLS E2E, cũng chưa chạy iOS/Android device tests. Không thay đổi schema/policy/Auth configuration và không ghi/xóa dữ liệu production.
