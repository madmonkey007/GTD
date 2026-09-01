const TOKEN_KEY = 'admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(path, { ...init, headers });
  let body: ApiResult<T> | null = null;
  try {
    body = (await response.json()) as ApiResult<T>;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail =
      body?.error ?? (typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `请求失败（${response.status}）`);
    throw new ApiError(response.status, detail);
  }
  if (body === null) {
    throw new ApiError(response.status, `请求失败（${response.status}）`);
  }
  // 兼容两种返回：{success,data,error} 封装 或 原始 JSON
  return (body.success ? body.data : body) as T;
}
