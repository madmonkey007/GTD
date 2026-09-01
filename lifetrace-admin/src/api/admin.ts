export interface AdminUser {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  disabled: boolean;
  created_at: string | null;
}

export interface StatsOverview {
  users: number;
  todos: number;
  journals: number;
  projects: number;
}

export interface GrowthPoint {
  date: string;
  count: number;
}

export interface LlmCostItem {
  model: string | null;
  total_tokens: number;
  total_cost: number;
  calls: number;
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : '登录失败';
    throw new Error(detail);
  }
  // 兼容两种返回：{success,data} 封装 或 裸 JSON（/api/auth/login 返回裸 JSON）
  const payload =
    typeof body === 'object' && body !== null && 'success' in body
      ? ((body as unknown as { data: { access_token?: string } | null } | null)?.data ?? null)
      : (body as { access_token?: string });
  const token = payload?.access_token;
  if (!token) {
    throw new Error('登录响应缺少 token');
  }
  return token;
}
