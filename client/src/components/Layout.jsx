import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

const Header = lazy(() => import('./Header'));

const Layout = () => {
  return (
    <main className='flex flex-col min-h-screen w-full'>
      <Suspense fallback={<LoadingSpinner />}>
        <Header />
        <div className='flex-1 overflow-y-auto p-4 md:p-8'>
          <Outlet />
        </div>
      </Suspense>
    </main>
  );
};

export default Layout;
