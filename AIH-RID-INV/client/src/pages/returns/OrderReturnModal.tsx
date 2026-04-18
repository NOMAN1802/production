import { useRef } from 'react';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import Loader from '@/components/common/Loader';
import { useGetReturnsQuery, type Return, type ReturnItem } from '@/services/returnsApi';
import kabirLogo from '@/assets/kabirLogo.png';

interface ExtendedReturnItem extends Omit<ReturnItem, 'product'> {
    product: string | {
        supplier?: {
            name?: string;
        };
    };
}

interface OrderReturnModalProps {
    orderNumber: string | null;
    onClose: () => void;
}

const OrderReturnModal = ({ orderNumber, onClose }: OrderReturnModalProps) => {
    const printRef = useRef<HTMLDivElement>(null);

    const {
        data: returnsData,
        isLoading: isReturnsLoading,
    } = useGetReturnsQuery(
        {
            search: orderNumber || '',
            limit: 100,
        },
        { skip: !orderNumber }
    );

    const returns = returnsData?.returns?.filter(
        (r) => r.orderNumber === orderNumber
    ) || [];

    // Calculate totals from items array
    const totalAmount = returns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    // Get customer info from first return
    const customer = returns[0]?.customer;
    const earliestDate = returns.length > 0
        ? returns.reduce((earliest, r) => {
            if (!r.createdAt) return earliest;
            if (!earliest) return r.createdAt;
            return dayjs(r.createdAt).isBefore(dayjs(earliest)) ? r.createdAt : earliest;
        }, returns[0].createdAt)
        : null;

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Return-Order-${orderNumber}`,
    });

    if (!orderNumber) return null;

    return (
        <>
            {/* Hidden printable content */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm' }}>
                <div ref={printRef} className="bg-white p-8" style={{ width: '210mm' }}>
                    {returns.length > 0 && (
                        <div className="max-w-4xl mx-auto">
                            {/* Header */}
                            <div className="border-b-2 border-slate-900 pb-3 mb-3 text-[10px]">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <img src={kabirLogo} alt="Kabir Store Logo" className="h-10 w-auto mb-1.5" />
                                        <h1 className="text-lg font-bold text-slate-900">RETURN INVOICE</h1>
                                        <p className="text-[10px] text-slate-600 mt-0.5">Kabir Store</p>
                                        <p className="text-[9px] text-slate-500">Inventory Management System</p>
                                    </div>
                                    <div className="text-right text-[10px]">
                                        <p className="text-base font-bold text-orange-600">{orderNumber}</p>
                                        <p className="text-[9px] text-slate-600 mt-0.5">Date: {earliestDate ? dayjs(earliestDate).format('DD MMM YYYY') : 'N/A'}</p>
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                            <p className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Return To:</p>
                                            <div className="text-slate-700 text-[9px]">
                                                <p className="font-semibold">{customer?.name || 'N/A'}</p>
                                                {customer?.phone && <p className="mt-0.5">Phone: {customer.phone}</p>}
                                                {customer?.email && <p className="mt-0.5">Email: {customer.email}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <table className="w-full mb-4 text-[10px]">
                                <thead>
                                    <tr className="border-b-2 border-slate-900">
                                        <th className="text-left py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Item</th>
                                        <th className="text-left py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Supplier</th>
                                        <th className="text-center py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Quantity</th>
                                        <th className="text-right py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Unit Price</th>
                                        <th className="text-right py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {returns.flatMap((returnItem: Return) => {
                                        const items: ExtendedReturnItem[] = returnItem.items && Array.isArray(returnItem.items) && returnItem.items.length > 0
                                            ? returnItem.items as ExtendedReturnItem[]
                                            : [{
                                                product: returnItem.product || '',
                                                productName: returnItem.productName || 'N/A',
                                                quantity: returnItem.quantity || 0,
                                                unitPrice: returnItem.unitPrice || 0,
                                                totalPrice: returnItem.totalAmount || 0,
                                                supplierName: (returnItem as Return & { supplierName?: string }).supplierName
                                            }];
                                        return items.map((item: ExtendedReturnItem, itemIndex: number) => {
                                            const supplierName = item.supplierName ||
                                                (typeof item.product === 'object' ? item.product?.supplier?.name : undefined) || 'N/A';
                                            return (
                                                <tr key={`${returnItem._id}-${itemIndex}`} className="border-b border-slate-200">
                                                    <td className="py-1.5 px-1 text-slate-800">{item.productName}</td>
                                                    <td className="py-1.5 px-1 text-slate-700">{supplierName}</td>
                                                    <td className="py-1.5 px-1 text-center text-slate-700">{item.quantity}</td>
                                                    <td className="py-1.5 px-1 text-right text-slate-700">৳{(item.unitPrice || 0).toLocaleString()}</td>
                                                    <td className="py-1.5 px-1 text-right font-semibold text-slate-900">৳{(item.totalPrice || 0).toLocaleString()}</td>
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>

                            <div className="flex justify-end mb-4">
                                <div className="w-48 text-[10px]">
                                    <div className="flex justify-between py-1 text-slate-700">
                                        <span>Subtotal:</span>
                                        <span className="font-semibold">৳{totalAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-t-2 border-slate-900 text-xs font-bold">
                                        <span>TOTAL:</span>
                                        <span className="text-orange-600">৳{totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-3 text-center text-[9px] text-slate-500">
                                <p>Thank you for your business!</p>
                                <p className="mt-0.5">Powered by: Bytespate Limited</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Visible Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50">
                        <h3 className="text-xl font-bold text-slate-900">
                            Return Invoice
                            <span className="ml-3 text-sm font-normal text-slate-500">#{orderNumber}</span>
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
                        {isReturnsLoading ? (
                            <div className="py-10 text-center">
                                <Loader message="Loading returns..." />
                            </div>
                        ) : returns.length > 0 ? (
                            <div className="mx-auto max-w-3xl bg-white shadow-sm p-6 text-[10px]">
                                <div className="border-b-2 border-slate-900 pb-3 mb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <img src={kabirLogo} alt="Kabir Store Logo" className="h-10 w-auto mb-1.5" />
                                            <h1 className="text-lg font-bold text-slate-900">RETURN INVOICE</h1>
                                            <p className="text-[10px] text-slate-600 mt-0.5">Kabir Store</p>
                                            <p className="text-[9px] text-slate-500">Inventory Management System</p>
                                        </div>
                                        <div className="text-right text-[10px]">
                                            <p className="text-base font-bold text-orange-600">{orderNumber}</p>
                                            <p className="text-[9px] text-slate-600 mt-0.5">Date: {earliestDate ? dayjs(earliestDate).format('DD MMM YYYY') : 'N/A'}</p>
                                            <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                                <p className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Return To:</p>
                                                <div className="text-slate-700 text-[9px]">
                                                    <p className="font-semibold">{customer?.name || 'N/A'}</p>
                                                    {customer?.phone && <p className="mt-0.5">Phone: {customer.phone}</p>}
                                                    {customer?.email && <p className="mt-0.5">Email: {customer.email}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <table className="w-full mb-4 text-[10px]">
                                    <thead>
                                        <tr className="border-b-2 border-slate-900">
                                            <th className="text-left py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Item</th>
                                            <th className="text-left py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Supplier</th>
                                            <th className="text-center py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Quantity</th>
                                            <th className="text-right py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Unit Price</th>
                                            <th className="text-right py-1.5 px-1 text-[9px] font-bold text-slate-900 uppercase">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returns.flatMap((returnItem: Return) => {
                                            const items: ExtendedReturnItem[] = returnItem.items && Array.isArray(returnItem.items) && returnItem.items.length > 0
                                                ? returnItem.items as ExtendedReturnItem[]
                                                : [{
                                                    product: returnItem.product || '',
                                                    productName: returnItem.productName || 'N/A',
                                                    quantity: returnItem.quantity || 0,
                                                    unitPrice: returnItem.unitPrice || 0,
                                                    totalPrice: returnItem.totalAmount || 0,
                                                    supplierName: (returnItem as Return & { supplierName?: string }).supplierName
                                                }];
                                            return items.map((item: ExtendedReturnItem, itemIndex: number) => {
                                                const supplierName = item.supplierName ||
                                                    (typeof item.product === 'object' ? item.product?.supplier?.name : undefined) || 'N/A';
                                                return (
                                                    <tr key={`${returnItem._id}-${itemIndex}`} className="border-b border-slate-200">
                                                        <td className="py-1.5 px-1 text-slate-800">{item.productName}</td>
                                                        <td className="py-1.5 px-1 text-slate-700">{supplierName}</td>
                                                        <td className="py-1.5 px-1 text-center text-slate-700">{item.quantity}</td>
                                                        <td className="py-1.5 px-1 text-right text-slate-700">৳{(item.unitPrice || 0).toLocaleString()}</td>
                                                        <td className="py-1.5 px-1 text-right font-semibold text-slate-900">৳{(item.totalPrice || 0).toLocaleString()}</td>
                                                    </tr>
                                                );
                                            });
                                        })}
                                    </tbody>
                                </table>

                            <div className="flex justify-end mb-4">
                                <div className="w-48 text-[10px]">
                                    <div className="flex justify-between py-1 text-slate-700">
                                        <span>Subtotal:</span>
                                        <span className="font-semibold">৳{totalAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-t-2 border-slate-900 text-xs font-bold">
                                        <span>TOTAL:</span>
                                        <span className="text-orange-600">৳{totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-3 text-center text-[9px] text-slate-500">
                                <p>Thank you for your business!</p>
                                <p className="mt-0.5">Powered by: Bytespate Limited</p>
                            </div>
                            </div>
                        ) : (
                            <div className="py-10 text-center text-sm text-slate-500">
                                No returns found for this order.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default OrderReturnModal;

