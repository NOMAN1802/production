/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    PlusIcon,
    EyeIcon,
    PrinterIcon,
    TableCellsIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import {
    useGetDamagesQuery,
    type Damage
} from '@/services/damagesApi';
import { useGetDamageReportQuery } from '@/services/reportsApi';
import { useGetSuppliersQuery } from '@/services/suppliersApi';
import DamageInvoiceModal from '@/components/invoices/DamageInvoiceModal';
import DateRangeSelector from '@/pages/reports/DateRangeSelector';

type DateRangeType = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const DamagesPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [viewingDamageId, setViewingDamageId] = useState<string | null>(null);
    const [printingDamageId, setPrintingDamageId] = useState<string | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRangeType>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const filterRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const limit = 20;

    // Calculate date range based on selection
    const getDateRangeParams = useMemo(() => {
        // For 'all', return undefined to show all damages
        if (dateRange === 'all') {
            return undefined;
        }

        const now = dayjs();
        let startDate: string;
        let endDate: string;

        if (dateRange === 'custom' && customStartDate && customEndDate) {
            startDate = dayjs(customStartDate).startOf('day').toISOString();
            endDate = dayjs(customEndDate).endOf('day').toISOString();
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
                    return undefined;
            }
        }

        return { startDate, endDate };
    }, [dateRange, customStartDate, customEndDate]);

    // Determine if we should apply date filtering
    const hasDateFilter = dateRange !== 'all' && (dateRange === 'custom' ? (customStartDate && customEndDate) : true);
    const shouldFetchAll = selectedSupplier || hasDateFilter;

    const { data: damagesData, isLoading, isError, refetch } = useGetDamagesQuery({
        search,
        page: shouldFetchAll ? 1 : page,
        limit: shouldFetchAll ? 10000 : limit,
        ...(hasDateFilter && getDateRangeParams ? getDateRangeParams : {}),
    });

    // Fetch damage report for stats
    const { data: reportData } = useGetDamageReportQuery(
        hasDateFilter && getDateRangeParams ? getDateRangeParams : undefined
    );

    // Fetch suppliers for filter
    const { data: suppliersData } = useGetSuppliersQuery({ limit: 100 });

    const allDamages = useMemo(() => damagesData?.damages || [], [damagesData?.damages]);
    const totalDamages = damagesData?.total || 0;

    // Filter damages by supplier and date range
    const filteredDamages = useMemo(() => {
        let filtered = allDamages;

        // Filter by date range (if not already filtered by API and we have date params)
        if (hasDateFilter && getDateRangeParams) {
            const { startDate, endDate } = getDateRangeParams;
            filtered = filtered.filter((damage) => {
                if (!damage.createdAt) return false;
                const damageDate = dayjs(damage.createdAt);
                return damageDate.isAfter(dayjs(startDate).subtract(1, 'day')) &&
                    damageDate.isBefore(dayjs(endDate).add(1, 'day'));
            });
        }

        // Filter by supplier - check items array for supplier
        if (selectedSupplier) {
            filtered = filtered.filter((damage) => {
                const items = damage.items && Array.isArray(damage.items) ? damage.items : [];
                return items.some((item: any) => {
                    const supplierId = item.supplier?._id || item.supplier || null;
                    return supplierId && String(supplierId) === String(selectedSupplier);
                });
            });
        }

        return filtered;
    }, [allDamages, selectedSupplier, hasDateFilter, getDateRangeParams]);

    const totalPages = useMemo(() => {
        const hasFilters = selectedSupplier || hasDateFilter;
        if (hasFilters) {
            return Math.ceil(filteredDamages.length / limit);
        }
        return Math.ceil(totalDamages / limit);
    }, [selectedSupplier, hasDateFilter, filteredDamages.length, totalDamages, limit]);

    // Paginate damages for display
    const paginatedDamages = useMemo(() => {
        const hasFilters = selectedSupplier || hasDateFilter;
        if (!hasFilters) {
            return allDamages;
        }
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return filteredDamages.slice(startIndex, endIndex);
    }, [allDamages, filteredDamages, selectedSupplier, hasDateFilter, page, limit]);

    const handleViewClick = (damage: Damage) => {
        setViewingDamageId(damage._id);
    };

    const handleCloseViewModal = () => {
        setViewingDamageId(null);
    };

    const handlePrintClick = (damage: Damage) => {
        setPrintingDamageId(damage._id);
    };

    const handleClosePrintModal = () => {
        setPrintingDamageId(null);
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    const handleSupplierFilter = (supplierId: string | null) => {
        setSelectedSupplier(supplierId);
        setIsFilterOpen(false);
        setPage(1);
    };

    const handleClearFilter = () => {
        setSelectedSupplier(null);
        setIsFilterOpen(false);
        setPage(1);
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Damage-List-${dayjs().format('YYYY-MM-DD')}`,
    });

    const handleDownloadExcel = () => {
        const hasFilters = selectedSupplier || hasDateFilter;
        const damagesToExport = hasFilters ? filteredDamages : allDamages;
        const headers = ['Damage ID', 'Supplier', 'Amount (৳)', 'Damaged Date'];
        const rows = damagesToExport.map((damage: any) => {
            const supplierNames = new Set<string>();
            if (damage.items && Array.isArray(damage.items)) {
                damage.items.forEach((item: any) => {
                    const name = item.supplierName || (typeof item.supplier === 'object' ? item.supplier?.name : null);
                    if (name) supplierNames.add(name);
                });
            }
            const supplier = Array.from(supplierNames).slice(0, 2).join(', ') || 'N/A';
            return [
                damage.damageNumber || '',
                supplier,
                damage.totalLoss ?? damage.subtotal ?? 0,
                damage.createdAt ? dayjs(damage.createdAt).format('DD MMM YYYY') : 'N/A',
            ];
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Damages');
        XLSX.writeFile(wb, `Damages_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`);
    };

    // Close filter dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };

        if (isFilterOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isFilterOpen]);

    // Calculate totals - use filtered damages for accurate totals when filtering
    const totalValue = useMemo(() => {
        const hasFilters = selectedSupplier || hasDateFilter;
        const damagesToSum = hasFilters ? filteredDamages : allDamages;
        return damagesToSum.reduce((sum, damage) => sum + (damage.totalLoss || 0), 0);
    }, [filteredDamages, allDamages, selectedSupplier, hasDateFilter]);

    if (isLoading) {
        return <Loader fullScreen message="Loading damages..." />;
    }

    if (isError) {
        return <ErrorState description="Unable to fetch damages." onRetry={refetch} />;
    }

    const totalDamagesCount = reportData?.summary?.totalDamages || totalDamages;

    return (
        <>
            {/* Hidden printable content */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm' }}>
                <div ref={printRef} className="bg-white" style={{ width: '210mm', padding: '20mm', fontFamily: 'Arial, sans-serif' }}>
                    <style>{`
                        @media print {
                            @page {
                                size: A4;
                                margin: 0;
                            }
                            body {
                                margin: 0;
                                padding: 0;
                            }
                        }
                        .print-container {
                            width: 100%;
                            max-width: 100%;
                        }
                        .print-header {
                            border-bottom: 3px solid #1e293b;
                            padding-bottom: 15px;
                            margin-bottom: 25px;
                        }
                        .print-title {
                            font-size: 28px;
                            font-weight: 700;
                            color: #0f172a;
                            margin: 0 0 8px 0;
                            letter-spacing: -0.5px;
                        }
                        .print-subtitle {
                            font-size: 14px;
                            color: #64748b;
                            margin: 4px 0;
                        }
                        .print-info-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 15px;
                            margin-top: 20px;
                            padding: 15px;
                            background: #f8fafc;
                            border-radius: 8px;
                            border: 1px solid #e2e8f0;
                        }
                        .print-info-item {
                            display: flex;
                            flex-direction: column;
                        }
                        .print-info-label {
                            font-size: 11px;
                            font-weight: 600;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            margin-bottom: 4px;
                        }
                        .print-info-value {
                            font-size: 14px;
                            font-weight: 600;
                            color: #0f172a;
                        }
                        .print-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 20px;
                            font-size: 11px;
                        }
                        .print-table thead {
                            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                            color: white;
                        }
                        .print-table th {
                            padding: 12px 8px;
                            text-align: left;
                            font-weight: 600;
                            font-size: 10px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            border: 1px solid #334155;
                        }
                        .print-table th.text-center {
                            text-align: center;
                        }
                        .print-table th.text-right {
                            text-align: right;
                        }
                        .print-table tbody tr {
                            border-bottom: 1px solid #e2e8f0;
                            transition: background-color 0.2s;
                        }
                        .print-table tbody tr:nth-child(even) {
                            background-color: #f8fafc;
                        }
                        .print-table tbody tr:hover {
                            background-color: #f1f5f9;
                        }
                        .print-table td {
                            padding: 10px 8px;
                            color: #334155;
                            border: 1px solid #e2e8f0;
                        }
                        .print-table td.text-center {
                            text-align: center;
                        }
                        .print-table td.text-right {
                            text-align: right;
                        }
                        .print-table .damage-id {
                            font-weight: 600;
                            color: #0f172a;
                        }
                        .print-table .loss-value {
                            font-weight: 600;
                            color: #dc2626;
                        }
                        .print-table .total-row {
                            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important;
                            font-weight: 700;
                            border-top: 2px solid #dc2626;
                        }
                        .print-table .total-row td {
                            padding: 12px 8px;
                            color: #0f172a;
                            border: 1px solid #fca5a5;
                        }
                        .print-table .total-amount {
                            color: #dc2626;
                            font-size: 13px;
                        }
                        .print-summary {
                            margin-top: 30px;
                            padding: 20px;
                            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                            border-radius: 8px;
                            border: 2px solid #e2e8f0;
                        }
                        .print-summary-title {
                            font-size: 16px;
                            font-weight: 700;
                            color: #0f172a;
                            margin-bottom: 15px;
                            padding-bottom: 10px;
                            border-bottom: 2px solid #cbd5e1;
                        }
                        .print-summary-grid {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 20px;
                        }
                        .print-summary-item {
                            text-align: center;
                        }
                        .print-summary-label {
                            font-size: 11px;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            margin-bottom: 6px;
                        }
                        .print-summary-value {
                            font-size: 20px;
                            font-weight: 700;
                            color: #0f172a;
                        }
                        .print-footer {
                            margin-top: 30px;
                            padding-top: 15px;
                            border-top: 2px solid #e2e8f0;
                            text-align: center;
                            font-size: 10px;
                            color: #94a3b8;
                        }
                    `}</style>
                    {(() => {
                        const hasFilters = selectedSupplier || hasDateFilter;
                        const damagesToPrint = hasFilters ? filteredDamages : allDamages;
                        const totalDamages = damagesToPrint.length;
                        const totalQuantity = damagesToPrint.reduce((sum, d) => {
                            const items = d.items && Array.isArray(d.items) ? d.items : [];
                            return sum + items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0);
                        }, 0);
                        const totalLoss = damagesToPrint.reduce((sum, d) => sum + (d.totalLoss || 0), 0);
                        const selectedSupplierName = selectedSupplier && suppliersData?.suppliers
                            ? suppliersData.suppliers.find((s) => s._id === selectedSupplier)?.name
                            : null;
                        const dateRangeDisplay = dateRange === 'custom' && customStartDate && customEndDate
                            ? `${dayjs(customStartDate).format('DD MMM YYYY')} - ${dayjs(customEndDate).format('DD MMM YYYY')}`
                            : dateRange === 'all' ? 'All Time'
                                : dateRange.charAt(0).toUpperCase() + dateRange.slice(1);

                        return damagesToPrint.length > 0 ? (
                            <div className="print-container">
                                {/* Header */}
                                <div className="print-header">
                                    <h1 className="print-title">Damage List Report</h1>
                                    <p className="print-subtitle">
                                        Generated on: {dayjs().format('DD MMMM YYYY [at] hh:mm A')}
                                    </p>

                                    {/* Info Grid */}
                                    <div className="print-info-grid">
                                        {selectedSupplierName && (
                                            <div className="print-info-item">
                                                <span className="print-info-label">Supplier</span>
                                                <span className="print-info-value">{selectedSupplierName}</span>
                                            </div>
                                        )}
                                        {hasDateFilter && (
                                            <div className="print-info-item">
                                                <span className="print-info-label">Date Range</span>
                                                <span className="print-info-value">{dateRangeDisplay}</span>
                                            </div>
                                        )}
                                        <div className="print-info-item">
                                            <span className="print-info-label">Total Damages</span>
                                            <span className="print-info-value">{totalDamages}</span>
                                        </div>
                                        <div className="print-info-item">
                                            <span className="print-info-label">Report Period</span>
                                            <span className="print-info-value">{dateRangeDisplay}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Damages Table */}
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '15%' }}>Damage ID</th>
                                            <th style={{ width: '25%' }}>Supplier</th>
                                            <th className="text-right" style={{ width: '20%' }}>Amount</th>
                                            <th style={{ width: '20%' }}>Damaged Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {damagesToPrint.map((damage) => (
                                            <tr key={damage._id}>
                                                <td className="damage-id">{damage.damageNumber}</td>
                                                <td>
                                                    {(() => {
                                                        const supplierNames = new Set<string>();
                                                        if (damage.items && Array.isArray(damage.items)) {
                                                            damage.items.forEach((item: any) => {
                                                                const name = item.supplierName || item.supplier?.name;
                                                                if (name) supplierNames.add(name);
                                                            });
                                                        }
                                                        return Array.from(supplierNames).slice(0, 2).join(', ') || 'N/A';
                                                    })()}
                                                </td>
                                                <td className="text-right loss-value">৳{(damage.totalLoss || 0).toLocaleString()}</td>
                                                <td>{damage.createdAt ? dayjs(damage.createdAt).format('DD MMM YYYY') : 'N/A'}</td>
                                            </tr>
                                        ))}
                                        <tr className="total-row">
                                            <td colSpan={2} className="text-right" style={{ fontSize: '12px', fontWeight: 700 }}>
                                                TOTAL:
                                            </td>
                                            <td className="text-right total-amount">
                                                ৳{totalLoss.toLocaleString()}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Summary Section */}
                                <div className="print-summary">
                                    <div className="print-summary-title">Summary</div>
                                    <div className="print-summary-grid">
                                        <div className="print-summary-item">
                                            <div className="print-summary-label">Total Damages</div>
                                            <div className="print-summary-value">{totalDamages}</div>
                                        </div>
                                        <div className="print-summary-item">
                                            <div className="print-summary-label">Total Quantity</div>
                                            <div className="print-summary-value">{totalQuantity}</div>
                                        </div>
                                        <div className="print-summary-item">
                                            <div className="print-summary-label">Total Loss Value</div>
                                            <div className="print-summary-value" style={{ color: '#dc2626' }}>
                                                ৳{totalLoss.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="print-footer">
                                    <p>This is a computer-generated report. No signature is required.</p>
                                    <p style={{ marginTop: '5px' }}>
                                        Kabir Store Inventory Management System
                                    </p>
                                </div>
                            </div>
                        ) : null;
                    })()}
                </div>
            </div>

            {/* Visible Content */}
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">Inventory Management</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-900">Damage Reports</h1>
                    </div>
                    <button
                        onClick={() => navigate('/damages/report')}
                        className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Report Damage
                    </button>
                </div>

                {/* Date Range Selector */}
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
                            setPage(1);
                        }
                    }}
                />

                {/* Stats Cards */}
                <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                        {
                            label: 'Total Damages',
                            value: totalDamagesCount,
                            color: 'blue',
                            icon: '📦',
                            subtitle: 'All time',
                        },
                        {
                            label: 'Total Loss Value',
                            value: `৳${totalValue.toLocaleString()}`,
                            color: 'green',
                            icon: '💵',
                            subtitle: 'Total value',
                        },
                        {
                            label: 'Filtered Results',
                            value: filteredDamages.length,
                            color: 'purple',
                            icon: '📋',
                            subtitle: 'Current view',
                        },
                    ].map((card) => (
                        <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-linear-to-br from-white/95 to-slate-50/95 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">{card.icon}</span>
                                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
                                    </div>
                                    <p className={`text-2xl font-bold ${card.color === 'blue' ? 'text-blue-600' : card.color === 'green' ? 'text-green-600' : 'text-purple-600'} group-hover:scale-105 transition-transform duration-300`}>
                                        {card.value}
                                    </p>
                                    <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">{card.subtitle}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </section>

                {/* Damages Table */}
                <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                            <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                            <input
                                className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                                placeholder="Search damages..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDownloadExcel}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300"
                            >
                                <TableCellsIcon className="h-5 w-5" />
                                Download Excel
                            </button>
                            <button
                                onClick={handlePrint}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                            >
                                <PrinterIcon className="h-5 w-5" />
                                Print
                            </button>
                            <div className="relative" ref={filterRef}>
                                <button
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all ${selectedSupplier
                                        ? 'border-brand bg-brand/10 text-brand'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <FunnelIcon className="h-5 w-5" />
                                    Filter
                                    {selectedSupplier && suppliersData?.suppliers && (
                                        <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">
                                            {suppliersData.suppliers.find((s) => s._id === selectedSupplier)?.name || 'Supplier'}
                                        </span>
                                    )}
                                    <ChevronDownIcon className={`h-4 w-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Filter Dropdown */}
                                {isFilterOpen && (
                                    <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl">
                                        <div className="p-3 border-b border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-slate-900">Filter by Supplier</h3>
                                                {selectedSupplier && (
                                                    <button
                                                        onClick={handleClearFilter}
                                                        className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto p-2">
                                            <button
                                                onClick={() => handleSupplierFilter(null)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${!selectedSupplier
                                                    ? 'bg-brand/10 text-brand font-semibold'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                                    }`}
                                            >
                                                All Suppliers
                                            </button>
                                            {suppliersData?.suppliers && suppliersData.suppliers.length > 0 ? (
                                                suppliersData.suppliers.map((supplier) => (
                                                    <button
                                                        key={supplier._id}
                                                        onClick={() => handleSupplierFilter(supplier._id)}
                                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${selectedSupplier === supplier._id
                                                            ? 'bg-brand/10 text-brand font-semibold'
                                                            : 'text-slate-700 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {supplier.name}
                                                    </button>
                                                ))
                                            ) : (
                                                <p className="px-3 py-2 text-xs text-slate-500">No suppliers available</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                            <thead className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                <tr>
                                    <th className="py-2.5 pr-4">S/N</th>
                                    <th className="py-2.5 pr-4">Damage ID</th>
                                    <th className="py-2.5 pr-4">Supplier</th>
                                    <th className="py-2.5 pr-4">Amount</th>
                                    <th className="py-2.5 pr-4">Damaged Date</th>
                                    <th className="py-2.5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-600">
                                {paginatedDamages.map((damage, idx) => {
                                    const items = damage.items && Array.isArray(damage.items) && damage.items.length > 0
                                        ? damage.items
                                        : [];
                                    const supplierNames = new Set<string>();
                                    items.forEach((item: any) => {
                                        const supplierName = item.supplierName || item.supplier?.name || null;
                                        if (supplierName) supplierNames.add(supplierName);
                                    });
                                    const supplierNamesArray = Array.from(supplierNames);

                                    return (
                                        <tr key={damage._id} className="transition hover:bg-slate-50/70">
                                            <td className="py-2.5 pr-4 text-slate-400">{(page - 1) * limit + idx + 1}</td>
                                            <td className="py-2.5 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                                                        <PrinterIcon className="h-4 w-4 text-red-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{damage.damageNumber}</p>
                                                        {damage.orderNumber && (
                                                            <p className="text-[10px] text-slate-400">Order: {damage.orderNumber}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2.5 pr-4 text-slate-700">
                                                <div className="space-y-0.5">
                                                    {supplierNamesArray.slice(0, 2).map((name, idx) => (
                                                        <p key={idx}>{name}</p>
                                                    ))}
                                                    {supplierNamesArray.length > 2 && (
                                                        <p className="text-[10px] text-slate-500">+{supplierNamesArray.length - 2} more</p>
                                                    )}
                                                    {supplierNamesArray.length === 0 && <span>N/A</span>}
                                                </div>
                                            </td>
                                            <td className="py-2.5 pr-4 font-semibold text-red-600">৳{(damage.totalLoss || 0).toLocaleString()}</td>
                                            <td className="py-2.5 pr-4 text-slate-700">
                                                {dayjs(damage.createdAt).format('DD MMM YYYY')}
                                            </td>
                                            <td className="py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleViewClick(damage)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700"
                                                        title="View damage invoice"
                                                    >
                                                        <EyeIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintClick(damage)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                                                        title="Print damage invoice"
                                                    >
                                                        <PrinterIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {paginatedDamages.length === 0 && (
                            <div className="py-10 text-center text-sm text-slate-500">No damages found.</div>
                        )}
                    </div>

                    {/* Pagination */}
                    {paginatedDamages.length > 0 && (
                        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
                            <div className="text-sm text-slate-500">
                                Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
                                <span className="font-semibold text-slate-900">
                                    {Math.min(page * limit, (() => {
                                        const hasFilters = selectedSupplier || hasDateFilter;
                                        return hasFilters ? filteredDamages.length : totalDamages;
                                    })())}
                                </span>{' '}
                                of <span className="font-semibold text-slate-900">{(() => {
                                    const hasFilters = selectedSupplier || hasDateFilter;
                                    return hasFilters ? filteredDamages.length : totalDamages;
                                })()}</span> damages
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 1}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </button>
                                <span className="text-sm font-semibold text-slate-700">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page === totalPages}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                                >
                                    <ChevronRightIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* View Damage Invoice Modal */}
                {viewingDamageId && (
                    <DamageInvoiceModal
                        damageId={viewingDamageId}
                        onClose={handleCloseViewModal}
                    />
                )}

                {/* Print Damage Invoice Modal */}
                {printingDamageId && (
                    <DamageInvoiceModal
                        damageId={printingDamageId}
                        onClose={handleClosePrintModal}
                    />
                )}
            </div>
        </>
    );
};

export default DamagesPage;
