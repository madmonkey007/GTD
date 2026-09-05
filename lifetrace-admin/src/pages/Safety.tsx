import { useCallback, useEffect, useState } from 'react';
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { request } from '../api/client';

export interface KeywordRule {
  id: number;
  pattern: string;
  is_regex: boolean;
  category: string;
  action: 'flag' | 'block' | 'delete';
  enabled: boolean;
  remark: string;
  created_at: string | null;
}

export interface Violation {
  id: number;
  user_id: number;
  resource_type: string;
  resource_id: number;
  rule_pattern: string;
  matched_excerpt: string;
  action_taken: string;
  status: 'pending' | 'resolved' | 'ignored';
  created_at: string | null;
  resolved_at: string | null;
}

export interface SafetyStats {
  total_rules: number;
  enabled_rules: number;
  pending_violations: number;
  total_violations: number;
  by_action: Record<string, number>;
}

const ACTION_LABEL: Record<string, { text: string; color: string }> = {
  flag: { text: '标记', color: 'blue' },
  block: { text: '阻止', color: 'red' },
  delete: { text: '删除', color: 'orange' },
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'warning' },
  resolved: { text: '已删除', color: 'success' },
  ignored: { text: '已忽略', color: 'default' },
};

const RESOURCE_LABEL: Record<string, string> = {
  todo: '待办',
  journal: '笔记',
  project: '项目',
  collection: '收藏',
};

function loadRules(): Promise<KeywordRule[]> {
  return request<KeywordRule[]>('/api/admin/safety/keywords');
}

function loadViolations(params: URLSearchParams): Promise<{ total: number; items: Violation[] }> {
  return request<{ total: number; items: Violation[] }>(
    `/api/admin/safety/violations?${params.toString()}`,
  );
}

function loadStats(): Promise<SafetyStats> {
  return request<SafetyStats>('/api/admin/safety/stats');
}

function RuleDrawer({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: KeywordRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue(editing);
      }
    }
  }, [open, editing, form]);

  const save = useCallback(async () => {
    try {
      const values = (await form.validateFields()) as {
        pattern: string;
        is_regex: boolean;
        category: string;
        action: KeywordRule['action'];
        enabled: boolean;
        remark: string;
      };
      setSaving(true);
      if (editing) {
        await request(`/api/admin/safety/keywords/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
      } else {
        await request('/api/admin/safety/keywords', {
          method: 'POST',
          body: JSON.stringify(values),
        });
      }
      message.success('已保存');
      onSaved();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }, [editing, form, onSaved]);

  return (
    <Drawer
      title={editing ? '编辑关键字' : '新增关键字'}
      open={open}
      onClose={onClose}
      width={420}
      extra={
        <Button type="primary" loading={saving} onClick={() => void save()}>
          保存
        </Button>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          is_regex: false,
          category: 'custom',
          action: 'flag',
          enabled: true,
          remark: '',
        }}
      >
        <Form.Item
          name="pattern"
          label="关键字 / 正则表达式"
          rules={[{ required: true, message: '请输入关键字' }]}
        >
          <Input placeholder="如：赌博 / ^@推广.+$" />
        </Form.Item>
        <Form.Item name="is_regex" label="正则模式" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="action" label="命中动作">
          <Select
            options={[
              { value: 'flag', label: '标记（仅记录，供人工审核）' },
              { value: 'block', label: '阻止（禁止提交该内容）' },
              { value: 'delete', label: '删除（自动软删除+同步墓碑）' },
            ]}
          />
        </Form.Item>
        <Form.Item name="category" label="分类">
          <Input placeholder="如：广告 / 色情 / custom" />
        </Form.Item>
        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={2} maxLength={200} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function BatchImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('custom');
  const [action, setAction] = useState<KeywordRule['action']>('flag');
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    const patterns = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (patterns.length === 0) {
      message.warning('请输入至少一行关键字');
      return;
    }
    setBusy(true);
    try {
      const res = await request<{ created: number }>(
        '/api/admin/safety/keywords/batch',
        { method: 'POST', body: JSON.stringify({ patterns, category, action }) },
      );
      message.success(`已导入 ${res.created} 条`);
      setText('');
      onDone();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  }, [action, category, onDone, text]);

  return (
    <Modal
      title="批量导入关键字"
      open={open}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={busy}
      okText="导入"
      width={480}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Input.TextArea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'每行一个关键字，自动去重\n如：赌博\n诈骗'}
        />
        <Space>
          <Select
            value={category}
            style={{ width: 140 }}
            onChange={setCategory}
            options={[
              { value: 'custom', label: '自定义' },
              { value: 'ad', label: '广告' },
              { value: 'porn', label: '色情' },
              { value: 'gambling', label: '赌博' },
              { value: 'fraud', label: '诈骗' },
            ]}
          />
          <Select
            value={action}
            style={{ width: 140 }}
            onChange={setAction}
            options={[
              { value: 'flag', label: '标记' },
              { value: 'block', label: '阻止' },
              { value: 'delete', label: '删除' },
            ]}
          />
        </Space>
      </Space>
    </Modal>
  );
}

export function Safety() {
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [violationTotal, setViolationTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'ignored' | 'all'>(
    'pending',
  );
  const [stats, setStats] = useState<SafetyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<KeywordRule | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      params.set('skip', String((page - 1) * 20));
      params.set('limit', '20');
      const [ruleList, vData, statData] = await Promise.all([
        loadRules(),
        loadViolations(params),
        loadStats(),
      ]);
      setRules(ruleList);
      setViolations(vData.items);
      setViolationTotal(vData.total);
      setStats(statData);
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleRule = useCallback(
    async (rule: KeywordRule) => {
      try {
        await request(`/api/admin/safety/keywords/${rule.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
        });
        void refresh();
      } catch (err) {
        if (err instanceof Error) {
          message.error(err.message);
        }
      }
    },
    [refresh],
  );

  const removeRule = useCallback(
    async (id: number) => {
      try {
        await request(`/api/admin/safety/keywords/${id}`, { method: 'DELETE' });
        message.success('已删除');
        void refresh();
      } catch (err) {
        if (err instanceof Error) {
          message.error(err.message);
        }
      }
    },
    [refresh],
  );

  const resolveViolation = useCallback(
    async (id: number, decision: 'delete' | 'ignore') => {
      try {
        await request(`/api/admin/safety/violations/${id}/resolve`, {
          method: 'POST',
          body: JSON.stringify({ decision }),
        });
        message.success(decision === 'delete' ? '已删除内容' : '已忽略');
        void refresh();
      } catch (err) {
        if (err instanceof Error) {
          message.error(err.message);
        }
      }
    },
    [refresh],
  );

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await request<{ scanned: number; hits: number }>('/api/admin/safety/scan', {
        method: 'POST',
      });
      message.success(`扫描 ${res.scanned} 条内容，命中 ${res.hits} 条`);
      void refresh();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  const ruleColumns: ColumnsType<KeywordRule> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '关键字',
      dataIndex: 'pattern',
      render: (v: string, r) => (
        <Space size={4}>
          <span>{v}</span>
          {r.is_regex ? <Tag color="purple">正则</Tag> : null}
        </Space>
      ),
    },
    { title: '分类', dataIndex: 'category', width: 110 },
    {
      title: '动作',
      dataIndex: 'action',
      width: 90,
      render: (v: string) => {
        const info = ACTION_LABEL[v] ?? { text: v, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (_: boolean, r) => (
        <Switch size="small" checked={r.enabled} onChange={() => void toggleRule(r)} />
      ),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '操作',
      key: 'op',
      width: 130,
      render: (_: unknown, r) => (
        <Space size={8}>
          <a
            onClick={() => {
              setEditing(r);
              setDrawerOpen(true);
            }}
          >
            编辑
          </a>
          <Popconfirm title="确认删除该规则？" onConfirm={() => void removeRule(r.id)}>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const violationColumns: ColumnsType<Violation> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户', dataIndex: 'user_id', width: 70 },
    {
      title: '内容类型',
      dataIndex: 'resource_type',
      width: 90,
      render: (v: string) => RESOURCE_LABEL[v] ?? v,
    },
    { title: '内容 ID', dataIndex: 'resource_id', width: 80 },
    {
      title: '命中片段',
      dataIndex: 'matched_excerpt',
      render: (v: string) => (
        <code style={{ background: '#fff7e6', padding: '2px 6px', borderRadius: 4 }}>{v}</code>
      ),
    },
    { title: '规则', dataIndex: 'rule_pattern', width: 140, ellipsis: true },
    {
      title: '动作',
      dataIndex: 'action_taken',
      width: 80,
      render: (v: string) => {
        const info = ACTION_LABEL[v] ?? { text: v, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => {
        const info = STATUS_LABEL[v] ?? { text: v, color: 'default' };
        return <Badge status={info.color === 'warning' ? 'warning' : info.color === 'success' ? 'success' : 'default'} text={info.text} />;
      },
    },
    {
      title: '操作',
      key: 'op',
      width: 140,
      render: (_: unknown, r) =>
        r.status === 'pending' ? (
          <Space size={8}>
            <Popconfirm
              title="确认删除该内容？（软删除并同步到所有端）"
              onConfirm={() => void resolveViolation(r.id, 'delete')}
            >
              <Button danger size="small">
                删除
              </Button>
            </Popconfirm>
            <Button size="small" onClick={() => void resolveViolation(r.id, 'ignore')}>
              忽略
            </Button>
          </Space>
        ) : (
          <span style={{ color: '#999' }}>—</span>
        ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size={32} wrap>
          <Spin spinning={!stats}>
            <Statistic
              title="规则总数"
              value={stats?.total_rules ?? 0}
              suffix={stats ? `/ 启用 ${stats.enabled_rules}` : ''}
            />
          </Spin>
          <Spin spinning={!stats}>
            <Statistic
              title="待处理违规"
              valueStyle={{ color: '#cf1322' }}
              value={stats?.pending_violations ?? 0}
              prefix={<SafetyOutlined />}
            />
          </Spin>
          <Spin spinning={!stats}>
            <Statistic title="累计违规" value={stats?.total_violations ?? 0} />
          </Spin>
          <Button
            icon={<ReloadOutlined />}
            loading={scanning}
            onClick={() => void runScan()}
          >
            全量扫描
          </Button>
        </Space>
      </Card>
      <Tabs
        items={[
          {
            key: 'keywords',
            label: '关键字规则',
            children: (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditing(null);
                      setDrawerOpen(true);
                    }}
                  >
                    新增关键字
                  </Button>
                  <Button icon={<UploadOutlined />} onClick={() => setBatchOpen(true)}>
                    批量导入
                  </Button>
                </Space>
                <Table
                  rowKey="id"
                  columns={ruleColumns}
                  dataSource={rules}
                  loading={loading}
                  pagination={false}
                  size="middle"
                />
              </div>
            ),
          },
          {
            key: 'violations',
            label: '违规记录',
            children: (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Select
                    value={statusFilter}
                    style={{ width: 140 }}
                    onChange={(v) => {
                      setStatusFilter(v);
                      setPage(1);
                    }}
                    options={[
                      { value: 'pending', label: '待处理' },
                      { value: 'resolved', label: '已删除' },
                      { value: 'ignored', label: '已忽略' },
                      { value: 'all', label: '全部' },
                    ]}
                  />
                </Space>
                <Table
                  rowKey="id"
                  columns={violationColumns}
                  dataSource={violations}
                  loading={loading}
                  size="middle"
                  pagination={{
                    current: page,
                    pageSize: 20,
                    total: violationTotal,
                    showTotal: (t) => `共 ${t} 条`,
                    onChange: setPage,
                  }}
                />
              </div>
            ),
          },
        ]}
      />
      <RuleDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false);
          void refresh();
        }}
      />
      <BatchImportModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onDone={() => {
          setBatchOpen(false);
          void refresh();
        }}
      />
    </div>
  );
}
