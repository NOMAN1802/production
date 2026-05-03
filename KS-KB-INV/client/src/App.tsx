import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import ShellLayout from '@/components/layout/ShellLayout';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import ProductsPage from '@/pages/products/ProductsPage';
import ProductFormPage from '@/pages/products/ProductFormPage';
import PurchaseProductPage from '@/pages/products/PurchaseProductPage';
import PurchaseListPage from '@/pages/purchases/PurchaseListPage';
import EditPurchasePage from '@/pages/purchases/EditPurchasePage';
import PendingProductsPage from '@/pages/pending-products/PendingProductsPage';
import AddPendingProductsPage from '@/pages/pending-products/AddPendingProductsPage';
import CategoriesPage from '@/pages/categories/CategoriesPage';
import UnitsPage from '@/pages/units/UnitsPage';
import SuppliersPage from '@/pages/suppliers/SuppliersPage';
import InvoicesPage from '@/pages/invoices/InvoicesPage';
import CreateSalePage from '@/pages/invoices/CreateSalePage';
import EditOrderPage from '@/pages/invoices/EditOrderPage';
import PrintInvoicePage from '@/pages/invoices/PrintInvoicePage';
import TodaysOrdersPage from '@/pages/orders/TodaysOrdersPage';
import ReturnsPage from '@/pages/returns/ReturnsPage';
import ProcessReturnPage from '@/pages/returns/ProcessReturnPage';
import PrintReturnPage from '@/pages/returns/PrintReturnPage';
import DamagesPage from '@/pages/damages/DamagesPage';
import ReportDamagePage from '@/pages/damages/ReportDamagePage';
import CustomersPage from '@/pages/customers/CustomersPage';
import CustomerLedgerPage from '@/pages/customers/CustomerLedgerPage';
import CustomerLedgerListPage from '@/pages/customers/CustomerLedgerListPage';
import CreateCustomerPage from '@/pages/customers/CreateCustomerPage';
import EditCustomerPage from '@/pages/customers/EditCustomerPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import PurchaseReportPage from '@/pages/reports/PurchaseReportPage';
import SaleReportPage from '@/pages/reports/SaleReportPage';
import DamageReportPage from '@/pages/reports/DamageReportPage';
import ReturnReportPage from '@/pages/reports/ReturnReportPage';
import StockReportPage from '@/pages/reports/StockReportPage';
import HistoryPage from '@/pages/reports/HistoryPage';
import TransactionsPage from '@/pages/transactions/TransactionsPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import SettingsPage from '@/pages/settings/SettingsPage';
import UsersPage from '@/pages/users/UsersPage';
import LoginPage from '@/pages/auth/LoginPage';
import ProtectedRoute from '@/routes/ProtectedRoute';
import Loader from '@/components/common/Loader';
import { useRefreshTokenMutation } from '@/services/authApi';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { logout, setInitializing } from '@/features/auth/authSlice';

function App() {
  const dispatch = useAppDispatch();
  const { accessToken, refreshToken, initializing } = useAppSelector((state) => state.auth);
  const [refreshTokenMutation] = useRefreshTokenMutation();

  useEffect(() => {
    const hydrate = async () => {
      if (!initializing) return;
      if (!accessToken && refreshToken) {
        try {
          await refreshTokenMutation({ refreshToken }).unwrap();
        } catch (error) {
          console.error(error);
          dispatch(logout());
        } finally {
          dispatch(setInitializing(false));
        }
      } else {
        dispatch(setInitializing(false));
      }
    };

    hydrate();
  }, [accessToken, refreshToken, initializing, refreshTokenMutation, dispatch]);

  if (initializing) {
    return <Loader fullScreen message="Booting workspace..." />;
  }

  return (
    <Routes>
      <Route path="/login" element={accessToken ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<ShellLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/edit/:id" element={<ProductFormPage />} />
          <Route path="products/purchase" element={<PurchaseProductPage />} />
          <Route path="products/pending" element={<PendingProductsPage />} />
          <Route path="products/pending/new" element={<AddPendingProductsPage />} />
          <Route path="purchases" element={<PurchaseListPage />} />
          <Route path="purchases/:id/edit" element={<EditPurchasePage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="units" element={<UnitsPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/create" element={<CreateSalePage />} />
          <Route path="invoices/edit/:id" element={<EditOrderPage />} />
          <Route path="orders/today" element={<TodaysOrdersPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="returns/process" element={<ProcessReturnPage />} />
          <Route path="damages" element={<DamagesPage />} />
          <Route path="damages/report" element={<ReportDamagePage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/new" element={<CreateCustomerPage />} />
          <Route path="customers/ledger" element={<CustomerLedgerListPage />} />
          <Route path="customers/:id/edit" element={<EditCustomerPage />} />
          <Route path="customers/:customerName/ledger" element={<CustomerLedgerPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/purchase" element={<PurchaseReportPage />} />
          <Route path="reports/sale" element={<SaleReportPage />} />
          <Route path="reports/damage" element={<DamageReportPage />} />
          <Route path="reports/return" element={<ReturnReportPage />} />
          <Route path="reports/stock" element={<StockReportPage />} />
          <Route path="reports/history" element={<HistoryPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        {/* Print pages - no shell layout */}
        <Route path="invoices/:id/print" element={<PrintInvoicePage />} />
        <Route path="returns/:id/print" element={<PrintReturnPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
