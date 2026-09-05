import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Modal,
  Popconfirm,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { request } from '../api/client';

interface JobInfo {
  id: string;
  name?: string | null;
  func: string;
  trigger: string;
  next_run_time?: string | null;
  paused: boolean;
}

interface LogFile {
  name: string;
  size_kb: string;
  modified: string;
}

interface DbInfo {
  path: string;
  size_mb: number;
  page_count: number;
  freelist_pages: number;
  page_size: number;
}

interface BackupItem {
  name: string;
  size_mb: number;
  created_at: string;
}

function fmt(v: string | null | undefined): string {
  return v ? v.slice(0, 19).replace('T', ' ') : '-';
}

export function Ops() {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [confirmVacuum, setConfirmVacuum] = useState(false);

  const load = useCallback(async () => {
    try {
      const [j, lf, db, bk] = await Promise.all([
        request<{ jobs: JobInfo[] }>('/api/admin/ops/scheduler/jobs'),
        request<LogFile[]>('/api/admin/ops/logs/files'),
        request<DbInfo>('/api/admin/ops/db/info'),
        request<BackupItem[]>('/api/admin/ops/backup/list'),
      ]);
      setJobs(j.jobs);
      setLogFiles(lf);
      setDbInfo(db);
      setBackups(bk);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const jobAction = async (id: string, action: 'pause' | 'resume') => {
    try {
      await request(`/api/admin/ops/scheduler/jobs/${id}/${action}`, {
        method: 'POST',
      });
      message.success(action === 'pause' ? '已暂停' : '已恢复');
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const viewLog = async (name: string) => {
    setSelectedLog(name);
    try {
      const text = await request<string>(
        `/api/admin/ops/logs/content?file=${encodeURIComponent(name)}&lines=300`,
      );
      setLogContent(typeof text === 'string' ? text : String(text));
      setLogViewerOpen(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '读取日志失败');
    }
  };

  const vacuum = async () => {
    try {
      const r = await request<{ message: string }>('/api/admin/ops/db/vacuum', {
        method: 'POST',
      });
      message.success(r.message);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'VACUUM 失败');
    }
  };

  const createBackup = async () => {
    try {
      const r = await request<{ message: string }>('/api/admin/ops/backup/create', {
        method: 'POST',
      });
      message.success(r.message);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '备份失败');
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card title="调度任务" extra={<Button icon={<ReloadOutlined />} onClick={() => void load()} />}>
        <Table<JobInfo>
          rowKey="id"
          dataSource={jobs}
          pagination={false}
          size="small"
          columns={[
            { title: 'ID', dataIndex: 'id', width: 200 },
            { title: '名称', dataIndex: 'name', render: (v) => v ?? '-' },
            { title: '函数', dataIndex: 'func', ellipsis: true },
            { title: '触发器', dataIndex: 'trigger', width: 160, ellipsis: true },
            {
              title: '下次运行',
              dataIndex: 'next_run_time',
              width: 170,
              render: (v: string | null) => (v ? fmt(v) : <Tag>已暂停</Tag>),
            },
            {
              title: '操作',
              width: 120,
              render: (_, record) =>
                record.paused ? (
                  <a onClick={() => void jobAction(record.id, 'resume')}>
                    <PlayCircleOutlined /> 恢复
                  </a>
                ) : (
                  <Popconfirm title="确认暂停该任务？" onConfirm={() => void jobAction(record.id, 'pause')}>
                    <a style={{ color: '#d46b08' }}>
                      <PauseCircleOutlined /> 暂停
                    </a>
                  </Popconfirm>
                ),
            },
          ]}
        />
      </Card>

      <Card
        title="日志查看"
        extra={<FileTextOutlined />}
      >
        <Table<LogFile>
          rowKey="name"
          dataSource={logFiles.slice(0, 10)}
          pagination={false}
          size="small"
          columns={[
            { title: '文件', dataIndex: 'name' },
            { title: '大小', dataIndex: 'size_kb', width: 100, render: (v) => `${v} KB` },
            { title: '修改时间', dataIndex: 'modified', width: 170, render: fmt },
            {
              title: '操作',
              width: 80,
              render: (_, record) => (
                <a onClick={() => void viewLog(record.name)}>查看</a>
              ),
            },
          ]}
        />
      </Card>

      <Card title="数据库维护" extra={<DatabaseOutlined />}>
        {dbInfo && (
          <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="路径">{dbInfo.path}</Descriptions.Item>
            <Descriptions.Item label="大小">
              <Statistic value={dbInfo.size_mb} suffix="MB" precision={2} valueStyle={{ fontSize: 16 }} />
            </Descriptions.Item>
            <Descriptions.Item label="空闲页">{dbInfo.freelist_pages}</Descriptions.Item>
            <Descriptions.Item label="页大小">{dbInfo.page_size} B</Descriptions.Item>
          </Descriptions>
        )}
        <Space>
          <Popconfirm
            title="VACUUM 会重组数据库文件，可能耗时数秒。确认执行？"
            onConfirm={() => void vacuum()}
            open={confirmVacuum}
            onOpenChange={setConfirmVacuum}
          >
            <Button>执行 VACUUM</Button>
          </Popconfirm>
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => void createBackup()}>
            创建备份
          </Button>
        </Space>
        <Table<BackupItem>
          rowKey="name"
          dataSource={backups}
          pagination={false}
          size="small"
          style={{ marginTop: 16 }}
          columns={[
            { title: '备份文件', dataIndex: 'name' },
            { title: '大小', dataIndex: 'size_mb', width: 120, render: (v) => `${v} MB` },
            { title: '创建时间', dataIndex: 'created_at', width: 170, render: fmt },
          ]}
        />
      </Card>

      <Modal
        title={`日志：${selectedLog ?? ''}`}
        open={logViewerOpen}
        onCancel={() => setLogViewerOpen(false)}
        footer={null}
        width={900}
      >
        <pre
          style={{
            maxHeight: 500,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
            background: '#f6f6f6',
            padding: 12,
          }}
        >
          {logContent}
        </pre>
      </Modal>
    </Space>
  );
}
