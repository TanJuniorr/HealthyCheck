export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function authErrorMessage(error: unknown): string {
  const value = error as { code?: string; status?: number; message?: string } | null;
  const code = value?.code;
  const message = value?.message?.toLowerCase() ?? '';
  if (code === 'invalid_credentials') return 'Email hoặc mật khẩu không đúng.';
  if (code === 'email_not_confirmed') return 'Vui lòng xác nhận email trước khi đăng nhập.';
  if (code === 'user_already_exists' || code === 'email_exists') return 'Không thể đăng ký email này. Hãy đăng nhập hoặc khôi phục mật khẩu.';
  if (code === 'weak_password' || code === 'same_password') return 'Hãy chọn mật khẩu mới mạnh hơn, có ít nhất 8 ký tự.';
  if (message.includes('provider is not enabled') || message.includes('provider is disabled')) return 'auth.googleNotEnabled';
  if (message.includes('redirect_uri_mismatch') || message.includes('redirect uri') || message.includes('redirect_to')) return 'auth.googleRedirectError';
  if (message.includes('access_denied') || message.includes('user denied')) return 'auth.googleCancelled';
  if (value?.status === 429 || message.includes('rate limit')) return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ rồi thử lại.';
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) return 'Không thể kết nối máy chủ. Hãy kiểm tra mạng và thử lại.';
  if (code?.includes('expired') || code?.includes('flow_state') || code?.includes('code_verifier')) return 'Liên kết đã hết hạn hoặc không hợp lệ. Hãy gửi yêu cầu mới trên thiết bị này.';
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại sau.';
}
