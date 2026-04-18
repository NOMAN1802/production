/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo, useRef, useEffect } from 'react';
import {
    ArrowUturnLeftIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EyeIcon,
    PrinterIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import {
    useGetReturnsQuery,
} from '@/services/returnsApi';
import { useGetReturnReportQuery } from '@/services/reportsApi';
import ReturnDetailsModal from './ReturnDetailsModal';
import OrderReturnModal from './OrderReturnModal';
import DateRangeSelector from '@/pages/reports/DateRangeSelector';

type DateRangeType = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

type GroupedReturn = {
    orderNumber: string | null;
    returns: Array<{
        _id: string;
        returnNumber: string;
        productName: string;
        quantity: number;
        totalAmount?: number;
        unitPrice?: number;
        reason?: string;
        customer?: {
            name: string;
            phone?: string;
            email?: string;
        };
        createdAt?: string;
    }>;
    totalQuantity: number;
    totalAmount: number;
    returnCount: number;
    earliestDate?: string;
    supplierNames?: string[];
    customer?: {
        name: string;
        phone?: string;
        email?: string;
    };
};

const ReturnsPage = () => {
   
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [viewingReturnId, setViewingReturnId] = useState<string | null>(null);
    const [viewingOrderNumber, setViewingOrderNumber] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRangeType>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const filterRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    const limit = 20;

    // Calculate date range based on selection
    const getDateRangeParams = useMemo(() => {
        if (dateRange === 'all') {
            return null; // No date filtering for 'all'
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
                    startDate = now.startOf('day').toISOString();
                    endDate = now.endOf('day').toISOString();
            }
        }

        return { startDate, endDate };
    }, [dateRange, customStartDate, customEndDate]);

    // Fetch all returns when filtering by customer or date (not 'all'), otherwise use pagination
    const shouldFetchAll = selectedCustomer || (dateRange !== 'all' && getDateRangeParams !== null);

    // Fetch returns list
    const {
        data: returnsData,
        isLoading: isReturnsLoading,
        isError: isReturnsError,
        refetch
    } = useGetReturnsQuery({
        search,
        page: shouldFetchAll ? 1 : page, // When filtering, fetch all for client-side filtering
        limit: shouldFetchAll ? 10000 : limit, // Fetch all when filtering
        ...(getDateRangeParams ? getDateRangeParams : {}), // Pass date params only when not 'all'
    });

    // Fetch returns report for summary stats
    const { data: reportData } = useGetReturnReportQuery({});

    // const handleViewReturn = (returnId: string) => {
    //     setViewingReturnId(returnId);
    // };

    const handleCloseDetailsModal = () => {
        setViewingReturnId(null);
    };

    const handleViewOrderReturns = (orderNumber: string | null) => {
        setViewingOrderNumber(orderNumber);
    };

    const handleCloseOrderModal = () => {
        setViewingOrderNumber(null);
    };

    const handleCustomerFilter = (customerName: string | null) => {
        setSelectedCustomer(customerName);
        setIsFilterOpen(false);
        setPage(1); // Reset to first page when filtering
    };

    const handleClearFilter = () => {
        setSelectedCustomer(null);
        setIsFilterOpen(false);
        setPage(1);
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

    const returns = useMemo(() => returnsData?.returns || [], [returnsData?.returns]);
    const totalReturns = reportData?.summary?.totalReturns || returnsData?.total || 0;
    const returnValue = reportData?.summary?.totalValue || 0;

    // Filter returns by date range (client-side when date filter is active)
    const filteredReturns = useMemo(() => {
        let filtered = returns;

        // Filter by date range (only if not 'all')
        if (dateRange !== 'all' && getDateRangeParams) {
            const { startDate, endDate } = getDateRangeParams;
            filtered = filtered.filter((returnItem) => {
                if (!returnItem.createdAt) return false;
                const returnDate = dayjs(returnItem.createdAt);
                return returnDate.isAfter(dayjs(startDate).subtract(1, 'day')) && 
                       returnDate.isBefore(dayjs(endDate).add(1, 'day'));
            });
        }

        return filtered;
    }, [returns, dateRange, getDateRangeParams]);

    // Extract unique customers from returns - MUST be called before any early returns
    const uniqueCustomers = useMemo(() => {
        const customerMap = new Map<string, { name: string; phone?: string; email?: string }>();
        returns.forEach((returnItem) => {
            if (returnItem.customer?.name) {
                const customerName = returnItem.customer.name;
                if (!customerMap.has(customerName)) {
                    customerMap.set(customerName, {
                        name: customerName,
                        phone: returnItem.customer.phone,
                        email: returnItem.customer.email,
                    });
                }
            }
        });
        return Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [returns]);

    // Group returns by order - MUST be called before any early returns
    const groupedReturns = useMemo(() => {
        const grouped = new Map<string | null, GroupedReturn>();

        // Use filtered returns when date filtering is active
        const returnsToGroup = dateRange !== 'all' ? filteredReturns : returns;

        returnsToGroup.forEach((returnItem) => {
            const orderNumber = returnItem.orderNumber || null;
            const key = orderNumber || 'no-order';

            if (!grouped.has(key)) {
                grouped.set(key, {
                    orderNumber,
                    returns: [],
                    totalQuantity: 0,
                    totalAmount: 0,
                    returnCount: 0,
                    supplierNames: [],
                    customer: returnItem.customer,
                });
            }

            const group = grouped.get(key)!;
            
            // Extract supplier names from items
            const supplierSet = new Set<string>();
            if (returnItem.items && Array.isArray(returnItem.items)) {
                returnItem.items.forEach((item: any) => {
                    if (item.supplierName) {
                        supplierSet.add(item.supplierName);
                    }
                });
            }
            // Also check legacy format for backward compatibility
            if ((returnItem as any).supplierName) {
                supplierSet.add((returnItem as any).supplierName);
            }
            
            supplierSet.forEach(supplier => {
                if (!group.supplierNames?.includes(supplier)) {
                    if (!group.supplierNames) {
                        group.supplierNames = [];
                    }
                    group.supplierNames.push(supplier);
                }
            });

            group.returns.push({
                _id: returnItem._id,
                returnNumber: returnItem.returnNumber,
                productName: returnItem.items?.[0]?.productName || (returnItem as any).productName || 'N/A',
                quantity: returnItem.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || (returnItem as any).quantity || 0,
                totalAmount: returnItem.totalAmount,
                unitPrice: returnItem.items?.[0]?.unitPrice || (returnItem as any).unitPrice || 0,
                reason: returnItem.reason,
                customer: returnItem.customer,
                createdAt: returnItem.createdAt,
            });
            group.totalQuantity += returnItem.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || (returnItem as any).quantity || 0;
            group.totalAmount += returnItem.totalAmount || 0;
            group.returnCount += 1;

            // Track earliest date
            if (returnItem.createdAt) {
                if (!group.earliestDate || dayjs(returnItem.createdAt).isBefore(dayjs(group.earliestDate))) {
                    group.earliestDate = returnItem.createdAt;
                }
            }
        });

        let result = Array.from(grouped.values()).sort((a, b) => {
            // Sort by earliest date (most recent first)
            if (a.earliestDate && b.earliestDate) {
                return dayjs(b.earliestDate).valueOf() - dayjs(a.earliestDate).valueOf();
            }
            if (a.earliestDate) return -1;
            if (b.earliestDate) return 1;
            return 0;
        });

        // Filter by selected customer
        if (selectedCustomer) {
            result = result.filter((group) => group.customer?.name === selectedCustomer);
        }

        return result;
    }, [returns, filteredReturns, selectedCustomer, dateRange]);

    // Calculate total pages based on whether filtering is active
    const totalPages = useMemo(() => {
        const hasFilters = selectedCustomer || dateRange !== 'all';
        if (hasFilters) {
            return Math.ceil(groupedReturns.length / limit);
        }
        return Math.ceil((returnsData?.total ?? 0) / limit);
    }, [selectedCustomer, dateRange, groupedReturns.length, returnsData?.total, limit]);

    // Paginate grouped returns for display
    const paginatedGroupedReturns = useMemo(() => {
        const hasFilters = selectedCustomer || dateRange !== 'all';
        if (!hasFilters) {
            // If no filter, use the grouped returns (already limited by backend pagination)
            return groupedReturns;
        }
        // If filtered, paginate the grouped results client-side
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return groupedReturns.slice(startIndex, endIndex);
    }, [groupedReturns, selectedCustomer, dateRange, page, limit]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Sales-Returns-${dayjs().format('YYYY-MM-DD')}`,
    });

    // Early returns after all hooks have been called
    if (isReturnsLoading) {
        return <Loader fullScreen message="Loading returns..." />;
    }

    if (isReturnsError) {
        return <ErrorState description="Unable to fetch returns." onRetry={refetch} />;
    }

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
                        .print-table .return-id {
                            font-weight: 600;
                            color: #0f172a;
                        }
                        .print-table .amount {
                            font-weight: 600;
                            color: #0f172a;
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
                        const hasFilters = selectedCustomer || dateRange !== 'all';
                        const returnsToPrint = hasFilters ? filteredReturns : returns;
                        const totalReturns = returnsToPrint.length;
                        const totalQuantity = returnsToPrint.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
                        const totalAmount = returnsToPrint.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
                        
                        return returnsToPrint.length > 0 ? (
                            <div className="print-container">
                                {/* Header */}
                                <div className="print-header">
                                    <h1 className="print-title">Sales Returns Report</h1>
                                    <p className="print-subtitle">
                                        Generated on: {dayjs().format('DD MMMM YYYY [at] hh:mm A')}
                                    </p>
                                    
                                    {/* Info Grid */}
                                    <div className="print-info-grid">
                                        {selectedCustomer && (
                                            <div className="print-info-item">
                                                <span className="print-info-label">Customer</span>
                                                <span className="print-info-value">{selectedCustomer}</span>
                                            </div>
                                        )}
                                        {dateRange !== 'all' && (
                                            <div className="print-info-item">
                                                <span className="print-info-label">Date Range</span>
                                                <span className="print-info-value">
                                                    {dateRange === 'custom' && customStartDate && customEndDate
                                                        ? `${dayjs(customStartDate).format('DD MMM YYYY')} - ${dayjs(customEndDate).format('DD MMM YYYY')}`
                                                        : dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="print-info-item">
                                            <span className="print-info-label">Total Returns</span>
                                            <span className="print-info-value">{totalReturns}</span>
                                        </div>
                                        <div className="print-info-item">
                                            <span className="print-info-label">Report Period</span>
                                            <span className="print-info-value">
                                                {dateRange === 'all' ? 'All Time' : 
                                                 dateRange === 'custom' && customStartDate && customEndDate
                                                    ? `${dayjs(customStartDate).format('DD MMM YYYY')} - ${dayjs(customEndDate).format('DD MMM YYYY')}`
                                                    : dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Returns Table */}
                                <table className="print-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '10%' }}>Date</th>
                                            <th style={{ width: '12%' }}>Order #</th>
                                            <th style={{ width: '12%' }}>Return ID</th>
                                            <th style={{ width: '15%' }}>Customer</th>
                                            <th style={{ width: '18%' }}>Product</th>
                                            <th className="text-center" style={{ width: '8%' }}>Qty</th>
                                            <th className="text-right" style={{ width: '10%' }}>Unit Price</th>
                                            <th className="text-right" style={{ width: '10%' }}>Total</th>
                                            <th style={{ width: '13%' }}>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnsToPrint.flatMap((returnItem) => {
                                            const items = returnItem.items && Array.isArray(returnItem.items) && returnItem.items.length > 0 
                                                ? returnItem.items 
                                                : [{ 
                                                    productName: returnItem.productName || 'N/A', 
                                                    quantity: returnItem.quantity || 0, 
                                                    unitPrice: returnItem.unitPrice || 0,
                                                    totalPrice: returnItem.totalAmount || 0
                                                }];
                                            
                                            return items.map((item: any, itemIndex: number) => (
                                                <tr key={`${returnItem._id}-${itemIndex}`}>
                                                    {itemIndex === 0 && (
                                                        <>
                                                            <td rowSpan={items.length}>{returnItem.createdAt ? dayjs(returnItem.createdAt).format('DD MMM YYYY') : 'N/A'}</td>
                                                            <td rowSpan={items.length}>{returnItem.orderNumber || 'N/A'}</td>
                                                            <td rowSpan={items.length} className="return-id">{returnItem.returnNumber}</td>
                                                            <td rowSpan={items.length}>{returnItem.customer?.name || 'N/A'}</td>
                                                        </>
                                                    )}
                                                    <td>{item.productName}</td>
                                                    <td className="text-center">{item.quantity}</td>
                                                    <td className="text-right">৳{(item.unitPrice || 0).toLocaleString()}</td>
                                                    <td className="text-right amount">৳{(item.totalPrice || 0).toLocaleString()}</td>
                                                    {itemIndex === 0 && (
                                                        <td rowSpan={items.length}>{returnItem.reason || 'N/A'}</td>
                                                    )}
                                                </tr>
                                            ));
                                        })}
                                        <tr className="total-row">
                                            <td colSpan={5} className="text-right" style={{ fontSize: '12px', fontWeight: 700 }}>
                                                TOTAL:
                                            </td>
                                            <td className="text-center" style={{ fontSize: '12px', fontWeight: 700 }}>
                                                {totalQuantity}
                                            </td>
                                            <td></td>
                                            <td className="text-right total-amount">
                                                ৳{totalAmount.toLocaleString()}
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
                                            <div className="print-summary-label">Total Returns</div>
                                            <div className="print-summary-value">{totalReturns}</div>
                                        </div>
                                        <div className="print-summary-item">
                                            <div className="print-summary-label">Total Quantity</div>
                                            <div className="print-summary-value">{totalQuantity}</div>
                                        </div>
                                        <div className="print-summary-item">
                                            <div className="print-summary-label">Total Amount</div>
                                            <div className="print-summary-value" style={{ color: '#dc2626' }}>
                                                ৳{totalAmount.toLocaleString()}
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
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">Sale Return Management</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-900">Return Product</h1>
                    </div>
        
                </div>

                {/* Date Range Selector */}
                <DateRangeSelector
                    dateRange={dateRange}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                    onDateRangeChange={(range) => {
                        setDateRange(range);
                        if (range !== 'custom') {
                            setCustomStartDate('');
                            setCustomEndDate('');
                        }
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
            <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    {
                        label: 'Total Returns',
                        value: totalReturns,
                        delta: '+2.3%',
                        color: 'orange',
                        icon: '↩️',
                        subtitle: 'All time'
                    },
                    {
                        label: 'Return Value',
                        value: `৳${returnValue.toLocaleString()}`,
                        delta: '-1.2%',
                        color: 'red',
                        icon: '💸',
                        subtitle: 'Total amount'
                    },
                    {
                        label: 'Filtered Results',
                        value: (() => {
                            const hasFilters = selectedCustomer || dateRange !== 'all';
                            return hasFilters ? groupedReturns.length : returns.length;
                        })(),
                        delta: '+0.8%',
                        color: 'blue',
                        icon: '📋',
                        subtitle: 'Current view'
                    },
                    {
                        label: 'Avg Return Value',
                        value: totalReturns > 0 ? `৳${Math.round(returnValue / totalReturns).toLocaleString()}` : '৳0',
                        delta: '+3.1%',
                        color: 'purple',
                        icon: '📊',
                        subtitle: 'Per return'
                    }
                ].map((card) => (
                    <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-linear-to-br from-white/95 to-slate-50/95 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{card.icon}</span>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
                                </div>
                                <p className={`text-2xl font-bold ${card.color === 'orange' ? 'text-orange-600' :
                                    card.color === 'red' ? 'text-red-600' :
                                        card.color === 'blue' ? 'text-blue-600' :
                                            'text-purple-600'
                                    } group-hover:scale-105 transition-transform duration-300`}>
                                    {card.value}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">{card.subtitle}</p>
                            </div>
                            <div className={`rounded-full p-2 ${card.color === 'orange' ? 'bg-orange-100' :
                                card.color === 'red' ? 'bg-red-100' :
                                    card.color === 'blue' ? 'bg-blue-100' :
                                        'bg-purple-100'
                                } opacity-60 group-hover:opacity-100 transition-opacity duration-300`}>
                                <div className={`h-2 w-2 rounded-full ${card.color === 'orange' ? 'bg-orange-500' :
                                    card.color === 'red' ? 'bg-red-500' :
                                        card.color === 'blue' ? 'bg-blue-500' :
                                            'bg-purple-500'
                                    }`}></div>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center">
                            <span className={`text-xs font-semibold ${card.delta.startsWith('+') ? 'text-emerald-600' : 'text-red-500'
                                }`}>
                                {card.delta}
                            </span>
                            <span className="ml-1 text-xs text-slate-400">vs last month</span>
                        </div>
                        {/* Subtle gradient overlay */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${card.color === 'orange' ? 'bg-orange-500' :
                            card.color === 'red' ? 'bg-red-500' :
                                card.color === 'blue' ? 'bg-blue-500' :
                                    'bg-purple-500'
                            }`}></div>
                    </div>
                ))}
            </section>

            {/* Returns Table */}
            <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                        <input
                            className="w-full border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                            placeholder="Search returns..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
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
                            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all ${
                                selectedCustomer
                                    ? 'border-brand bg-brand/10 text-brand'
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                        <FunnelIcon className="h-5 w-5" />
                        Filter
                            {selectedCustomer && (
                                <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">
                                    {uniqueCustomers.find((c) => c.name === selectedCustomer)?.name || selectedCustomer}
                                </span>
                            )}
                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Filter Dropdown */}
                        {isFilterOpen && (
                            <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl">
                                <div className="p-3 border-b border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-900">Filter by Customer</h3>
                                        {selectedCustomer && (
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
                                        onClick={() => handleCustomerFilter(null)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                            !selectedCustomer
                                                ? 'bg-brand/10 text-brand font-semibold'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        All Customers
                                    </button>
                                    {uniqueCustomers.length > 0 ? (
                                        uniqueCustomers.map((customer) => (
                                            <button
                                                key={customer.name}
                                                onClick={() => handleCustomerFilter(customer.name)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                                    selectedCustomer === customer.name
                                                        ? 'bg-brand/10 text-brand font-semibold'
                                                        : 'text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="font-medium">{customer.name}</div>
                                                {customer.phone && (
                                                    <div className="text-xs text-slate-500 mt-0.5">{customer.phone}</div>
                                                )}
                    </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-sm text-slate-500">No customers found</div>
                                    )}
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                        <thead className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                            <tr>
                                <th className="py-3 pr-4">Order Number</th>
                                <th className="py-3 pr-4">Customer</th>
                                <th className="py-3 pr-4">Return Numbers</th>
                                <th className="py-3 pr-4">Supplier</th>
                                <th className="py-3 pr-4">Total Amount</th>
                                <th className="py-3 pr-4">Date</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                            {paginatedGroupedReturns.map((group, index) => (
                                <tr key={group.orderNumber || `no-order-${index}`} className="transition hover:bg-slate-50/70">
                                    <td className="py-4 pr-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                                                <ArrowUturnLeftIcon className="h-5 w-5 text-orange-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-blue-600">{group.orderNumber || 'N/A'}</p>
                                                <p className="text-xs text-slate-400">
                                                    {group.returnCount} return{group.returnCount > 1 ? 's' : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 pr-4 text-slate-700">{group.customer?.name || 'N/A'}</td>
                                    <td className="py-4 pr-4">
                                        <div className="space-y-1">
                                            {group.returns.slice(0, 2).map((ret) => (
                                                <p key={ret._id} className="font-semibold text-orange-600 text-xs">
                                                    {ret.returnNumber}
                                                </p>
                                            ))}
                                            {group.returns.length > 2 && (
                                                <p className="text-xs text-slate-500 font-semibold">
                                                    +{group.returns.length - 2} more
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 pr-4 text-slate-700">
                                        {group.supplierNames && group.supplierNames.length > 0 ? (
                                            <div className="space-y-1">
                                                {group.supplierNames.slice(0, 2).map((supplier, idx) => (
                                                    <p key={idx} className="text-sm font-medium">
                                                        {supplier}
                                                    </p>
                                                ))}
                                                {group.supplierNames.length > 2 && (
                                                    <p className="text-xs text-slate-500">
                                                        +{group.supplierNames.length - 2} more
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-400">N/A</span>
                                        )}
                                    </td>
                                    <td className="py-4 pr-4 font-semibold text-slate-900">
                                        ৳{group.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="py-4 pr-4 text-slate-600">
                                        {group.earliestDate ? dayjs(group.earliestDate).format('YYYY-MM-DD') : 'N/A'}
                                    </td>
                                    <td className="py-4 pr-4">
                                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                            ✓ Active
                                        </span>
                                    </td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleViewOrderReturns(group.orderNumber)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                                                title="View order returns"
                                            >
                                                <EyeIcon className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleViewOrderReturns(group.orderNumber)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                                                title="View and print order returns"
                                            >
                                                <PrinterIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {paginatedGroupedReturns.length === 0 && (
                        <div className="py-10 text-center text-sm text-slate-500">No returns found.</div>
                    )}
                </div>

                {/* Pagination */}
                {paginatedGroupedReturns.length > 0 && (
                    <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
                            <span className="font-semibold text-slate-900">
                                {(() => {
                                    const hasFilters = selectedCustomer || dateRange !== 'all';
                                    return hasFilters 
                                        ? Math.min(page * limit, groupedReturns.length)
                                        : Math.min(page * limit, returnsData?.total ?? 0);
                                })()}
                            </span>{' '}
                            of <span className="font-semibold text-slate-900">
                                {(() => {
                                    const hasFilters = selectedCustomer || dateRange !== 'all';
                                    return hasFilters ? groupedReturns.length : (returnsData?.total ?? 0);
                                })()}
                            </span> returns
                            {(selectedCustomer || dateRange !== 'all') && (
                                <span className="ml-2 text-xs text-slate-400">
                                    (filtered)
                                </span>
                            )}
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

            {/* Return Details Modal */}
            <ReturnDetailsModal
                returnId={viewingReturnId}
                onClose={handleCloseDetailsModal}
            />

            {/* Order Returns Modal */}
            <OrderReturnModal
                orderNumber={viewingOrderNumber}
                onClose={handleCloseOrderModal}
            />

            </div>
        </>
    );
};

export default ReturnsPage;
