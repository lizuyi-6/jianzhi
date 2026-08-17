import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import SideNav from './SideNav';
import ToastHost from './Toast';

export default function Layout() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-body">
        <SideNav />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
