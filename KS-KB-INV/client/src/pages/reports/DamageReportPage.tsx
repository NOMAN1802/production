/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { PrinterIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import { useGetDamageReportQuery } from '@/services/reportsApi';
import { type Damage, type DamageItem } from '@/services/damagesApi';
import DateRangeSelector from './DateRangeSelector';

type DateRangeType = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

interface TransformedDamage extends Damage {
    product?: string | { name?: string; _id?: string; supplier?: { name?: string } };
    supplier?: { name?: string } | string | null;
    productName?: string;
    quantity?: number;
    reason?: string;
    damageType?: string;
    unitCost?: number;
    totalPrice?: number;
}

const DamageReportPage = () => {
    const [dateRange, setDateRange] = useState<DateRangeType>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;
    const printRef = useRef<HTMLDivElement>(null);

    const getDateRangeParams = useMemo(() => {
        // For 'all', return undefined to indicate no date filtering
        if (dateRange === 'all') {
            return undefined;
        }

        const now = dayjs();
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (dateRange === 'custom') {
            if (customStartDate && customEndDate) {
                // For custom dates, ensure we capture the full day in local timezone
                const start = dayjs(customStartDate).startOf('day');
                const end = dayjs(customEndDate).endOf('day');
                startDate = start.toISOString();
                endDate = end.toISOString();
            } else {
                // If custom dates are not fully set, return undefined
                return undefined;
            }
        } else {
            switch (dateRange) {
                case 'daily':
                    startDate = now.startOf('day').toISOString();
                    endDate = now.endOf('day').toISOString();
                    break;
                case 'weekly':
                    startDate = now.startOf('week').toISOString();
                    endDate = now.endOf('week').toISOString();
                    break;
                case 'monthly':
                    startDate = now.startOf('month').toISOString();
                    endDate = now.endOf('month').toISOString();
                    break;
                case 'yearly':
                    startDate = now.startOf('year').toISOString();
                    endDate = now.endOf('year').toISOString();
                    break;
                default:
                    startDate = now.startOf('day').toISOString();
                    endDate = now.endOf('day').toISOString();
            }
        }

        // Return params with dates
        if (startDate && endDate) {
            return { startDate, endDate };
        }
        return undefined;
    }, [dateRange, customStartDate, customEndDate]);

    const { data, isLoading, isError, refetch } = useGetDamageReportQuery(getDateRangeParams);

    // Transform damages from items array to flat structure and filter based on search query
    const filteredDamages = useMemo(() => {
        if (!data?.damages) return [];
        
        // Transform damages - handle both items array and direct product structure
        const transformedDamages: TransformedDamage[] = [];
        (data.damages as any[]).forEach((damage: any) => {
            // If damage has items array, expand it
            if (damage.items && Array.isArray(damage.items) && damage.items.length > 0) {
                damage.items.forEach((item: DamageItem) => {
                    const productId = typeof item.product === 'object' ? item.product._id : item.product;
                    transformedDamages.push({
                        ...damage,
                        _id: `${damage._id}-${productId || Math.random()}`,
                        product: typeof item.product === 'object' ? item.product : { name: item.productName || 'N/A' },
                        productName: item.productName || (typeof item.product === 'object' ? item.product.name : undefined) || 'N/A',
                        quantity: item.quantity || 0,
                        reason: item.reason || 'N/A',
                        damageType: item.damageType || 'other',
                        supplier: item.supplier || undefined,
                    } as TransformedDamage);
                });
            } else {
                // Handle legacy structure with direct product field
                transformedDamages.push(damage as TransformedDamage);
            }
        });
        
        if (!searchQuery.trim()) {
            return transformedDamages;
        }
        
        const query = searchQuery.toLowerCase().trim();
        return transformedDamages.filter((damage) => {
            const productName = (damage.productName || (typeof damage.product === 'object' ? damage.product?.name : '') || '').toLowerCase();
            const reason = (damage.reason || '').toLowerCase();
            const damageType = (damage.damageType || '').toLowerCase();
            const supplierName = ((typeof damage.supplier === 'object' ? damage.supplier?.name : '') || (typeof damage.product === 'object' ? damage.product?.supplier?.name : '') || '').toLowerCase();
            
            return (
                productName.includes(query) ||
                reason.includes(query) ||
                damageType.includes(query) ||
                supplierName.includes(query)
            );
        });
    }, [data, searchQuery]);

    const paginatedDamages = useMemo(() => filteredDamages.slice((page - 1) * limit, page * limit), [filteredDamages, page]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Damage_Report_${dayjs().format('YYYY-MM-DD')}`,
    });

    const handleDownloadExcel = () => {
        const headers = ['Damage Date', 'Product', 'Supplier', 'Quantity', 'Unit Cost (৳)', 'Type', 'Total (৳)'];
        const rows = filteredDamages.map((damage: any) => [
            dayjs(damage.createdAt).format('DD MMM YYYY'),
            damage.productName || (typeof damage.product === 'object' ? damage.product?.name : '') || 'N/A',
            (typeof damage.supplier === 'object' ? damage.supplier?.name : '') || (typeof damage.product === 'object' ? damage.product?.supplier?.name : '') || 'N/A',
            damage.quantity ?? 0,
            damage.unitCost ?? damage.unitPrice ?? 0,
            damage.damageType ?? '-',
            damage.totalLoss ?? damage.totalPrice ?? damage.subtotal ?? 0,
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Damage Report');
        XLSX.writeFile(wb, `Damage_Report_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`);
    };

    if (isLoading) return <Loader fullScreen message="Loading damage report..." />;
    if (isError) return <ErrorState description="Unable to load damage report" onRetry={refetch} />;

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">Reports</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Damage Report</h1>
            </div>

            <DateRangeSelector
                dateRange={dateRange}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onDateRangeChange={(range) => {
                    setDateRange(range);
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setPage(1);
                }}
                onCustomStartDateChange={setCustomStartDate}
                onCustomEndDateChange={setCustomEndDate}
                onApplyCustomRange={() => {
                    if (customStartDate && customEndDate) {
                        setDateRange('custom');
                    }
                }}
            />

            {/* Summary Cards */}
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {[
                    {
                        label: 'Total Damages',
                        value: data?.summary.totalDamages || 0,
                        delta: '+0%',
                        color: 'red',
                        icon: '⚠️',
                        subtitle: 'Damage incidents'
                    },
                    {
                        label: 'Total Quantity',
                        value: data?.summary.totalQuantity || 0,
                        delta: '+0%',
                        color: 'red',
                        icon: '📉',
                        subtitle: 'Damaged items'
                    },
                    {
                        label: 'Total Loss Value',
                        value: `৳${(data?.summary.totalValue || 0).toLocaleString()}`,
                        delta: '+0%',
                        color: 'red',
                        icon: '💸',
                        subtitle: 'Financial loss'
                    },
                ].map((card) => (
                    <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 to-slate-50/95 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{card.icon}</span>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
                                </div>
                                <p className={`text-2xl font-bold text-red-600 group-hover:scale-105 transition-transform duration-300`}>
                                    {card.value}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">{card.subtitle}</p>
                            </div>
                            <div className={`rounded-full p-2 bg-red-100 opacity-60 group-hover:opacity-100 transition-opacity duration-300`}>
                                <div className={`h-2 w-2 rounded-full bg-red-500`}></div>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center">
                            <span className={`text-xs font-semibold ${card.delta.startsWith('+') ? 'text-emerald-600' : 'text-red-500'
                                }`}>
                                {card.delta}
                            </span>
                            <span className="ml-1 text-xs text-slate-400">vs last period</span>
                        </div>
                        {/* Subtle gradient overlay */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-red-500`}></div>
                    </div>
                ))}
            </section>

            {/* Damages Table */}
            <div ref={printRef} className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-card">
                <div className="mb-3">
                    <h3 className="text-base font-bold text-slate-900 mb-2">Damage Details</h3>
                    <div className="flex items-center justify-between">
                        <div className="relative print:hidden">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                                placeholder="Search by product, reason, or supplier..."
                                className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 pl-9 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                            />
                            <svg
                                className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                        <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 print:hidden"
                        >
                            <TableCellsIcon className="h-4 w-4" />
                            Download Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePrint()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 print:hidden"
                        >
                            <PrinterIcon className="h-4 w-4" />
                            Print
                        </button>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">S/N</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Damage Date</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Product</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Supplier</th>
                                <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Quantity</th>
                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Unit Cost</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Type</th>
                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {filteredDamages.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-2 py-4 text-center text-xs text-slate-500">
                                        {searchQuery ? 'No damages found matching your search' : 'No damages found'}
                                    </td>
                                </tr>
                            ) : (
                                paginatedDamages.map((damage, idx) => (
                                    <tr key={damage._id} className="hover:bg-slate-50">
                                        <td className="px-2 py-1.5 text-slate-400 text-xs">{(page - 1) * limit + idx + 1}</td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-600">
                                            {dayjs(damage.createdAt).format('DD MMM YYYY')}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs font-medium text-slate-900">
                                            {damage.productName || (typeof damage.product === 'object' ? damage.product?.name : '') || 'N/A'}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs text-slate-600">
                                            {(typeof damage.supplier === 'object' ? damage.supplier?.name : '') || (typeof damage.product === 'object' ? damage.product?.supplier?.name : '') || 'N/A'}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-center text-xs text-red-600 font-semibold">
                                            {damage.quantity}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-right text-xs text-slate-600">
                                            ৳{damage.unitCost?.toLocaleString() || '0'}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs text-slate-600 capitalize">
                                            {damage.damageType || 'N/A'}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-right text-xs font-semibold text-red-600">
                                            ৳{damage.totalLoss?.toLocaleString() || '0'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredDamages.length > limit && (
                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 print:hidden">
                        <p className="text-xs text-slate-500">
                            Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span>–<span className="font-semibold text-slate-900">{Math.min(page * limit, filteredDamages.length)}</span> of{' '}
                            <span className="font-semibold text-slate-900">{filteredDamages.length}</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Prev</button>
                            <span className="text-xs font-semibold text-slate-700">Page {page} of {Math.ceil(filteredDamages.length / limit)}</span>
                            <button onClick={() => setPage(p => Math.min(Math.ceil(filteredDamages.length / limit), p + 1))} disabled={page >= Math.ceil(filteredDamages.length / limit)} className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DamageReportPage;

