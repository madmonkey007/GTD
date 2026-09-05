import { useEffect, useState } from 'react';
import { Card, Col, Row, Spin, Statistic, Table, Typography } from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { request } from '../api/client';
import type { GrowthPoint, LlmCostItem, StatsOverview } from '../api/admin';

export function Dashboard() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [costs, setCosts] = useState<LlmCostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [o, g, c] = await Promise.all([
          request<StatsOverview>('/api/admin/stats/overview'),
          request<{ series: GrowthPoint[] }>('/api/admin/stats/growth'),
          request<{ items: LlmCostItem[] }>('/api/admin/stats/llm-cost'),
        ]);
        if (cancelled) return;
        setOverview(o);
        setGrowth(g.series);
        setCosts(c.items);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 80 }} />;
  if (error) return <Typography.Text type="danger">{error}</Typography.Text>;

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="用户数" value={overview?.users ?? 0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="待办总数"
              value={overview?.todos ?? 0}
              prefix={<UnorderedListOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="笔记总数" value={overview?.journals ?? 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="项目总数" value={overview?.projects ?? 0} prefix={<FolderOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title="近 30 天新增（用户+笔记+待办）" style={{ marginTop: 16 }}>
        <Table<GrowthPoint>
          size="small"
          rowKey="date"
          dataSource={growth}
          pagination={{ pageSize: 7, hideOnSinglePage: true }}
          columns={[
            { title: '日期', dataIndex: 'date' },
            { title: '新增数量', dataIndex: 'count' },
          ]}
        />
      </Card>

      <Card title="LLM 用量成本" style={{ marginTop: 16 }}>
        <Table<LlmCostItem>
          size="small"
          rowKey={(r) => r.model ?? 'unknown'}
          dataSource={costs}
          pagination={false}
          columns={[
            { title: '模型', dataIndex: 'model', render: (v) => v ?? 'unknown' },
            { title: '调用次数', dataIndex: 'calls' },
            { title: '总 Token', dataIndex: 'total_tokens' },
            {
              title: '总成本（元）',
              dataIndex: 'total_cost',
              render: (v: number) => v.toFixed(4),
            },
          ]}
        />
      </Card>
    </div>
  );
}
