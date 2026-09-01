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
  const body = await res.json();
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? '登录失败');
  }
  return body.data.access_token as string;
}
