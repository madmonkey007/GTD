import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { request } from '../api/client';
import type { AdminUser } from '../api/admin';

interface DataItem {
  id: number;
  user_id: number;
  name?: string | null;
  description?: string | null;
  user_notes?: string | null;
  status?: string | null;
  priority?: string | null;
  color?: string | null;
  is_archived?: boolean;
  content_objective?: string | null;
  content_ai?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const RESOURCES = [
  { value: 'todo', label: '待办' },
  { value: 'journal', label: '笔记' },
  { value: 'project', label: '项目' },
  { value: 'collection', label: '集合' },
] as const;

type ResourceValue = (typeof RESOURCES)[number]['value'];

const EDITABLE_FIELDS: Record<ResourceValue, string[]> = {
  todo: ['name', 'description', 'user_notes', 'status', 'priority'],
  journal: ['name', 'user_notes'],
  project: ['name', 'description', 'color', 'is_archived'],
  collection: ['name', 'description'],
};

const FIELD_LABELS: Record<string, string> = {
  name: '名称',
  description: '描述',
  user_notes: '内容',
  status: '状态',
  priority: '优先级',
  color: '颜色',
  is_archived: '已归档',
};

const DETAIL_FIELDS: Record<ResourceValue, { key: keyof DataItem; label: string }[]> = {
  todo: [
    { key: 'description', label: '描述' },
    { key: 'user_notes', label: '用户笔记' },
  ],
  journal: [
    { key: 'user_notes', label: '笔记内容' },
    { key: 'content_objective', label: '客观记录' },
    { key: 'content_ai', label: 'AI 视角' },
  ],
  project: [{ key: 'description', label: '描述' }],
  collection: [{ key: 'description', label: '描述' }],
};

const TRUNCATE_LEN = 120;

function truncate(v: string | null | undefined): string {
  if (!v) return '';
  return v.length > TRUNCATE_LEN ? `${v.slice(0, TRUNCATE_LEN)}…` : v;
}

function fmt(v: string | null | undefined): string {
  return v ? v.slice(0, 19).replace('T', ' ') : '-';
}

export function DataManage() {
  const [resource, setResource] = useState<ResourceValue>('todo');
  const [items, setItems] = useState<DataItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterUserId, setFilterUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<DataItem | null>(null);
  const [viewing, setViewing] = useState<DataItem | null>(null);
  const [form] = Form.useForm<Record<string, string | number | boolean | undefined>>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (search) params.set('search', search);
      if (filterUserId !== null) params.set('user_id', String(filterUserId));
      const data = await request<{ total: number; items: DataItem[] }>(
        `/api/admin/data/${resource}?${params.toString()}`,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [resource, page, pageSize, search, filterUserId]);

  useEffect(() => {
    request<AdminUser[]>('/api/admin/users')
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (item: DataItem) => {
    setEditing(item);
    const fields: Record<string, string | number | boolean | undefined> = {};
    for (const f of EDITABLE_FIELDS[resource]) {
      fields[f] = item[f as keyof DataItem] ?? undefined;
    }
    form.setFieldsValue(fields);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const values: Record<string, unknown> = await form.validateFields();
    try {
      await request(`/api/admin/data/${resource}/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
      message.success('已保存');
      setEditing(null);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const remove = async (id: number) => {
    try {
      await request(`/api/admin/data/${resource}/${id}`, { method: 'DELETE' });
      message.success('已删除（软删除，已写同步墓碑）');
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '用户',
      dataIndex: 'user_id',
      width: 140,
      render: (v: number) => {
        const u = users.find((x) => x.id === v);
        return u ? `${u.display_name ?? u.email} (#${v})` : `#${v}`;
      },
    },
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: '详情',
      width: 240,
      ellipsis: true,
      render: (_: unknown, record: DataItem) => {
        const fields = DETAIL_FIELDS[resource];
        const text = fields
          .map((f) => record[f.key])
          .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
          .join('\n');
        if (!text) return <Typography.Text type="secondary">-</Typography.Text>;
        return (
          <a onClick={() => setViewing(record)}>{truncate(text.replace(/[#*_>`~\[\]]/g, ''))}</a>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (v: string | null) => v ?? '-',
    },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: fmt },
    { title: '更新时间', dataIndex: 'updated_at', width: 160, render: fmt },
    {
      title: '操作',
      width: 140,
      render: (_: unknown, record: DataItem) => (
        <Space>
          <a onClick={() => openEdit(record)}>编辑</a>
          <Popconfirm
            title="确认删除该记录？（软删除并写同步墓碑）"
            onConfirm={() => void remove(record.id)}
          >
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="数据管理"
      extra={
        <Space>
          <Select<ResourceValue>
            value={resource}
            style={{ width: 120 }}
            onChange={(v) => {
              setResource(v);
              setPage(1);
              setSearch('');
              setSearchInput('');
              setFilterUserId(null);
            }}
            options={RESOURCES.map((r) => ({ value: r.value, label: r.label }))}
          />
          <Select<number | null>
            value={filterUserId}
            style={{ width: 180 }}
            placeholder="按用户筛选"
            allowClear
            showSearch
            optionFilterProp="label"
            onChange={(v) => {
              setFilterUserId(v ?? null);
              setPage(1);
            }}
            options={users.map((u) => ({
              value: u.id,
              label: `${u.display_name ?? u.email} (#${u.id})`,
            }))}
          />
          <Input
            placeholder="搜索名称/内容"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={() => {
              setPage(1);
              setSearch(searchInput);
            }}
            style={{ width: 200 }}
            allowClear
          />
          <Button
            icon={<SearchOutlined />}
            onClick={() => {
              setPage(1);
              setSearch(searchInput);
            }}
          >
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} />
        </Space>
      }
    >
      <Table<DataItem>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={`详情 · ${viewing?.name ?? ''}`}
        open={viewing !== null}
        onCancel={() => setViewing(null)}
        footer={null}
        width={640}
      >
        {viewing !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {DETAIL_FIELDS[resource].map((f) => {
              const value = viewing[f.key];
              return (
                <div key={String(f.key)}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {f.label}
                  </Typography.Text>
                  <Typography.Paragraph
                    style={{ whiteSpace: 'pre-wrap', marginBottom: 0, wordBreak: 'break-word' }}
                  >
                    {typeof value === 'string' && value.trim() !== '' ? value : '（空）'}
                  </Typography.Paragraph>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Drawer
        title={`编辑${RESOURCES.find((r) => r.value === resource)?.label ?? ''} #${editing?.id ?? ''}`}
        open={editing !== null}
        onClose={() => setEditing(null)}
        width={480}
        extra={
          <Button type="primary" onClick={() => void saveEdit()}>
            保存
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          {editing !== null &&
            EDITABLE_FIELDS[resource].map((f) => {
              if (f === 'status') {
                return (
                  <Form.Item key={f} name={f} label={FIELD_LABELS[f]}>
                    <Select
                      allowClear
                      options={['active', 'completed', 'cancelled'].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                    />
                  </Form.Item>
                );
              }
              if (f === 'priority') {
                return (
                  <Form.Item key={f} name={f} label={FIELD_LABELS[f]}>
                    <Select
                      allowClear
                      options={['high', 'medium', 'low', 'none'].map((v) => ({
                        value: v,
                        label: v,
                      }))}
                    />
                  </Form.Item>
                );
              }
              if (f === 'is_archived') {
                return (
                  <Form.Item key={f} name={f} label={FIELD_LABELS[f]} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                );
              }
              if (f === 'description' || f === 'user_notes') {
                return (
                  <Form.Item key={f} name={f} label={FIELD_LABELS[f]}>
                    <Input.TextArea rows={6} />
                  </Form.Item>
                );
              }
              return (
                <Form.Item key={f} name={f} label={FIELD_LABELS[f]}>
                  <Input />
                </Form.Item>
              );
            })}
        </Form>
      </Drawer>
    </Card>
  );
}
