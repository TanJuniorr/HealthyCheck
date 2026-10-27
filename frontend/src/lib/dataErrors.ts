export type DataErrorCode = 'UNAUTHENTICATED' | 'AUTH_CHANGED' | 'PERMISSION_DENIED' | 'NOT_FOUND' | 'NETWORK' | 'INVALID_INPUT' | 'CONSTRAINT' | 'DATABASE';
export class DataAccessError extends Error {
  constructor(public readonly code: DataErrorCode, message: string) { super(message); this.name = 'DataAccessError'; }
}
export function invalid(message: string): never { throw new DataAccessError('INVALID_INPUT', message); }
export function dataError(error: unknown): DataAccessError {
  if (error instanceof DataAccessError) return error;
  const value = error as { code?: string; status?: number; message?: string; name?: string } | null;
  const code = value?.code ?? '';
  if (value?.name === 'AuthSessionMissingError' || ['session_not_found','refresh_token_not_found','bad_jwt'].includes(code) || value?.status === 401 || code === 'PGRST301' || code === 'PGRST303') return new DataAccessError('UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  if (code === '42501' || value?.status === 403) return new DataAccessError('PERMISSION_DENIED', 'Bạn không có quyền truy cập dữ liệu này.');
  if (code.startsWith('23')) return new DataAccessError('CONSTRAINT', 'Dữ liệu vi phạm ràng buộc. Hãy kiểm tra thông tin và thử lại.');
  if (/fetch|network|connection/i.test(value?.message ?? '')) return new DataAccessError('NETWORK', 'Không thể kết nối máy chủ. Vui lòng thử lại.');
  return new DataAccessError('DATABASE', 'Không tải hoặc lưu được dữ liệu. Vui lòng thử lại.');
}
