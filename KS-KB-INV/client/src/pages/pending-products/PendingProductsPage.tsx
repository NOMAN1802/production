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
import {
    useGetPendingProductsQuery,
    useUpdatePendingProductMutation,
    useDeletePendingProductMutation,
    type PendingProduct,
    type PendingProductStatus,
} from '@/services/pendingProductsApi';

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

type PartialModal = { item: PendingProduct; receivedQty: string } | null;

const PendingProductsPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [partialModal, setPartialModal] = useState<PartialModal>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const limit = 20;

    const { data, isLoading, isError, refetch } = useGetPendingProductsQuery({
        page,
        limit,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
    });

    const [updatePendingProduct, { isLoading: isUpdating }] = useUpdatePendingProductMutation();
    const [deletePendingProduct] = useDeletePendingProductMutation();

    const items = useMemo(() => data?.result ?? [], [data]);
    const total = data?.meta?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

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
        if (!qty || qty <= 0 || qty >= partialModal.item.quantity) return;
        try {
            await updatePendingProduct({
                id: partialModal.item._id,
                data: { status: 'partial_received', receivedQuantity: qty },
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

                {/* Status Tabs */}
                <div className="flex flex-wrap gap-2">
                    {STATUS_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${statusFilter === tab.value
                                ? 'bg-brand text-white shadow-md shadow-brand/30'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

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
                        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                            <thead className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                                <tr>
                                    <th className="py-3 pr-4">S/N</th>
                                    <th className="py-3 pr-4">Product Name</th>
                                    <th className="py-3 pr-4">Code</th>
                                    <th className="py-3 pr-4">Quantity</th>
                                    <th className="py-3 pr-4">Amount</th>
                                    <th className="py-3 pr-4">Supplier</th>
                                    <th className="py-3 pr-4">Status</th>
                                    <th className="py-3 pr-4">Date</th>
                                    <th className="py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                                            No pending products found.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, idx) => (
                                        <tr key={item._id} className="hover:bg-slate-50/70 transition">
                                            <td className="py-3 pr-4 text-slate-400 text-xs">{(page - 1) * limit + idx + 1}</td>
                                            <td className="py-3 pr-4 font-semibold text-slate-900">{item.productName}</td>
                                            <td className="py-3 pr-4 text-slate-600">{item.code || '-'}</td>
                                            <td className="py-3 pr-4">
                                                {item.quantity}
                                                {item.receivedQuantity != null && item.status === 'partial_received' && (
                                                    <span className="ml-1 text-xs text-blue-600">({item.receivedQuantity} rcvd)</span>
                                                )}
                                            </td>
                                            <td className="py-3 pr-4 font-semibold text-slate-900">৳{item.amount.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-slate-600">{item.supplierName || '-'}</td>
                                            <td className="py-3 pr-4">{statusBadge(item.status)}</td>
                                            <td className="py-3 pr-4 text-xs text-slate-500">{dayjs(item.createdAt).format('DD MMM YYYY')}</td>
                                            <td className="py-3">
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
                                                            {item.status === 'pending' && (
                                                                <button
                                                                    onClick={() => setPartialModal({ item, receivedQty: '' })}
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
                    {total > limit && (
                        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-5">
                            <p className="text-sm text-slate-500">
                                Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span>–
                                <span className="font-semibold text-slate-900">{Math.min(page * limit, total)}</span> of{' '}
                                <span className="font-semibold text-slate-900">{total}</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <span className="text-sm font-semibold text-slate-700">Page {page} of {totalPages}</span>
                                <button
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {/* Partial Received Modal */}
            {partialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setPartialModal(null)} />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="text-base font-bold text-slate-900 mb-1">Partial Received</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            <span className="font-semibold text-slate-700">{partialModal.item.productName}</span> — ordered qty: {partialModal.item.quantity}
                        </p>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Received Quantity</label>
                        <input
                            type="number"
                            min="1"
                            max={partialModal.item.quantity - 1}
                            value={partialModal.receivedQty}
                            onChange={(e) => setPartialModal({ ...partialModal, receivedQty: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                            placeholder={`1 – ${partialModal.item.quantity - 1}`}
                            autoFocus
                        />
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => setPartialModal(null)}
                                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePartialSubmit}
                                disabled={isUpdating || !partialModal.receivedQty || Number(partialModal.receivedQty) <= 0 || Number(partialModal.receivedQty) >= partialModal.item.quantity}
                                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl transition disabled:opacity-50"
                            >
                                {isUpdating ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PendingProductsPage;
