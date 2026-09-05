import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Switch, Table, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { request } from '../api/client';
import type { AdminUser } from '../api/admin';

export function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm<{ email: string; password: string; display_name?: string; role: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await request<AdminUser[]>('/api/admin/users'));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载用户失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (id: number, payload: Record<string, unknown>) => {
    try {
      await request(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  const resetPassword = async (id: number) => {
    let newPassword = '';
    Modal.confirm({
      title: '重置密码',
      content: (
        <Input.Password
          placeholder="新密码（至少 8 位）"
          onChange={(e) => {
            newPassword = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        if (newPassword.length < 8) {
          message.error('密码至少 8 位');
          throw new Error('too short');
        }
        await request(`/api/admin/users/${id}/reset-password`, {
          method: 'POST',
          body: JSON.stringify({ new_password: newPassword }),
        });
        message.success('密码已重置');
      },
    });
  };

  const onCreate = async () => {
    const values = await createForm.validateFields();
    try {
      await request('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('用户已创建');
      setCreateOpen(false);
      createForm.resetFields();
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  return (
    <Card
      title="用户管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建用户
        </Button>
      }
    >
      <Table<AdminUser>
        rowKey="id"
        loading={loading}
        dataSource={users}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '邮箱', dataIndex: 'email' },
          { title: '昵称', dataIndex: 'display_name', render: (v) => v ?? '-' },
          {
            title: '角色',
            dataIndex: 'role',
            width: 140,
            render: (role: string, record) => (
              <Select
                value={role}
                style={{ width: 110 }}
                onChange={(v) => void update(record.id, { role: v })}
                options={[
                  { value: 'admin', label: '管理员' },
                  { value: 'user', label: '用户' },
                ]}
              />
            ),
          },
          {
            title: '状态',
            dataIndex: 'disabled',
            width: 100,
            render: (disabled: boolean, record) => (
              <Switch
                checked={!disabled}
                checkedChildren="启用"
                unCheckedChildren="禁用"
                onChange={(enabled) => void update(record.id, { disabled: !enabled })}
              />
            ),
          },
          {
            title: '创建时间',
            dataIndex: 'created_at',
            render: (v: string | null) => (v ? v.slice(0, 19).replace('T', ' ') : '-'),
          },
          {
            title: '操作',
            width: 120,
            render: (_, record) => (
              <Popconfirm
                title="确认重置该用户密码？"
                onConfirm={() => void resetPassword(record.id)}
              >
                <a>重置密码</a>
              </Popconfirm>
            ),
          },
        ]}
      />

      <Modal
        title="新建用户"
        open={createOpen}
        onOk={() => void onCreate()}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={createForm} layout="vertical" initialValues={{ role: 'user' }}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '至少 8 位' },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="display_name" label="昵称（可选）">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select
              options={[
                { value: 'user', label: '用户' },
                { value: 'admin', label: '管理员' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
