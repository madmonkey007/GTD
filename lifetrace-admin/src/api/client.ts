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
  const contentType = response.headers.get('content-type') ?? '';
  let body: ApiResult<T> | string | null = null;
  if (contentType.includes('application/json')) {
    try {
      body = (await response.json()) as ApiResult<T>;
    } catch {
      body = null;
    }
  } else {
    body = await response.text();
  }
  if (!response.ok) {
    const apiBody = typeof body === 'object' && body !== null ? body : null;
    const detail =
      apiBody?.error ??
      (typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `请求失败（${response.status}）`);
    throw new ApiError(response.status, detail);
  }
  if (body === null) {
    throw new ApiError(response.status, `请求失败（${response.status}）`);
  }
  if (typeof body === 'string') {
    return body as unknown as T;
  }
  // 兼容两种返回：{success,data,error} 封装 或 原始 JSON
  return (body.success ? body.data : body) as T;
}
