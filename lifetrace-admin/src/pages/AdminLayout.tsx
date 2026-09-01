import {
  DashboardOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Layout, Menu, message } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearToken } from '../api/client';

const { Header, Sider, Content } = Layout;

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = location.pathname.startsWith('/users')
    ? 'users'
    : location.pathname.startsWith('/data')
      ? 'data'
      : 'dashboard';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div
          style={{
            color: '#fff',
            padding: 16,
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          LifeTrace 管理后台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
            { key: 'data', icon: <DatabaseOutlined />, label: '数据管理' },
            { key: 'users', icon: <TeamOutlined />, label: '用户管理' },
          ]}
          onClick={({ key }) => navigate(key === 'dashboard' ? '/' : `/${key}`)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingInline: 24,
          }}
        >
          <a
            onClick={() => {
              clearToken();
              message.success('已退出登录');
              navigate('/login', { replace: true });
            }}
          >
            <LogoutOutlined /> 退出登录
          </a>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
