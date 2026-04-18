import { useState, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { PrinterIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import { useGetExpenseReportQuery } from '@/services/reportsApi';
import { type Expense } from '@/services/expensesApi';
import DateRangeSelector from './DateRangeSelector';

type DateRangeType = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const PurchaseReportPage = () => {
    const [dateRange, setDateRange] = useState<DateRangeType>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    const getDateRangeParams = useMemo(() => {
        // For 'all', return undefined to fetch all records without date filtering
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

    const { data, isLoading, isError, refetch } = useGetExpenseReportQuery(getDateRangeParams);

    const purchaseExpenses = useMemo(() => {
        const filtered = data?.expenses?.filter((exp: Expense) => exp.category === 'product_purchase') || [];

        if (!searchQuery.trim()) {
            return filtered;
        }

        const query = searchQuery.toLowerCase().trim();
        return filtered.filter((exp: Expense) => {
            const title = exp.title?.toLowerCase() || '';
            const supplierName = (typeof exp.supplier === 'object' ? exp.supplier?.name?.toLowerCase() : '') || '';
            const categoryName = (typeof exp.referenceId === 'object' ? exp.referenceId?.categoryName?.toLowerCase() : '') || '';
            const description = exp.description?.toLowerCase() || '';

            return (
                title.includes(query) ||
                supplierName.includes(query) ||
                categoryName.includes(query) ||
                description.includes(query)
            );
        });
    }, [data?.expenses, searchQuery]);

    const totalPurchase = useMemo(() => {
        return purchaseExpenses.reduce((sum: number, exp: Expense) => sum + (exp.amount || 0), 0);
    }, [purchaseExpenses]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Purchase_Report_${dayjs().format('YYYY-MM-DD')}`,
    });

    const handleDownloadExcel = () => {
        const headers = ['Purchase Date', 'Title', 'Quantity', 'Amount (৳)', 'Supplier'];
        const rows = purchaseExpenses.map((exp: Expense) => {
            const quantityMatch = exp.description?.match(/(\d+)\s+(\w+)/i);
            const quantity = quantityMatch ? Number(quantityMatch[1]) : 0;
            const supplierName = typeof exp.supplier === 'object' ? exp.supplier?.name : '';
            return [
                dayjs(exp.date).format('DD MMM YYYY'),
                exp.title ?? '',
                quantity,
                exp.amount ?? 0,
                supplierName ?? 'N/A',
            ];
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Purchase Report');
        XLSX.writeFile(wb, `Purchase_Report_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`);
    };

    if (isLoading) return <Loader fullScreen message="Loading purchase report..." />;
    if (isError) return <ErrorState description="Unable to load purchase report" onRetry={refetch} />;

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">Reports</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Purchase Report</h1>
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
                        label: 'Total Purchases',
                        value: purchaseExpenses.length,
                        delta: '+0%',
                        color: 'blue',
                        icon: '🛒',
                        subtitle: 'Purchase transactions'
                    },
                    {
                        label: 'Total Amount',
                        value: `৳${totalPurchase.toLocaleString()}`,
                        delta: '+0%',
                        color: 'green',
                        icon: '💰',
                        subtitle: 'Total purchase value'
                    },
                ].map((card) => (
                    <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 to-slate-50/95 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{card.icon}</span>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
                                </div>
                                <p className={`text-2xl font-bold ${card.color === 'green' ? 'text-green-600' :
                                    'text-blue-600'
                                    } group-hover:scale-105 transition-transform duration-300`}>
                                    {card.value}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">{card.subtitle}</p>
                            </div>
                            <div className={`rounded-full p-2 ${card.color === 'green' ? 'bg-green-100' :
                                'bg-blue-100'
                                } opacity-60 group-hover:opacity-100 transition-opacity duration-300`}>
                                <div className={`h-2 w-2 rounded-full ${card.color === 'green' ? 'bg-green-500' :
                                    'bg-blue-500'
                                    }`}></div>
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
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${card.color === 'green' ? 'bg-green-500' :
                            'bg-blue-500'
                            }`}></div>
                    </div>
                ))}
            </section>

            {/* Purchase Table */}
            <div ref={printRef} className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-card">
                <div className="mb-3">
                    <h3 className="text-base font-bold text-slate-900 mb-2">Purchase Details</h3>
                    <div className="flex items-center justify-between">
                        <div className="relative print:hidden">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by title, category, or supplier..."
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
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Purchase Date</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Title</th>
                                <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Quantity</th>
                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Amount</th>
                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Supplier</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {purchaseExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-2 py-4 text-center text-xs text-slate-500">
                                        {searchQuery ? 'No purchases found matching your search' : 'No purchases found'}
                                    </td>
                                </tr>
                            ) : (
                                purchaseExpenses.map((expense: Expense) => {
                                    // Extract quantity from description if available
                                    // Format: "Initial purchase of X unit(s)" or "Added X unit(s) to existing stock"
                                    const quantityMatch = expense.description?.match(/(\d+)\s+(\w+)/i);
                                    const quantity = quantityMatch ? Number(quantityMatch[1]) : 0;
                                    const unit = quantityMatch ? quantityMatch[2] : '';

                                    return (
                                        <tr key={expense._id} className="hover:bg-slate-50">
                                            <td className="px-2 py-1.5 whitespace-nowrap text-xs text-slate-600">
                                                {dayjs(expense.date).format('DD MMM YYYY')}
                                            </td>
                                            <td className="px-2 py-1.5 text-xs font-medium text-slate-900">{expense.title}</td>
                                            <td className="px-2 py-1.5 whitespace-nowrap text-center text-xs text-slate-600">
                                                {quantity > 0 ? `${quantity} ${unit}` : 'N/A'}
                                            </td>
                                            <td className="px-2 py-1.5 whitespace-nowrap text-right text-xs font-semibold text-green-600">
                                                ৳{expense.amount.toLocaleString()}
                                            </td>
                                            <td className="px-2 py-1.5 text-xs text-slate-600">
                                                {(typeof expense.supplier === 'object' ? expense.supplier?.name : '') || 'N/A'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PurchaseReportPage;

