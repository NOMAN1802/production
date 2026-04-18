/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { useGetOrderByIdQuery } from '@/services/ordersApi';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import dayjs from 'dayjs';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useGetReturnsQuery } from '@/services/returnsApi';
import { useGetDamagesQuery } from '@/services/damagesApi';
import { useGetRefundsQuery } from '@/services/refundsApi';
import kabirLogo from '@/assets/kabirLogo.png';

interface InvoiceModalProps {
    orderId: string;
    onClose: () => void;
}

const InvoiceModal = ({ orderId, onClose }: InvoiceModalProps) => {
    const { data: order, isLoading, isError } = useGetOrderByIdQuery(orderId);
    const printRef = useRef<HTMLDivElement>(null);
    
    // Fetch returns and damages for this order
    // Fetch all returns and damages, then filter by orderId client-side
    const { data: returnsData } = useGetReturnsQuery({ 
        search: '',
        limit: 10000 
    }, { skip: !order });
    const { data: damagesData } = useGetDamagesQuery({ 
        search: '',
        limit: 10000 
    }, { skip: !order });
    const { data: refundsData } = useGetRefundsQuery({ 
        limit: 10000 
    }, { skip: !order });

    // Calculate returns, damages, refunds per item and totals
    const { itemReturns, totalReturnAmount, totalDamageAmount, totalRefundAmount, originalAmount, grandTotal, netPaidAmount, dueAmount, refundableAmount } = useMemo(() => {
        if (!order) {
            return { 
                itemReturns: {}, 
                totalReturnAmount: 0, 
                totalDamageAmount: 0, 
                totalRefundAmount: 0,
                originalAmount: 0,
                grandTotal: 0,
                netPaidAmount: 0,
                dueAmount: 0,
                refundableAmount: 0
            };
        }

        const returns = returnsData?.returns || [];
        const damages = damagesData?.damages || [];
        const refunds = refundsData?.refunds || [];
        
        const itemReturnsMap: Record<number, { quantity: number; amount: number }> = {};
        
        let totalReturn = 0;
        let totalDamage = 0;
        let totalRefund = 0;

        // Process returns - check orderId, order (as string), or orderNumber
        returns.forEach((ret: any) => {
            const matchesOrder = ret.orderId === order._id || 
                                ret.order === order._id || 
                                (typeof ret.order === 'object' && ret.order?._id === order._id) ||
                                ret.orderNumber === order.orderNumber;
            
            if (matchesOrder) {
                // Handle new structure with items array
                if (ret.items && Array.isArray(ret.items) && ret.items.length > 0) {
                    ret.items.forEach((item: any) => {
                        const index = item.orderItemIndex !== undefined ? item.orderItemIndex : 0;
                        if (!itemReturnsMap[index]) {
                            itemReturnsMap[index] = { quantity: 0, amount: 0 };
                        }
                        itemReturnsMap[index].quantity += item.quantity || 0;
                        itemReturnsMap[index].amount += item.totalPrice || 0;
                        totalReturn += item.totalPrice || 0;
                    });
                } else if (ret.orderItemIndex !== undefined) {
                    // Handle legacy structure with direct orderItemIndex
                    const index = ret.orderItemIndex;
                    if (!itemReturnsMap[index]) {
                        itemReturnsMap[index] = { quantity: 0, amount: 0 };
                    }
                    itemReturnsMap[index].quantity += ret.quantity || 0;
                    itemReturnsMap[index].amount += ret.totalAmount || 0;
                    totalReturn += ret.totalAmount || 0;
                }
            }
        });

        // Process damages - check orderId, order (as string), or orderNumber
        damages.forEach((damage: any) => {
            const matchesOrder = damage.orderId === order._id || 
                                damage.order === order._id || 
                                (typeof damage.order === 'object' && damage.order?._id === order._id) ||
                                damage.orderNumber === order.orderNumber;
            
            if (matchesOrder && damage.orderItemIndex !== undefined) {
                totalDamage += damage.totalLoss || 0;
            }
        });

        // Process refunds - check orderId, order (as string), or orderNumber
        refunds.forEach((refund: any) => {
            const matchesOrder = refund.orderId === order._id || 
                                refund.order === order._id || 
                                (typeof refund.order === 'object' && refund.order?._id === order._id) ||
                                refund.orderNumber === order.orderNumber;
            
            if (matchesOrder) {
                totalRefund += refund.amount || 0;
            }
        });

        // Original Amount = Total Amount (before returns/damages)
        const originalAmount = order.totalAmount;
        
        // Grand Total = Original Amount - Returns - Damages
        const grandTotal = originalAmount - totalReturn - totalDamage;
        
        // Actual Paid Amount (considering status)
        const actualPaidAmount = order.status === 'completed' ? grandTotal : (order.paidAmount || 0);
        
        // Net Paid Amount = Paid Amount - Refunds
        const netPaidAmount = actualPaidAmount - totalRefund;
        
        // Due Amount = Grand Total - Net Paid Amount
        const dueAmount = grandTotal - netPaidAmount;
        
        // Refundable Amount = negative due amount (credit balance)
        const refundableAmount = dueAmount < 0 ? Math.abs(dueAmount) : 0;

        return {
            itemReturns: itemReturnsMap,
            totalReturnAmount: totalReturn,
            totalDamageAmount: totalDamage,
            totalRefundAmount: totalRefund,
            originalAmount,
            grandTotal,
            netPaidAmount,
            dueAmount,
            refundableAmount
        };
    }, [order, returnsData, damagesData, refundsData]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Invoice_${order?.orderNumber || 'Document'}`,
    });

    // Handle escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-2xl h-[90vh] flex items-center justify-center">
                    <Loader message="Loading invoice..." />
                </div>
            </div>
        );
    }

    if (isError || !order) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                    <ErrorState description="Invoice not found" />
                    <button
                        onClick={onClose}
                        className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-900">
                        Invoice Details
                        <span className="ml-3 text-sm font-normal text-slate-500">#{order.orderNumber}</span>
                    </h3>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handlePrint()}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand/10 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/20 transition-colors"
                        >
                            <PrinterIcon className="h-5 w-5" />
                            Print Invoice
                        </button>
                        <button
                            onClick={onClose}
                            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                    <div className="mx-auto max-w-3xl bg-white shadow-sm p-8" ref={printRef}>
                        {/* Invoice Content (Same as PrintInvoicePage) */}
                        <div className="border-b-2 border-slate-900 pb-6 mb-6">
                            <div className="flex justify-between items-start">
                                <div className="text-sm">
                                    <img 
                                        src={kabirLogo} 
                                        alt="Kabir Store Logo" 
                                        className="h-12 w-auto mb-2"
                                    />
                                    <h1 className="text-2xl font-bold text-slate-900">INVOICE</h1>
                                    <p className="text-sm text-slate-600 mt-1">Kabir Store</p>
                                    <p className="text-xs text-slate-500">Inventory Management System</p>
                                </div>
                                <div className="text-right text-sm">
                                    <p className="text-lg font-bold text-brand">{order.orderNumber}</p>
                                    <p className="text-xs text-slate-600 mt-1">
                                        Date: {dayjs(order.createdAt).format('DD MMM YYYY')}
                                    </p>
                                    {/* Bill To */}
                                    <div className="mt-2 pt-2 border-t border-slate-200">
                                        <p className="text-[10px] font-bold text-slate-900 uppercase tracking-wide mb-1">
                                            Bill To:
                                        </p>
                                        <div className="text-slate-700 text-[10px]">
                                            <p className="font-semibold">{order.customer?.name ?? 'Walk-in'}</p>
                                            {order.customer?.phone && <p className="mt-0.5">Phone: {order.customer.phone}</p>}
                                            {order.customer?.email && <p className="mt-0.5">Email: {order.customer.email}</p>}
                                            {order.customer?.address && <p className="mt-0.5">Address: {order.customer.address}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <table className="w-full mb-6 text-xs">
                            <thead>
                                <tr className="border-b-2 border-slate-900">
                                    <th className="text-left py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">
                                        Item
                                    </th>
                                    <th className="text-center py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">
                                        Quantity
                                    </th>
                                    <th className="text-right py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">
                                        Unit Price
                                    </th>
                                    <th className="text-right py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">
                                        Total
                                    </th>
                                    <th className="text-center py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">
                                        Return
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, index) => {
                                    const returnInfo = itemReturns[index] || { quantity: 0, amount: 0 };
                                    return (
                                        <tr key={index} className="border-b border-slate-200">
                                            <td className="py-2 px-1.5 text-slate-800">{item.productName}</td>
                                            <td className="py-2 px-1.5 text-center text-slate-700">{item.quantity}</td>
                                            <td className="py-2 px-1.5 text-right text-slate-700">
                                                ৳{item.unitPrice.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-1.5 text-right font-semibold text-slate-900">
                                                ৳{item.totalPrice.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-1.5 text-center text-slate-700">
                                                {returnInfo.quantity > 0 ? (
                                                    <div className="text-[10px]">
                                                        <div className="text-orange-600 font-semibold">Qty: {returnInfo.quantity}</div>
                                                        <div className="text-orange-500">-৳{returnInfo.amount.toLocaleString()}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Totals - Complete Breakdown */}
                        <div className="flex justify-end mb-6">
                            <div className="w-64 text-xs">
                                {/* Original Amount */}
                                <div className="flex justify-between py-1.5 text-slate-700 border-b border-slate-200">
                                    <span className="font-medium">Original Amount:</span>
                                    <span className="font-semibold">৳{originalAmount.toLocaleString()}</span>
                                </div>
                                
                                {/* Tax */}
                                {(order.tax ?? 0) > 0 && (
                                    <div className="flex justify-between py-1.5 text-slate-700">
                                        <span>Tax:</span>
                                        <span className="font-semibold">+৳{(order.tax ?? 0).toLocaleString()}</span>
                                    </div>
                                )}
                                
                                {/* Additional Charges */}
                                {(order.additionalCharges ?? 0) > 0 && (
                                    <div className="flex justify-between py-1.5 text-slate-700">
                                        <span>Additional Charges:</span>
                                        <span className="font-semibold">+৳{(order.additionalCharges ?? 0).toLocaleString()}</span>
                                    </div>
                                )}
                                
                                {/* Discount */}
                                {(order.discount ?? 0) > 0 && (
                                    <div className="flex justify-between py-1.5 text-slate-700">
                                        <span>Discount:</span>
                                        <span className="font-semibold text-orange-600">
                                            -৳{(order.discount ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Returns */}
                                {totalReturnAmount > 0 && (
                                    <div className="flex justify-between py-1.5 text-slate-700">
                                        <span>Total Returns:</span>
                                        <span className="font-semibold text-orange-600">
                                            -৳{totalReturnAmount.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Damages */}
                                {totalDamageAmount > 0 && (
                                    <div className="flex justify-between py-1.5 text-slate-700">
                                        <span>Total Damages:</span>
                                        <span className="font-semibold text-red-600">
                                            -৳{totalDamageAmount.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Grand Total */}
                                <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold">
                                    <span>GRAND TOTAL:</span>
                                    <span className="text-brand">৳{grandTotal.toLocaleString()}</span>
                                </div>

                                {/* Payment Status */}
                                <div className="border-t border-slate-200 pt-2 mt-2 space-y-1.5">
                                    <div className="flex justify-between text-slate-700">
                                        <span className="font-medium">Paid Amount:</span>
                                        <span className={
                                            order.status === 'completed' ? 'font-semibold text-emerald-600' :
                                                order.status === 'partial' ? 'font-semibold text-blue-600' :
                                                    'text-slate-500'
                                        }>
                                            ৳{(order.status === 'completed' ? grandTotal : (order.paidAmount ?? 0)).toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    {/* Refunds Already Made */}
                                    {totalRefundAmount > 0 && (
                                        <div className="flex justify-between text-slate-700">
                                            <span className="font-medium">Refunds Made:</span>
                                            <span className="font-semibold text-blue-600">
                                                -৳{totalRefundAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Net Paid Amount */}
                                    <div className="flex justify-between text-slate-700 border-t border-slate-200 pt-2">
                                        <span className="font-medium">Net Paid Amount:</span>
                                        <span className="font-semibold text-slate-900">
                                            ৳{netPaidAmount.toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    {/* Due Amount or Refundable */}
                                    {dueAmount > 0 ? (
                                        <div className="flex justify-between text-slate-700">
                                            <span className="font-medium">Due Amount:</span>
                                            <span className="font-semibold text-red-600">
                                                ৳{dueAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    ) : refundableAmount > 0 ? (
                                        <div className="flex justify-between text-slate-700">
                                            <span className="font-medium">Refundable:</span>
                                            <span className="font-semibold text-blue-600">
                                                ৳{refundableAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between text-slate-700">
                                            <span className="font-medium">Due Amount:</span>
                                            <span className="font-semibold text-emerald-600">
                                                ৳0
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Status */}
                                    <div className="flex justify-between text-slate-700 mt-2 pt-1.5 border-t border-slate-200">
                                        <span className="font-medium">Status:</span>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                            order.status === 'partial' ? 'bg-blue-100 text-blue-800' :
                                                'bg-amber-100 text-amber-800'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment & Notes */}
                        <div className="border-t border-slate-200 pt-4 mb-6 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                {order.paymentMethod && (
                                    <div>
                                        <h3 className="text-[10px] font-bold text-slate-900 uppercase mb-1">
                                            Payment Method
                                        </h3>
                                        <p className="text-slate-700 capitalize">{order.paymentMethod.replace('_', ' ')}</p>
                                    </div>
                                )}
                                {order.notes && (
                                    <div>
                                        <h3 className="text-[10px] font-bold text-slate-900 uppercase mb-1">Notes</h3>
                                        <p className="text-slate-700">{order.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500">
                            <p>Thank you for your business!</p>
                            <p className="mt-1">Powered by: Bytespate Limited</p>
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
                            margin: 1cm;
                        }
                    }
                `}</style>
            </div>

        </div>
    );
};

export default InvoiceModal;

