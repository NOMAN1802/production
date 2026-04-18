/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { PrinterIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import { useGetReturnReportQuery } from '@/services/reportsApi';
import { type Return, type ReturnItem } from '@/services/returnsApi';
import DateRangeSelector from './DateRangeSelector';

type DateRangeType = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

interface TransformedReturnItem {
    _id: string;
    returnNumber?: string;
    orderNumber?: string;
    createdAt?: string;
    product?: string | { name?: string; _id?: string; supplier?: { name?: string } };
    supplier?: { name?: string } | string | null;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    reason?: string;
}

const ReturnReportPage = () => {
    const [dateRange, setDateRange] = useState<DateRangeType>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
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

    const { data, isLoading, isError, refetch } = useGetReturnReportQuery(getDateRangeParams);

    // Transform returns from items array to flat structure and filter based on search query
    const filteredReturns = useMemo(() => {
        if (!data?.returns) return [];

        // Transform returns - expand items array into individual rows
        const transformedReturns: TransformedReturnItem[] = [];
        (data.returns as Return[]).forEach((returnEntry) => {
            // If return has items array, expand it
            if (returnEntry.items && Array.isArray(returnEntry.items) && returnEntry.items.length > 0) {
                returnEntry.items.forEach((item: ReturnItem & { product?: any; supplierName?: string }) => {
                    const productId = typeof item.product === 'string' ? item.product : item.product?._id;

                    // Extract supplier information from various possible locations
                    let supplier: { name?: string } | null = null;
                    if (item.supplierName) {
                        supplier = { name: item.supplierName };
                    } else if (typeof item.product === 'object' && item.product?.supplier) {
                        supplier = item.product.supplier;
                    }

                    transformedReturns.push({
                        _id: `${returnEntry._id}-${productId || Math.random()}`,
                        returnNumber: returnEntry.returnNumber,
                        orderNumber: returnEntry.orderNumber,
                        createdAt: returnEntry.createdAt,
                        product: typeof item.product === 'object' ? item.product : { name: item.productName || 'N/A' },
                        productName: item.productName || 'N/A',
                        quantity: item.quantity || 0,
                        unitPrice: item.unitPrice || 0,
                        totalPrice: item.totalPrice || 0,
                        supplier: supplier,
                    } as TransformedReturnItem);
                });
            } else {
                // Handle legacy structure with direct product field
                transformedReturns.push(returnEntry as TransformedReturnItem);
            }
        });

        if (!searchQuery.trim()) {
            return transformedReturns;
        }

        const query = searchQuery.toLowerCase().trim();
        return transformedReturns.filter((returnItem) => {
            const productName = (returnItem.productName || (typeof returnItem.product === 'object' ? returnItem.product?.name : '') || '').toLowerCase();
            const orderNumber = (returnItem.orderNumber || '').toLowerCase();
            const reason = (returnItem.reason || '').toLowerCase();
            const supplierName = ((typeof returnItem.supplier === 'object' ? returnItem.supplier?.name : '') || (typeof returnItem.product === 'object' ? returnItem.product?.supplier?.name : '') || '').toLowerCase();

            return (
                productName.includes(query) ||
                orderNumber.includes(query) ||
                reason.includes(query) ||
                supplierName.includes(query)
            );
        });
    }, [data, searchQuery]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Return_Report_${dayjs().format('YYYY-MM-DD')}`,
    });

    const handleDownloadExcel = () => {
        const headers = ['Return Date', 'Product', 'Supplier', 'Quantity', 'Unit Price (৳)', 'Total (৳)'];
        const rows = filteredReturns.map((item: any) => [
            dayjs(item.createdAt).format('DD MMM YYYY'),
            item.productName || (typeof item.product === 'object' ? item.product?.name : '') || 'N/A',
            (typeof item.supplier === 'object' ? item.supplier?.name : '') || (typeof item.product === 'object' ? item.product?.supplier?.name : '') || 'N/A',
            item.quantity ?? 0,
            item.unitPrice ?? 0,
            item.totalPrice ?? 0,
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Return Report');
        XLSX.writeFile(wb, `Return_Report_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`);
    };

    if (isLoading) return <Loader fullScreen message="Loading return report..." />;
    if (isError) return <ErrorState description="Unable to load return report" onRetry={refetch} />;

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">Reports</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Return Report</h1>
            </div>

            <DateRangeSelector
                dateRange={dateRange}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onDateRangeChange={(range) => {
                    setDateRange(range);
                    setCustomStartDate('');
                    setCustomEndDate('');
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
                        label: 'Total Returns',
                        value: data?.summary.totalReturns || 0,
                        delta: '+0%',
                        color: 'orange',
                        icon: '↩️',
                        subtitle: 'Return transactions'
                    },
                    {
                        label: 'Total Quantity',
                        value: data?.summary.totalQuantity || 0,
                        delta: '+0%',
                        color: 'orange',
                        icon: '📦',
                        subtitle: 'Returned items'
                    },
                    {
                        label: 'Total Return Value',
                        value: `৳${(data?.summary.totalValue || 0).toLocaleString()}`,
                        delta: '+0%',
                        color: 'orange',
                        icon: '💰',
                        subtitle: 'Refund amount'
                    },
                ].map((card) => (
                    <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 to-slate-50/95 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{card.icon}</span>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
                                </div>
                                <p className={`text-2xl font-bold text-orange-600 group-hover:scale-105 transition-transform duration-300`}>
                                    {card.value}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">{card.subtitle}</p>
                            </div>
                            <div className={`rounded-full p-2 bg-orange-100 opacity-60 group-hover:opacity-100 transition-opacity duration-300`}>
                                <div className={`h-2 w-2 rounded-full bg-orange-500`}></div>
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
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-orange-500`}></div>
                    </div>
                ))}
            </section>

            {/* Returns Table */}
            <div ref={printRef} className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-card">
                <div className="mb-3">
                    <h3 className="text-base font-bold text-slate-900 mb-2">Return Details</h3>
                    <div className="flex items-center justify-between">
                        <div className="relative print:hidden">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by product, order, reason, or supplier..."
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
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Return Date</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Product</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Supplier</th>
                                <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Quantity</th>
                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Unit Price</th>
                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {filteredReturns.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-2 py-4 text-center text-xs text-slate-500">
                                        {searchQuery ? 'No returns found matching your search' : 'No returns found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredReturns.map((returnItem) => (
                                    <tr key={returnItem._id} className="hover:bg-slate-50">
                                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-600">
                                            {dayjs(returnItem.createdAt).format('DD MMM YYYY')}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs font-medium text-slate-900">
                                            {returnItem.productName || (typeof returnItem.product === 'object' ? returnItem.product?.name : '') || 'N/A'}
                                        </td>
                                        <td className="px-2 py-1.5 text-xs text-slate-600">
                                            {(typeof returnItem.supplier === 'object' ? returnItem.supplier?.name : '') || (typeof returnItem.product === 'object' ? returnItem.product?.supplier?.name : '') || 'N/A'}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-center text-xs text-orange-600 font-semibold">
                                            {returnItem.quantity}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-right text-xs text-slate-600">
                                            ৳{returnItem.unitPrice?.toLocaleString() || '0'}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-right text-xs font-semibold text-orange-600">
                                            ৳{returnItem.totalPrice?.toLocaleString() || '0'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReturnReportPage;

