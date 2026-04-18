/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect } from 'react';
import { useGetReturnQuery } from '@/services/returnsApi';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import dayjs from 'dayjs';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useReactToPrint } from 'react-to-print';
import kabirLogo from '@/assets/kabirLogo.png';

interface ReturnInvoiceModalProps {
    returnId: string;
    onClose: () => void;
}

const ReturnInvoiceModal = ({ returnId, onClose }: ReturnInvoiceModalProps) => {
    const { data: returnData, isLoading, isError } = useGetReturnQuery(returnId);
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Return_${returnData?.returnNumber || 'Document'}`,
        pageStyle: `
            @page {
                size: A4;
                margin: 15mm;
            }
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .no-print {
                display: none !important;
            }
        `,
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
                    <Loader message="Loading return invoice..." />
                </div>
            </div>
        );
    }

    if (isError || !returnData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-2xl h-[90vh] flex items-center justify-center">
                    <ErrorState description="Unable to load return invoice" />
                </div>
            </div>
        );
    }

    const returnDetails = returnData;

    return (
        <>
            {/* Modal Overlay */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50 no-print">
                        <h3 className="text-xl font-bold text-slate-900">
                            Return Invoice
                            <span className="ml-3 text-sm font-normal text-slate-500">#{returnDetails.returnNumber}</span>
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (printRef.current) {
                                        handlePrint();
                                    }
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-brand/10 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/20 transition-colors"
                            >
                                <PrinterIcon className="h-5 w-5" />
                                Print Invoice
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Modal Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-100">
                        {/* Printable Content */}
                        <div ref={printRef} className="bg-white p-8 rounded-lg shadow-sm">
                            {/* Header - smaller font factor */}
                            <div className="border-b-2 border-slate-900 pb-3 mb-3">
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px]">
                                        <img 
                                            src={kabirLogo} 
                                            alt="Kabir Store Logo" 
                                            className="h-10 w-auto mb-1.5"
                                        />
                                        <h1 className="text-lg font-bold text-slate-900">RETURN INVOICE</h1>
                                        <p className="text-[10px] text-slate-600 mt-0.5">Kabir Store</p>
                                        <p className="text-[9px] text-slate-500">Inventory Management System</p>
                                    </div>
                                    <div className="text-right text-[10px]">
                                        <p className="text-base font-bold text-orange-600">#{returnDetails.returnNumber}</p>
                                        <p className="text-[9px] text-slate-600 mt-0.5">
                                            Date: {returnDetails.createdAt ? dayjs(returnDetails.createdAt).format('DD MMM YYYY') : 'N/A'}
                                        </p>
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                            <p className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Return To:</p>
                                            <div className="text-slate-700 text-[9px]">
                                                <p className="font-semibold">{returnDetails.customer?.name || 'N/A'}</p>
                                                {returnDetails.customer?.phone && <p className="mt-0.5">Phone: {returnDetails.customer.phone}</p>}
                                                {returnDetails.customer?.email && <p className="mt-0.5">Email: {returnDetails.customer.email}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
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
                                    {returnDetails.items && returnDetails.items.length > 0 ? (
                                        returnDetails.items.map((item: any, index: number) => (
                                            <tr key={index} className="border-b border-slate-200">
                                                <td className="py-1.5 px-1 text-slate-800">{item.productName}</td>
                                                <td className="py-1.5 px-1 text-slate-700">{item.supplierName || item.product?.supplier?.name || 'N/A'}</td>
                                                <td className="py-1.5 px-1 text-center text-slate-700">{item.quantity}</td>
                                                <td className="py-1.5 px-1 text-right text-slate-700">৳{(item.unitPrice || 0).toLocaleString()}</td>
                                                <td className="py-1.5 px-1 text-right font-semibold text-slate-900">৳{(item.totalPrice || 0).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-1.5 px-1 text-[10px] text-slate-500 text-center">No items found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Additional Information */}
                            {(returnDetails.reason || returnDetails.orderNumber || returnDetails.notes) && (
                                <div className="mb-4 text-[10px]">
                                    <h2 className="text-[9px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Additional Information</h2>
                                    <div className="bg-slate-50 rounded-lg p-2 space-y-1.5">
                                        {returnDetails.orderNumber && (
                                            <div>
                                                <p className="text-[9px] text-slate-600">Original Order Number</p>
                                                <p className="text-[10px] font-semibold text-slate-900">{returnDetails.orderNumber}</p>
                                            </div>
                                        )}
                                        {returnDetails.reason && (
                                            <div>
                                                <p className="text-[9px] text-slate-600">Reason for Return</p>
                                                <p className="text-[10px] text-slate-900">{returnDetails.reason}</p>
                                            </div>
                                        )}
                                        {returnDetails.notes && (
                                            <div>
                                                <p className="text-[9px] text-slate-600">Notes</p>
                                                <p className="text-[10px] text-slate-900 whitespace-pre-wrap">{returnDetails.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Totals */}
                            <div className="flex justify-end mb-4">
                                <div className="w-48 text-[10px]">
                                    <div className="flex justify-between py-1 text-slate-700">
                                        <span>Subtotal:</span>
                                        <span className="font-semibold">৳{(returnDetails.subtotal || returnDetails.totalAmount || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-t-2 border-slate-900 text-xs font-bold">
                                        <span>TOTAL:</span>
                                        <span className="text-orange-600">৳{(returnDetails.totalAmount || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {(returnDetails.reason || returnDetails.notes) && (
                                <div className="mb-4 pt-3 border-t border-slate-200 text-[10px]">
                                    {returnDetails.reason && (
                                        <div className="mb-1.5">
                                            <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Reason for Return:</h3>
                                            <p className="text-slate-700">{returnDetails.reason}</p>
                                        </div>
                                    )}
                                    {returnDetails.notes && (
                                        <div>
                                            <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Notes:</h3>
                                            <p className="text-slate-700 whitespace-pre-wrap">{returnDetails.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Footer */}
                            <div className="border-t border-slate-200 pt-3 text-center text-[9px] text-slate-500">
                                <p>Thank you for your business!</p>
                                <p className="mt-0.5">Powered by: Bytespate Limited</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ReturnInvoiceModal;

