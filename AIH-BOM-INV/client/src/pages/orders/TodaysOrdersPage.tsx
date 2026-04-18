/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useMemo } from 'react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import {
    PrinterIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import { useGetOrdersQuery } from '@/services/ordersApi';
import { useGetReturnsQuery } from '@/services/returnsApi';
import * as XLSX from 'xlsx';
import kabirLogo from '@/assets/kabirLogo.png';

// interface CategoryItem {
//     productName: string;
//     quantity: number;
//     unitPrice: number;
//     totalPrice: number;
//     orderNumber: string;
//     type: 'order' | 'return';
// }

interface DailySummary {
    totalOrders: number;
    totalAmount: number;
    totalReturns: number;
    returnAmount: number;
    netAmount: number;
}

const TodaysOrdersPage = () => {
    const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
    const reportRef = useRef<HTMLDivElement>(null);

    // Fetch today's data
    const { data: ordersData, isLoading: ordersLoading, isError: ordersError } = useGetOrdersQuery({
        date: selectedDate,
        limit: 10000, // Get all orders for the date
    });

    // Debug: Also fetch all orders to check if any exist
    const { data: allOrdersData } = useGetOrdersQuery({
        limit: 10000,
    }, { skip: true }); // Skip by default, but can be enabled for debugging

    // Fetch all returns (not just today's) to match returns to orders properly
    // Returns might be created on a different date than the order
    const { data: returnsData, isLoading: returnsLoading } = useGetReturnsQuery({
        search: '', // Add default search to avoid API errors
        limit: 10000, // Get all returns to match with today's orders
    });

    const allOrders = ordersData?.result || [];
    const allReturns = returnsData?.returns || [];

    // Get order numbers from today's orders for matching
    const todayOrderNumbers = new Set(allOrders.map((o: any) => o.orderNumber));
    const todayOrderIds = new Set(allOrders.map((o: any) => o._id));

    // Filter returns that belong to today's orders (not by return date, but by order reference)
    const returns = allReturns.filter((ret: any) => {
        // Match by orderNumber
        if (ret.orderNumber && todayOrderNumbers.has(ret.orderNumber)) {
            return true;
        }
        // Match by orderId
        const orderId = ret.orderId || (typeof ret.order === 'string' ? ret.order : ret.order?._id);
        if (orderId && todayOrderIds.has(orderId)) {
            return true;
        }
        return false;
    });

    // Use orders directly (they should be filtered by API)
    const orders = allOrders;

    // Debug: Log orders and items structure
    console.log('=== Today\'s Orders Debug ===');
    console.log('Selected date:', selectedDate);
    console.log('Orders data:', ordersData);
    console.log('Orders count:', orders.length);
    console.log('Orders loading:', ordersLoading);
    console.log('Orders error:', ordersError);
    console.log('Returns data:', returnsData);
    console.log('All returns count:', allReturns.length);
    console.log('Filtered returns count:', returns.length);
    if (returns.length > 0) {
        console.log('Sample return:', returns[0]);
        console.log('Sample return items:', returns[0].items);
    }

    // Check if we have any orders at all (for debugging)
    if (allOrdersData?.result) {
        console.log('Total orders in system (sample):', allOrdersData.result.length);
        if (allOrdersData.result.length > 0) {
            console.log('Sample order date:', allOrdersData.result[0].createdAt);
            console.log('Sample order date formatted:', dayjs(allOrdersData.result[0].createdAt).format('YYYY-MM-DD'));
        }
    }

    if (orders.length > 0) {
        console.log('First order:', orders[0]);
        console.log('First order createdAt:', orders[0].createdAt);
        console.log('First order date formatted:', dayjs(orders[0].createdAt).format('YYYY-MM-DD'));
        console.log('First order items:', orders[0].items);
        if (orders[0].items && orders[0].items.length > 0) {
            console.log('First item:', orders[0].items[0]);
            console.log('First item categoryName:', orders[0].items[0].categoryName);
        }
    } else {
        console.log('No orders found for selected date. This could mean:');
        console.log('1. No orders exist for this date');
        console.log('2. Date filter is not working correctly');
        console.log('3. Orders exist but createdAt field format is different');
    }

    // Organize orders order-wise (sales-wise) - memoized for stability
    const orderWiseSales = useMemo(() => {
        // Track which returns have been linked to orders
        const linkedReturnIds = new Set<string>();

        const sales = orders.map((order: any) => {
            const orderItems = order.items.map((item: any) => ({
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                categoryName: item.categoryName || 'অন্যান্য',
                type: 'order' as const
            }));

            // Calculate order totals
            const orderQuantity = orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
            const orderAmount = orderItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

            // Find related returns for this order - check multiple matching strategies
            const relatedReturns = returns.filter((ret: any) => {
                // Strategy 1: Match by orderNumber (most reliable)
                if (ret.orderNumber === order.orderNumber) {
                    return true;
                }

                // Strategy 2: Match by orderId
                const retOrderId = ret.orderId ||
                    (typeof ret.order === 'string' ? ret.order : null) ||
                    (typeof ret.order === 'object' ? ret.order?._id : null);

                if (retOrderId === order._id) {
                    return true;
                }

                // Strategy 3: Match by nested order object orderNumber
                if (ret.order && typeof ret.order === 'object' && ret.order.orderNumber === order.orderNumber) {
                    return true;
                }

                return false;
            });

            // Debug logging for Order 39
            if (order.orderNumber === 'ORD-000039') {
                console.log('=== Order 39 Return Matching Debug ===');
                console.log('Order:', order.orderNumber, order._id);
                console.log('Total returns available:', returns.length);
                console.log('Related returns found:', relatedReturns.length);
                relatedReturns.forEach((ret: any, idx: number) => {
                    console.log(`Return ${idx + 1}:`, {
                        returnNumber: ret.returnNumber,
                        orderId: ret.orderId,
                        orderNumber: ret.orderNumber,
                        order: ret.order,
                        items: ret.items,
                        totalAmount: ret.totalAmount
                    });
                });
            }

            // Mark these returns as linked
            relatedReturns.forEach((ret: any) => {
                linkedReturnIds.add(ret._id);
            });

            // Process return items - returns can have items array or be a single item (legacy)
            const returnItems = relatedReturns.flatMap((ret: any) => {
                // If return has items array, use it
                if (ret.items && Array.isArray(ret.items) && ret.items.length > 0) {
                    const items = ret.items.map((item: any) => {
                        // Use totalPrice from item, fallback to calculated value
                        const itemTotal = item.totalPrice || (item.quantity * item.unitPrice) || 0;

                        return {
                            productName: item.productName || 'N/A',
                            quantity: item.quantity || 0,
                            unitPrice: item.unitPrice || 0,
                            totalPrice: itemTotal,
                            categoryName: item.categoryName || 'অন্যান্য',
                            type: 'return' as const,
                            reason: ret.reason,
                            returnNumber: ret.returnNumber
                        };
                    });

                    // Debug logging for Order 39
                    if (order.orderNumber === 'ORD-000039') {
                        console.log(`Processing return ${ret.returnNumber} with ${items.length} items:`, items);
                    }

                    return items;
                }
                // Legacy single-item return format
                else if (ret.productName || ret.quantity) {
                    const singleItem = {
                        productName: ret.productName || 'N/A',
                        quantity: ret.quantity || 0,
                        unitPrice: ret.unitPrice || 0,
                        totalPrice: ret.totalAmount || ret.totalPrice || (ret.quantity * ret.unitPrice) || 0,
                        categoryName: ret.product?.categoryName || 'অন্যান্য',
                        type: 'return' as const,
                        reason: ret.reason,
                        returnNumber: ret.returnNumber
                    };

                    if (order.orderNumber === 'ORD-000039') {
                        console.log(`Processing legacy return ${ret.returnNumber}:`, singleItem);
                    }

                    return [singleItem];
                }
                return [];
            });

            const returnQuantity = returnItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
            const returnAmount = returnItems.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0);

            // Debug logging for Order 39 totals
            if (order.orderNumber === 'ORD-000039') {
                console.log('Order 39 Summary:', {
                    orderQuantity,
                    orderAmount,
                    returnQuantity,
                    returnAmount,
                    returnItemsCount: returnItems.length,
                    netAmount: orderAmount - returnAmount
                });
            }

            return {
                orderId: order._id,
                orderNumber: order.orderNumber,
                customer: order.customer,
                orderDate: order.createdAt,
                items: [...orderItems, ...returnItems],
                orderQuantity,
                orderAmount,
                returnQuantity,
                returnAmount,
                netAmount: orderAmount - returnAmount,
                status: order.status,
                paymentMethod: order.paymentMethod
            };
        });

        // Add standalone returns (not linked to any order) as separate entries
        const standaloneReturns = returns.filter((ret: any) => !linkedReturnIds.has(ret._id));

        standaloneReturns.forEach((ret: any) => {
            let returnItems: any[] = [];

            // Process return items
            if (ret.items && Array.isArray(ret.items) && ret.items.length > 0) {
                returnItems = ret.items.map((item: any) => ({
                    productName: item.productName || 'N/A',
                    quantity: item.quantity || 0,
                    unitPrice: item.unitPrice || 0,
                    totalPrice: item.totalPrice || 0,
                    categoryName: item.categoryName || 'অন্যান্য',
                    type: 'return' as const,
                    reason: ret.reason,
                    returnNumber: ret.returnNumber
                }));
            } else if (ret.productName || ret.quantity) {
                returnItems = [{
                    productName: ret.productName || 'N/A',
                    quantity: ret.quantity || 0,
                    unitPrice: ret.unitPrice || 0,
                    totalPrice: ret.totalAmount || ret.totalPrice || 0,
                    categoryName: ret.product?.categoryName || 'অন্যান্য',
                    type: 'return' as const,
                    reason: ret.reason,
                    returnNumber: ret.returnNumber
                }];
            }

            if (returnItems.length > 0) {
                const returnQuantity = returnItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
                const returnAmount = returnItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

                sales.push({
                    orderId: ret._id,
                    orderNumber: ret.returnNumber || `RET-${ret._id.slice(-6)}`,
                    customer: ret.customer,
                    orderDate: ret.createdAt,
                    items: returnItems,
                    orderQuantity: 0,
                    orderAmount: 0,
                    returnQuantity,
                    returnAmount,
                    netAmount: -returnAmount,
                    status: 'completed',
                    paymentMethod: undefined
                });
            }
        });

        return sales;
    }, [orders, returns]);

    // Calculate daily summary from orderWiseSales
    const dailySummary: DailySummary = useMemo(() => {
        // Calculate from all orders for today
        const totalAmount = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

        // Calculate return totals from all returns linked to today's orders
        const returnAmount = returns.reduce((sum, ret) => {
            if (ret.items && Array.isArray(ret.items) && ret.items.length > 0) {
                const retTotal = ret.items.reduce((itemSum: number, item: any) =>
                    itemSum + (item.totalPrice || (item.quantity * item.unitPrice) || 0), 0
                );
                return sum + retTotal;
            }
            return sum + (ret.totalAmount || ((ret.quantity ?? 0) * (ret.unitPrice ?? 0)) || 0);
        }, 0);

        return {
            totalOrders: orders.length,
            totalAmount,
            totalReturns: returns.length,
            returnAmount,
            netAmount: totalAmount - returnAmount
        };
    }, [orders, returns]);

    // Report content for PDF/Print - memoized to avoid recreating on every render
    // Must be called before early returns per React hooks rules
    const reportContent = useMemo(() => {
        return (
            <div style={{ fontFamily: 'Arial, sans-serif', padding: '10px', maxWidth: '800px', margin: '0 auto', color: '#000', fontSize: '9px' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px solid #000', paddingBottom: '8px', backgroundColor: '#ffffff' }}>
                    <div style={{
                        display: 'inline-block',
                        backgroundColor: '#ffffff',
                        padding: '5px',
                        borderRadius: '4px',
                        marginBottom: '5px'
                    }}>
                        <img
                            src={kabirLogo}
                            alt="Kabir Store Logo"
                            style={{
                                maxWidth: '80px',
                                height: 'auto',
                                display: 'block',
                                backgroundColor: '#ffffff'
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px' }}>Today's Orders Report</div>
                    <div style={{ fontSize: '10px', marginBottom: '2px' }}>Daily Report</div>
                    <div style={{ fontSize: '9px', color: '#666' }}>Generated on: {dayjs(selectedDate).format('DD/MM/YYYY')}</div>
                </div>

                {/* Order-wise Sales */}
                {orderWiseSales.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                        <h2 style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '2px' }}>
                            Daily Sale Report
                        </h2>
                        {orderWiseSales.map((order) => (
                            <div key={order.orderId} style={{ marginBottom: '8px', pageBreakInside: 'avoid' }}>
                                <h3 style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
                                    Order: {order.orderNumber} | Customer: {order.customer?.name || 'N/A'} | Date: {dayjs(order.orderDate).format('DD MMM YYYY')}
                                </h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6px', border: '1px solid #ddd', fontSize: '8px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #000' }}>
                                            <th style={{ padding: '3px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>Product Name</th>
                                            <th style={{ padding: '3px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>Qty</th>
                                            <th style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>Unit Price</th>
                                            <th style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>Total</th>
                                            <th style={{ padding: '3px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>Type</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.items.map((item, index) => {
                                            const isReturn = item.type === 'return';
                                            return (
                                                <tr key={`${item.productName}-${index}-${item.type}`} style={{ borderBottom: '1px solid #ddd' }}>
                                                    <td style={{ padding: '3px', border: '1px solid #ddd', fontSize: '8px' }}>{item.productName || 'N/A'}</td>
                                                    <td style={{ padding: '3px', textAlign: 'center', border: '1px solid #ddd', fontSize: '8px' }}>{item.quantity || 0}</td>
                                                    <td style={{ padding: '3px', textAlign: 'right', border: '1px solid #ddd', fontSize: '8px' }}>৳{(item.unitPrice || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '3px', textAlign: 'right', border: '1px solid #ddd', fontSize: '8px' }}>
                                                        {isReturn ? '-' : ''}৳{(item.totalPrice || 0).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '3px', textAlign: 'center', border: '1px solid #ddd', fontSize: '8px' }}>
                                                        {isReturn ? 'RET' : 'ORD'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#f9f9f9', borderTop: '1px solid #000' }}>
                                            <td style={{ padding: '3px', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>Order Summary</td>
                                            <td style={{ padding: '3px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>
                                                <div>Ord: {order.orderQuantity || 0}</div>
                                                {order.returnQuantity > 0 && <div style={{ fontSize: '7px', color: '#d97706' }}>Ret: {order.returnQuantity}</div>}
                                            </td>
                                            <td style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>-</td>
                                            <td style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd', fontSize: '8px' }}>
                                                <div style={{ fontSize: '8px' }}>Ord: ৳{(order.orderAmount || 0).toLocaleString()}</div>
                                                {order.returnAmount > 0 && <div style={{ fontSize: '7px', color: '#d97706' }}>Ret: -৳{order.returnAmount.toLocaleString()}</div>}
                                                <div style={{ marginTop: '2px', paddingTop: '2px', borderTop: '1px solid #ccc', fontWeight: 'bold', fontSize: '8px' }}>
                                                    Net: ৳{order.netAmount.toLocaleString()}
                                                </div>
                                            </td>
                                            <td style={{ padding: '3px', textAlign: 'center', border: '1px solid #ddd', fontSize: '8px' }}>-</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ))}
                    </div>
                )}

                {/* Grand Total */}
                {orderWiseSales.length > 0 && (
                    <div style={{ marginBottom: '8px', padding: '6px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
                        <h3 style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>Grand Total</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '3px', fontWeight: 'bold', fontSize: '8px' }}>Total Orders</td>
                                    <td style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold', fontSize: '8px' }}>
                                        ৳{orderWiseSales.reduce((sum, order) => sum + order.orderAmount, 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '3px', color: '#d97706', fontSize: '8px' }}>Total Returns</td>
                                    <td style={{ padding: '3px', textAlign: 'right', color: '#d97706', fontSize: '8px' }}>
                                        -৳{orderWiseSales.reduce((sum, order) => sum + order.returnAmount, 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr style={{ borderTop: '1px solid #000' }}>
                                    <td style={{ padding: '3px', fontWeight: 'bold', fontSize: '9px' }}>Net Total</td>
                                    <td style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold', fontSize: '9px' }}>
                                        ৳{dailySummary.netAmount.toLocaleString()}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: '8px', paddingTop: '4px', borderTop: '1px solid #ccc', textAlign: 'center', fontSize: '7px', color: '#666' }}>
                    Powered by : Bytespate Limited
                </div>
            </div>
        );
    }, [selectedDate, orderWiseSales, dailySummary]);

    // Print Handler using react-to-print
    const handlePrint = useReactToPrint({
        contentRef: reportRef,
        documentTitle: `Todays_Orders_${dayjs(selectedDate).format('YYYY-MM-DD')}`,
    });

    const handleExport = () => {
        const headers = ['Order Number', 'Customer', 'Date', 'Product Name', 'Quantity', 'Unit Price (৳)', 'Total Price (৳)', 'Type'];
        const rows: (string | number)[][] = [];

        orderWiseSales.forEach(order => {
            order.items.forEach(item => {
                rows.push([
                    order.orderNumber,
                    order.customer?.name || 'N/A',
                    dayjs(order.orderDate).format('DD/MM/YYYY'),
                    item.productName,
                    item.quantity,
                    item.unitPrice,
                    item.totalPrice,
                    item.type.toUpperCase()
                ]);
            });
            rows.push([
                order.orderNumber,
                'ORDER TOTAL',
                '-',
                '-',
                order.orderQuantity,
                '-',
                order.orderAmount,
                'ORD'
            ]);
            if (order.returnAmount > 0) {
                rows.push([
                    order.orderNumber,
                    'RETURNS',
                    '-',
                    '-',
                    order.returnQuantity,
                    '-',
                    -order.returnAmount,
                    'RET'
                ]);
            }
            rows.push([
                order.orderNumber,
                'NET TOTAL',
                '-',
                '-',
                '',
                '-',
                order.netAmount,
                'NET'
            ]);
            rows.push([]);
        });

        const summaryRows = [
            ['SUMMARY'],
            ['Total Orders', dailySummary.totalOrders, '', '', '', '', dailySummary.totalAmount],
            ['Total Returns', dailySummary.totalReturns, '', '', '', '', -dailySummary.returnAmount],
            ['Net Amount', '', '', '', '', '', dailySummary.netAmount]
        ];

        const wsData = [
            [`Today's Orders Report - ${dayjs(selectedDate).format('DD/MM/YYYY')}`],
            [],
            headers,
            ...rows,
            [],
            ...summaryRows
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
        XLSX.writeFile(wb, `Daily_Report_${selectedDate}.xlsx`);
    };

    if (ordersLoading || returnsLoading) {
        return <Loader fullScreen message="Loading today's orders..." />;
    }

    if (ordersError) {
        return <ErrorState description="Unable to load today's orders" />;
    }

    return (
        <div className="space-y-8 print:space-y-4">
            {/* Hidden report content for PDF/Print */}
            <div ref={reportRef} style={{ display: 'none' }}>
                {reportContent}
            </div>
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:flex-row">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand print:text-black">
                        Daily Report
                    </p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900 print:text-2xl">
                        Today's Orders
                    </h1>
                    <p className="text-sm text-slate-500 print:text-black">
                        {dayjs(selectedDate).format('dddd, MMMM DD, YYYY')}
                    </p>
                </div>
                <div className="flex gap-3 print:hidden">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                        <PrinterIcon className="h-4 w-4" />
                        Print
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-3 print:gap-2">
                {[
                    {
                        label: 'Total Orders',
                        value: dailySummary.totalOrders,
                        delta: '+0%',
                        color: 'blue',
                        icon: '📊',
                        subtitle: `৳${dailySummary.totalAmount.toLocaleString()}`
                    },
                    {
                        label: 'Returns',
                        value: dailySummary.totalReturns,
                        delta: '-0%',
                        color: 'orange',
                        icon: '↩️',
                        subtitle: `৳${dailySummary.returnAmount.toLocaleString()}`
                    },
                    {
                        label: 'Net Amount',
                        value: `৳${dailySummary.netAmount.toLocaleString()}`,
                        delta: '+0%',
                        color: 'green',
                        icon: '💰',
                        subtitle: 'After returns'
                    },
                ].map((card) => (
                    <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-linear-to-br from-white/95 to-slate-50/95 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 print:shadow-none print:border-slate-300 print:p-2">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{card.icon}</span>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 print:text-black">{card.label}</p>
                                </div>
                                <p className={`text-2xl font-bold ${card.color === 'green' ? 'text-green-600' :
                                    card.color === 'orange' ? 'text-orange-600' :
                                        card.color === 'red' ? 'text-red-600' :
                                            'text-blue-600'
                                    } group-hover:scale-105 transition-transform duration-300 print:text-black print:text-sm`}>
                                    {card.value}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-slate-400 mt-1 print:text-[7px] print:text-black">{card.subtitle}</p>
                            </div>
                            <div className={`rounded-full p-2 ${card.color === 'green' ? 'bg-green-100' :
                                card.color === 'orange' ? 'bg-orange-100' :
                                    card.color === 'red' ? 'bg-red-100' :
                                        'bg-blue-100'
                                } opacity-60 group-hover:opacity-100 transition-opacity duration-300 print:bg-gray-100 print:p-1`}>
                                <div className={`h-2 w-2 rounded-full ${card.color === 'green' ? 'bg-green-500' :
                                    card.color === 'orange' ? 'bg-orange-500' :
                                        card.color === 'red' ? 'bg-red-500' :
                                            'bg-blue-500'
                                    } print:bg-black`}></div>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center print:hidden">
                            <span className={`text-xs font-semibold ${card.delta.startsWith('+') ? 'text-emerald-600' : 'text-red-500'
                                }`}>
                                {card.delta}
                            </span>
                            <span className="ml-1 text-xs text-slate-400">vs last period</span>
                        </div>
                        {/* Subtle gradient overlay */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 print:hidden ${card.color === 'green' ? 'bg-green-500' :
                            card.color === 'orange' ? 'bg-orange-500' :
                                card.color === 'red' ? 'bg-red-500' :
                                    'bg-blue-500'
                            }`}></div>
                    </div>
                ))}
            </section>

            {/* Order-wise Sales */}
            <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-card print:shadow-none print:border-slate-300 print:p-2">
                <h2 className="text-lg font-bold text-slate-900 mb-4 print:text-xs print:mb-2">Daily Sale Report</h2>

                {orderWiseSales.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                        {orders.length > 0 ? (
                            <div>
                                <p className="font-semibold text-slate-700 mb-2">Found {orders.length} orders but no category information available.</p>
                                <p className="text-xs mt-2 mb-4">This might be due to missing category data in order items. Showing uncategorized orders:</p>
                                {/* Show orders without categories as a table */}
                                <div className="mt-4 overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Order #</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Items</th>
                                                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {orders.map(order => (
                                                <tr key={order._id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                                                    <td className="px-4 py-3">
                                                        {order.items?.map((item: any, idx: number) => (
                                                            <div key={idx} className="text-sm">
                                                                {item.productName} (Qty: {item.quantity}) - ৳{item.totalPrice?.toLocaleString()}
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold">
                                                        ৳{order.totalAmount?.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs mt-4 text-orange-600">
                                    Note: New orders will include category information. Existing orders may need to be updated.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-lg font-semibold">No orders found for {dayjs(selectedDate).format('DD/MM/YYYY')}</p>
                                <p className="text-sm mt-2">Try selecting a different date or create a new order.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 print:space-y-2">
                        {orderWiseSales.map((order) => (
                            <div key={order.orderId} className="border-b border-slate-200 last:border-0 pb-3 last:pb-0 print:pb-1 print:page-break-inside-avoid">
                                {/* Order Header */}
                                <div className="mb-2 print:mb-1 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 print:text-[10px]">
                                            Order: {order.orderNumber}
                                        </h3>
                                        <div className="text-xs print:text-[8px] text-slate-600 print:text-black mt-0.5">
                                            Customer: {order.customer?.name || 'N/A'} | Date: {dayjs(order.orderDate).format('DD MMM YYYY')}
                                            {order.paymentMethod && ` | Payment: ${order.paymentMethod.replace('_', ' ')}`}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs print:text-[8px] text-slate-600 print:text-black">
                                        <span>Qty: <strong>{order.orderQuantity}</strong></span>
                                        <span>Ord: <strong className="text-slate-900">৳{order.orderAmount.toLocaleString()}</strong></span>
                                        {order.returnQuantity > 0 && (
                                            <span className="text-orange-600">Ret: <strong>-৳{order.returnAmount.toLocaleString()}</strong></span>
                                        )}
                                        <span className="font-bold text-green-600">
                                            Net: ৳{order.netAmount.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="overflow-x-auto border border-slate-200 rounded-lg print:border-slate-300">
                                    <table className="min-w-full divide-y divide-slate-200 text-xs print:text-[9px]">
                                        <thead className="bg-slate-50 print:bg-white">
                                            <tr>
                                                <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700 print:text-black border-b border-slate-200">
                                                    Product Name
                                                </th>
                                                <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700 print:text-black border-b border-slate-200">
                                                    Qty
                                                </th>
                                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700 print:text-black border-b border-slate-200">
                                                    Unit Price
                                                </th>
                                                <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700 print:text-black border-b border-slate-200">
                                                    Total
                                                </th>
                                                <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700 print:text-black border-b border-slate-200">
                                                    Type
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-200 print:bg-white">
                                            {order.items.length > 0 ? (
                                                order.items.map((item, index) => {
                                                    const isReturn = item.type === 'return';
                                                    const rowClass = isReturn
                                                        ? 'hover:bg-orange-50 bg-orange-50/30'
                                                        : 'hover:bg-slate-50';

                                                    return (
                                                        <tr key={`${item.productName}-${index}-${item.type}`} className={`${rowClass} print:hover:bg-transparent`}>
                                                            <td className="px-2 py-1.5 print:text-black font-medium text-xs print:text-[9px]">
                                                                <div className="flex items-center gap-1">
                                                                    {item.productName || 'N/A'}
                                                                    {isReturn && (
                                                                        <span className="text-[8px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold print:text-[7px]">
                                                                            RET
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center text-slate-700 print:text-black text-xs print:text-[9px]">
                                                                {item.quantity || 0}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-right text-slate-700 print:text-black text-xs print:text-[9px]">
                                                                ৳{(item.unitPrice || 0).toLocaleString()}
                                                            </td>
                                                            <td className={`px-2 py-1.5 text-right font-semibold print:text-black text-xs print:text-[9px] ${isReturn ? 'text-orange-600' : 'text-slate-900'
                                                                }`}>
                                                                {isReturn ? '-' : ''}৳{(item.totalPrice || 0).toLocaleString()}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center text-[9px] text-slate-600 print:text-black">
                                                                {isReturn ? 'RET' : 'ORD'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-2 py-2 text-center text-slate-500 text-xs print:text-[9px]">
                                                        No items found in this order
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-slate-100 print:bg-white border-t-2 border-slate-300">
                                            <tr className="font-bold text-slate-900 print:text-black text-xs print:text-[9px]">
                                                <td className="px-2 py-1.5">
                                                    {order.returnQuantity > 0 ? 'Order & Return Summary' : 'Order Summary'}
                                                </td>
                                                <td className="px-2 py-1.5 text-center">
                                                    <div className="text-xs print:text-[9px]">
                                                        <span className={order.orderQuantity > 0 ? '' : 'text-slate-400'}>
                                                            Ord: {order.orderQuantity || 0}
                                                        </span>
                                                    </div>
                                                    {order.returnQuantity > 0 ? (
                                                        <span className="block text-[9px] print:text-[8px] text-orange-600 font-semibold">
                                                            Ret: {order.returnQuantity}
                                                        </span>
                                                    ) : (
                                                        <span className="block text-[9px] print:text-[8px] text-slate-400">Ret: 0</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 text-right">-</td>
                                                <td className="px-2 py-1.5 text-right">
                                                    <div className="space-y-0.5">
                                                        <div className={`text-xs print:text-[9px] ${order.orderAmount > 0 ? '' : 'text-slate-400'}`}>
                                                            Ord: ৳{(order.orderAmount || 0).toLocaleString()}
                                                        </div>
                                                        {order.returnAmount > 0 ? (
                                                            <div className="text-orange-600 text-[9px] print:text-[8px] font-semibold">
                                                                Ret: -৳{order.returnAmount.toLocaleString()}
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-400 text-[9px] print:text-[8px]">Ret: -৳0</div>
                                                        )}
                                                        <div className={`border-t pt-0.5 mt-0.5 text-xs print:text-[9px] font-bold ${order.netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                            Net: ৳{order.netAmount.toLocaleString()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-center text-xs">-</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ))}

                        {/* Grand Total */}
                        <div className="mt-3 print:mt-1 border-t-2 border-slate-300 pt-2 print:pt-1">
                            <div className="flex justify-end">
                                <div className="text-right space-y-1 print:space-y-0.5">
                                    <div className="text-xs print:text-[8px] text-slate-600 print:text-black mb-0.5">Grand Total</div>
                                    <div className="space-y-0.5">
                                        <div className="text-sm print:text-[9px] font-semibold text-slate-900 print:text-black">
                                            Orders: ৳{orderWiseSales.reduce((sum, order) => sum + order.orderAmount, 0).toLocaleString()}
                                        </div>
                                        <div className="text-sm print:text-[9px] font-semibold text-orange-600 print:text-black">
                                            Returns: -৳{orderWiseSales.reduce((sum, order) => sum + order.returnAmount, 0).toLocaleString()}
                                        </div>
                                        <div className="text-base print:text-[10px] font-bold text-green-600 print:text-black border-t border-slate-300 pt-1 mt-1 print:pt-0.5 print:mt-0.5">
                                            Net Total: ৳{orderWiseSales.reduce((sum, order) => sum + order.netAmount, 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-[10px] print:text-[7px] text-slate-500 print:text-black mt-1">
                                        {orderWiseSales.reduce((sum, order) => sum + order.orderQuantity, 0)} items from {dailySummary.totalOrders} orders
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Returns Summary */}
            <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-card print:shadow-none print:border-slate-300 print:p-2 print:hidden">
                <h3 className="text-base font-bold text-slate-900 mb-3 print:text-[10px]">Returns Summary</h3>
                {returns.length === 0 ? (
                    <p className="text-xs print:text-[8px] text-slate-500 print:text-black">No returns today</p>
                ) : (
                    <div className="space-y-2 print:space-y-1">
                        {returns.flatMap((ret: any) =>
                            (ret.items && Array.isArray(ret.items) && ret.items.length > 0
                                ? ret.items.map((item: any, idx: number) => {
                                      const itemTotal = item.totalPrice ?? (item.quantity * item.unitPrice);
                                      return (
                                          <div
                                              key={`${ret._id}-${idx}`}
                                              className="flex justify-between items-center py-1.5 print:py-0.5 border-b border-slate-100 last:border-0"
                                          >
                                              <div>
                                                  <p className="text-xs print:text-[8px] font-semibold text-slate-900 print:text-black">
                                                      {item.productName || 'N/A'}
                                                  </p>
                                                  <p className="text-[10px] print:text-[7px] text-slate-500 print:text-black">
                                                      Qty: {item.quantity ?? 0}
                                                      {ret.returnNumber ? ` · ${ret.returnNumber}` : ''}
                                                  </p>
                                              </div>
                                              <p className="text-xs print:text-[8px] font-semibold text-orange-600 print:text-black">
                                                  ৳{itemTotal.toLocaleString()}
                                              </p>
                                          </div>
                                      );
                                  })
                                : [
                                      <div
                                          key={ret._id}
                                          className="flex justify-between items-center py-1.5 print:py-0.5 border-b border-slate-100 last:border-0"
                                      >
                                          <div>
                                              <p className="text-xs print:text-[8px] font-semibold text-slate-900 print:text-black">
                                                  {ret.productName || ret.returnNumber || 'Return'}
                                              </p>
                                              <p className="text-[10px] print:text-[7px] text-slate-500 print:text-black">
                                                  Qty: {ret.quantity ?? 0} · {ret.returnNumber || ''}
                                              </p>
                                          </div>
                                          <p className="text-xs print:text-[8px] font-semibold text-orange-600 print:text-black">
                                              ৳{(ret.totalAmount || 0).toLocaleString()}
                                          </p>
                                      </div>
                                  ]
                            )
                        )}
                        <div className="pt-2 print:pt-1 border-t-2 border-slate-200">
                            <div className="flex justify-between items-center text-xs print:text-[9px] font-bold text-slate-900 print:text-black">
                                <span>Total Returns</span>
                                <span>৳{dailySummary.returnAmount.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Final Summary */}
            <div className="rounded-2xl border border-white/70 bg-linear-to-r from-blue-50 to-indigo-50 p-4 shadow-card print:shadow-none print:border-slate-300 print:bg-white print:p-2">
                <h3 className="text-base font-bold text-slate-900 mb-3 print:text-[10px] print:mb-1">Daily Summary</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-1">
                    <div className="text-center">
                        <p className="text-xs print:text-[8px] text-slate-600 print:text-black">Gross Sales</p>
                        <p className="text-lg print:text-[9px] font-bold text-slate-900 print:text-black">৳{dailySummary.totalAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs print:text-[8px] text-slate-600 print:text-black">Returns</p>
                        <p className="text-lg print:text-[9px] font-bold text-orange-600 print:text-black">-৳{dailySummary.returnAmount.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs print:text-[8px] text-slate-600 print:text-black">Net Sales</p>
                        <p className="text-xl print:text-[10px] font-bold text-green-600 print:text-black">৳{dailySummary.netAmount.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    .no-print {
                        display: none !important;
                    }
                    div[style*="display: none"] {
                        display: block !important;
                    }
                    * {
                        font-size: 9px !important;
                    }
                    h1, h2, h3 {
                        font-size: 10px !important;
                        margin-bottom: 4px !important;
                    }
                    table {
                        font-size: 8px !important;
                    }
                    th, td {
                        padding: 2px 4px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default TodaysOrdersPage;
