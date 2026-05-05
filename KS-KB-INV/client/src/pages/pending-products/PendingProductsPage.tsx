import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MagnifyingGlassIcon,
    PlusIcon,
    PrinterIcon,
    ArrowDownTrayIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import DateRangeSelector from '@/pages/reports/DateRangeSelector';
import FinancialOverviewCards from '@/pages/reports/FinancialOverviewCards';
import {
    useGetPendingProductsQuery,
    useGetPendingProductStatsQuery,
    useUpdatePendingProductMutation,
    useDeletePendingProductMutation,
    type PendingProduct,
    type PendingProductStatus,
} from '@/services/pendingProductsApi';

type DateRangeType = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const STATUS_TABS: { label: string; value: string }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Partial Received', value: 'partial_received' },
    { label: 'Received', value: 'received' },
];

const statusBadge = (status: PendingProductStatus) => {
    switch (status) {
        case 'pending':
            return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>;
        case 'partial_received':
            return <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Partial Received</span>;
        case 'received':
            return <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Received</span>;
    }
};

type PartialModal = { item: PendingProduct; receivedQty: string; amount: string } | null;

const PendingProductsPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateRange, setDateRange] = useState<DateRangeType>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;
    const [partialModal, setPartialModal] = useState<PartialModal>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const getDateRangeParams = useMemo(() => {
        if (dateRange === 'all') return undefined;
        const now = dayjs();
        let startDate: string, endDate: string;
        if (dateRange === 'custom' && customStartDate && customEndDate) {
            startDate = dayjs(customStartDate).startOf('day').toISOString();
            endDate = dayjs(customEndDate).endOf('day').toISOString();
        } else {
            switch (dateRange) {
                case 'daily': startDate = now.startOf('day').toISOString(); endDate = now.endOf('day').toISOString(); break;
                case 'weekly': startDate = now.startOf('week').toISOString(); endDate = now.endOf('week').toISOString(); break;
                case 'monthly': startDate = now.startOf('month').toISOString(); endDate = now.endOf('month').toISOString(); break;
                case 'yearly': startDate = now.startOf('year').toISOString(); endDate = now.endOf('year').toISOString(); break;
                default: startDate = now.startOf('day').toISOString(); endDate = now.endOf('day').toISOString();
            }
        }
        return { startDate, endDate };
    }, [dateRange, customStartDate, customEndDate]);

    const { data, isLoading, isError, refetch } = useGetPendingProductsQuery({
        page,
        limit,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        startDate: getDateRangeParams?.startDate,
        endDate: getDateRangeParams?.endDate,
    });

    const { data: stats } = useGetPendingProductStatsQuery(getDateRangeParams ?? undefined);

    const [updatePendingProduct, { isLoading: isUpdating }] = useUpdatePendingProductMutation();
    const [deletePendingProduct] = useDeletePendingProductMutation();

    const items = useMemo(() => data?.result ?? [], [data]);
    const total = data?.meta?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 10;
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (page <= 6) {
            for (let i = 1; i <= maxVisible; i++) pages.push(i);
            pages.push('...');
            pages.push(totalPages);
        } else if (page >= totalPages - 5) {
            pages.push(1);
            pages.push('...');
            for (let i = totalPages - (maxVisible - 1); i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            pages.push('...');
            for (let i = page - 2; i <= page + 2; i++) pages.push(i);
            pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Pending-Products-${dayjs().format('YYYY-MM-DD')}`,
    });

    const handleDownloadExcel = () => {
        const rows = items.map((item) => ({
            'Product Name': item.productName,
            'Code': item.code ?? '',
            'Quantity': item.quantity,
            'Amount (৳)': item.amount,
            'Supplier': item.supplierName ?? '',
            'Status': item.status,
            'Received Qty': item.receivedQuantity ?? '',
            'Created At': dayjs(item.createdAt).format('DD MMM YYYY'),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pending Products');
        XLSX.writeFile(wb, `pending-products-${dayjs().format('YYYY-MM-DD')}.xlsx`);
    };

    const handleMarkReceived = async (item: PendingProduct) => {
        try {
            await updatePendingProduct({
                id: item._id,
                data: { status: 'received', receivedQuantity: item.quantity },
            }).unwrap();
        } catch {
            // silently handled
        }
    };

    const handlePartialSubmit = async () => {
        if (!partialModal) return;
        const qty = Number(partialModal.receivedQty);
        const amount = Number(partialModal.amount);
        const remaining = partialModal.item.quantity - (partialModal.item.receivedQuantity || 0);
        if (!qty || qty <= 0 || qty > remaining) return;
        try {
            await updatePendingProduct({
                id: partialModal.item._id,
                data: { status: 'partial_received', receivedQuantity: qty, partialAmount: amount || 0 },
            }).unwrap();
            setPartialModal(null);
        } catch {
            // silently handled
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this pending product?')) return;
        try {
            await deletePendingProduct(id).unwrap();
        } catch {
            // silently handled
        }
    };

    if (isLoading) return <Loader fullScreen message="Loading pending products..." />;
    if (isError) return <ErrorState description="Unable to fetch pending products." onRetry={refetch} />;

    return (
        <>
            {/* Hidden printable area */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm' }}>
                <div ref={printRef} style={{ padding: '20mm', fontFamily: 'Arial, sans-serif' }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Pending Products Report</h1>
                    <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                        Generated: {dayjs().format('DD MMM YYYY hh:mm A')}
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                            <tr style={{ background: '#1e293b', color: '#fff' }}>
                                {['Product Name', 'Code', 'Qty', 'Amount', 'Supplier', 'Status', 'Date'].map((h) => (
                                    <th key={h} style={{ padding: '8px 6px', textAlign: 'left', border: '1px solid #334155' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => (
                                <tr key={item._id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '7px 6px', border: '1px solid #e2e8f0' }}>{item.productName}</td>
                                    <td style={{ padding: '7px 6px', border: '1px solid #e2e8f0' }}>{item.code ?? '-'}</td>
                                    <td style={{ padding: '7px 6px', border: '1px solid #e2e8f0' }}>{item.quantity}</td>
                                    <td style={{ padding: '7px 6px', border: '1px solid #e2e8f0' }}>৳{item.amount}</td>
                                    <td style={{ padding: '7px 6px', border: '1px solid #e2e8f0' }}>{item.supplierName ?? '-'}</td>
                                    <td style={{ padding: '7px 6px', border: '1px solid #e2e8f0' }}>{item.status}</td>
                                    <td style={{ padding: '7px 6px', border: '1px solid #e2e8f0' }}>{dayjs(item.createdAt).format('DD MMM YYYY')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">Products</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-900">Pending Products</h1>
                    </div>
                    <button
                        onClick={() => navigate('/products/pending/new')}
                        className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-brand to-brand-dark px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/40 hover:shadow-xl hover:shadow-brand/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add Pending Products
                    </button>
                </div>

                {/* Date Range Selector */}
                <DateRangeSelector
                    dateRange={dateRange}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    onDateRangeChange={(range) => { setDateRange(range); setPage(1); }}
                    onCustomStartDateChange={setCustomStartDate}
                    onCustomEndDateChange={setCustomEndDate}
                    onApplyCustomRange={() => { if (customStartDate && customEndDate) { setDateRange('custom'); setPage(1); } }}
                />

                {/* Stats Cards */}
                <FinancialOverviewCards cards={[
                    {
                        label: 'Total Items',
                        value: stats?.total.count ?? 0,
                        delta: `৳${(stats?.total.amount ?? 0).toLocaleString()}`,
                        deltaLabel: 'total ordered amount',
                        color: 'blue',
                        icon: '📦',
                    },
                    {
                        label: 'Pending',
                        value: stats?.pending.count ?? 0,
                        delta: `৳${(stats?.pending.amount ?? 0).toLocaleString()}`,
                        deltaLabel: 'pending amount',
                        color: 'orange',
                        icon: '⏳',
                    },
                    {
                        label: 'Partial Received',
                        value: stats?.partial_received.count ?? 0,
                        delta: `৳${(stats?.partial_received.receivedAmount ?? 0).toLocaleString()}`,
                        deltaLabel: `of ৳${(stats?.partial_received.amount ?? 0).toLocaleString()} ordered`,
                        color: 'purple',
                        icon: '🔄',
                    },
                    {
                        label: 'Received',
                        value: stats?.received.count ?? 0,
                        delta: `৳${(stats?.received.amount ?? 0).toLocaleString()}`,
                        deltaLabel: 'received amount',
                        color: 'green',
                        icon: '✅',
                    },
                ]} />

                {/* Table Card */}
                <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card">
                    {/* Toolbar */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                            <input
                                className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                                placeholder="Search by product name or code..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                            >
                                {STATUS_TABS.map((tab) => (
                                    <option key={tab.value} value={tab.value}>{tab.label}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleDownloadExcel}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Excel
                            </button>
                            <button
                                onClick={handlePrint}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-all"
                            >
                                <PrinterIcon className="h-4 w-4" />
                                Print
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                            <thead className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                <tr>
                                    <th className="py-2.5 pr-3">S/N</th>
                                    <th className="py-2.5 pr-3">Product Name</th>
                                    <th className="py-2.5 pr-3">Code</th>
                                    <th className="py-2.5 pr-3">Quantity</th>
                                    <th className="py-2.5 pr-3">Amount</th>
                                    <th className="py-2.5 pr-3">Supplier</th>
                                    <th className="py-2.5 pr-3">Status</th>
                                    <th className="py-2.5 pr-3">Date</th>
                                    <th className="py-2.5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-10 text-center text-xs text-slate-500">
                                            No pending products found.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, idx) => (
                                        <tr key={item._id} className="hover:bg-slate-50/70 transition">
                                            <td className="py-2.5 pr-3 text-slate-400">{(page - 1) * limit + idx + 1}</td>
                                            <td className="py-2.5 pr-3 font-semibold text-slate-900">{item.productName}</td>
                                            <td className="py-2.5 pr-3 text-slate-600">{item.code || '-'}</td>
                                            <td className="py-2.5 pr-3">
                                                {item.quantity}
                                                {item.receivedQuantity != null && item.status !== 'pending' && (
                                                    <span className="ml-1 text-[10px] text-blue-600">({item.receivedQuantity} rcvd)</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 pr-3 font-semibold text-slate-900">
                                                ৳{item.amount.toLocaleString()}
                                                {item.receivedAmount != null && item.receivedAmount > 0 && (
                                                    <span className="ml-1 text-[10px] text-blue-600">(৳{item.receivedAmount.toLocaleString()} rcvd)</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 pr-3 text-slate-600">{item.supplierName || '-'}</td>
                                            <td className="py-2.5 pr-3">{statusBadge(item.status)}</td>
                                            <td className="py-2.5 pr-3 text-slate-500">{dayjs(item.createdAt).format('DD MMM YYYY')}</td>
                                            <td className="py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    {item.status !== 'received' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleMarkReceived(item)}
                                                                disabled={isUpdating}
                                                                className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100 transition disabled:opacity-50"
                                                            >
                                                                Received
                                                            </button>
                                                            {(item.status === 'pending' || item.status === 'partial_received') && (
                                                                <button
                                                                    onClick={() => setPartialModal({ item, receivedQty: '', amount: '' })}
                                                                    disabled={isUpdating}
                                                                    className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                                                                >
                                                                    Partial
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(item._id)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition"
                                                    >
                                                        <TrashIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {total > 0 && (
                        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
                            <p className="text-sm text-slate-600">
                                Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
                                <span className="font-semibold text-slate-900">{Math.min(page * limit, total)}</span> of{' '}
                                <span className="font-semibold text-slate-900">{total}</span> entries
                            </p>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 1}
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Previous
                                </button>
                                {getPageNumbers().map((pageNum, idx) => (
                                    pageNum === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="flex h-9 w-9 items-center justify-center text-sm text-slate-400">...</span>
                                    ) : (
                                        <button
                                            key={pageNum}
                                            onClick={() => handlePageChange(pageNum as number)}
                                            className={`flex h-9 min-w-[36px] items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all ${page === pageNum ? 'bg-brand text-white shadow-md shadow-brand/30' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                ))}
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page === totalPages}
                                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Partial Received Modal */}
            {partialModal && (() => {
                const alreadyReceived = partialModal.item.receivedQuantity || 0;
                const alreadyReceivedAmount = partialModal.item.receivedAmount || 0;
                const remaining = partialModal.item.quantity - alreadyReceived;
                const remainingAmount = partialModal.item.amount - alreadyReceivedAmount;
                const qty = Number(partialModal.receivedQty);
                const isValid = qty > 0 && qty <= remaining;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setPartialModal(null)} />
                        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                            <h3 className="text-base font-bold text-slate-900 mb-1">Partial Received</h3>
                            <p className="text-sm font-semibold text-slate-700 mb-3">{partialModal.item.productName}</p>
                            <div className="grid grid-cols-2 gap-2 mb-4 rounded-xl bg-slate-50 p-3 text-xs">
                                <div className="space-y-1.5">
                                    <p className="text-slate-500">Ordered: <strong className="text-slate-800">{partialModal.item.quantity}</strong></p>
                                    {alreadyReceived > 0 && <p className="text-slate-500">Already received: <strong className="text-blue-700">{alreadyReceived}</strong></p>}
                                    <p className="text-slate-500">Remaining: <strong className="text-amber-700">{remaining}</strong></p>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-slate-500">Amount: <strong className="text-slate-800">৳{partialModal.item.amount.toLocaleString()}</strong></p>
                                    {alreadyReceivedAmount > 0 && <p className="text-slate-500">Already paid: <strong className="text-blue-700">৳{alreadyReceivedAmount.toLocaleString()}</strong></p>}
                                    <p className="text-slate-500">Remaining: <strong className="text-amber-700">৳{remainingAmount.toLocaleString()}</strong></p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Received Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={remaining}
                                        value={partialModal.receivedQty}
                                        onChange={(e) => setPartialModal({ ...partialModal, receivedQty: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                        placeholder={`1 – ${remaining}`}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Amount (৳)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={partialModal.amount}
                                        onChange={(e) => setPartialModal({ ...partialModal, amount: e.target.value })}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            {qty === remaining && (
                                <p className="mt-2 text-xs text-green-700 font-medium">This will mark the product as fully received.</p>
                            )}
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => setPartialModal(null)}
                                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePartialSubmit}
                                    disabled={isUpdating || !isValid}
                                    className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl transition disabled:opacity-50"
                                >
                                    {isUpdating ? 'Saving...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
};

export default PendingProductsPage;
