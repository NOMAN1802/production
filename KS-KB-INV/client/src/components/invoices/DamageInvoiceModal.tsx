/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useEffect } from 'react';
import { useGetDamageQuery } from '@/services/damagesApi';
import { useGetCustomerQuery } from '@/services/customersApi';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import dayjs from 'dayjs';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useReactToPrint } from 'react-to-print';
import kabirLogo from '@/assets/kabirLogo.png';

interface DamageInvoiceModalProps {
    damageId: string;
    onClose: () => void;
}

const DamageInvoiceModal = ({ damageId, onClose }: DamageInvoiceModalProps) => {
    const { data: damageData, isLoading, isError } = useGetDamageQuery(damageId);
    const printRef = useRef<HTMLDivElement>(null);

    const rawCustomerId = damageData?.customerId;
    const customerIdStr = typeof rawCustomerId === 'string' ? rawCustomerId : typeof rawCustomerId === 'object' && rawCustomerId !== null ? rawCustomerId._id : undefined;
    const { data: fetchedCustomer } = useGetCustomerQuery(customerIdStr!, { skip: !customerIdStr || typeof rawCustomerId === 'object' });
    const customer = typeof rawCustomerId === 'object' && rawCustomerId !== null ? rawCustomerId : fetchedCustomer;

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Damage_${damageData?.damageNumber || 'Document'}`,
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
                    <Loader message="Loading damage invoice..." />
                </div>
            </div>
        );
    }

    if (isError || !damageData) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-2xl h-[90vh] flex items-center justify-center">
                    <ErrorState description="Unable to load damage invoice" />
                </div>
            </div>
        );
    }

    const damageDetails = damageData;

    return (
        <>
            {/* Modal Overlay */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50 no-print">
                        <h3 className="text-xl font-bold text-slate-900">
                            Damage Report Invoice
                            <span className="ml-3 text-sm font-normal text-slate-500">#{damageDetails.damageNumber}</span>
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handlePrint();
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
                            {/* Header - smaller fonts like order invoice */}
                            <div className="border-b-2 border-slate-900 pb-4 mb-4">
                                <div className="flex justify-between items-start">
                                    <div className="text-sm">
                                        <img 
                                            src={kabirLogo} 
                                            alt="Kabir Store Logo" 
                                            className="h-12 w-auto mb-2"
                                        />
                                        <h1 className="text-2xl font-bold text-slate-900">DAMAGE REPORT</h1>
                                        <p className="text-sm text-slate-600 mt-1">Kabir Store</p>
                                        <p className="text-xs text-slate-500">Inventory Management System</p>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="text-lg font-bold text-red-600">#{damageDetails.damageNumber}</p>
                                        <p className="text-xs text-slate-600 mt-1">
                                            Date: {damageDetails.createdAt ? dayjs(damageDetails.createdAt).format('DD MMM YYYY') : 'N/A'}
                                        </p>
                                        {damageDetails.orderNumber && (
                                            <p className="text-xs text-slate-600 mt-0.5">
                                                Order: {damageDetails.orderNumber}
                                            </p>
                                        )}
                                        {customer && (
                                            <>
                                                <p className="text-xs font-semibold text-slate-900 mt-1">{customer.name}</p>
                                                {customer.phone && (
                                                    <p className="text-xs text-slate-600">{customer.phone}</p>
                                                )}
                                                {customer.address && (
                                                    <p className="text-xs text-slate-600">{customer.address}</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full mb-6 text-xs">
                                <thead>
                                    <tr className="border-b-2 border-slate-900">
                                        <th className="text-left py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">Item</th>
                                        <th className="text-left py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">Supplier</th>
                                        <th className="text-center py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">Quantity</th>
                                        <th className="text-right py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">Unit Cost</th>
                                        <th className="text-right py-2 px-1.5 text-[10px] font-bold text-slate-900 uppercase">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {damageDetails.items && damageDetails.items.length > 0 ? (
                                        damageDetails.items.map((item: any, index: number) => (
                                            <tr key={index} className="border-b border-slate-200">
                                                <td className="py-2 px-1.5 text-slate-800">{item.productName}</td>
                                                <td className="py-2 px-1.5 text-slate-700">{item.supplierName || item.supplier?.name || 'N/A'}</td>
                                                <td className="py-2 px-1.5 text-center text-slate-700">{item.quantity}</td>
                                                <td className="py-2 px-1.5 text-right text-slate-700">৳{(item.unitCost || 0).toLocaleString()}</td>
                                                <td className="py-2 px-1.5 text-right font-semibold text-slate-900">৳{(item.totalLoss || 0).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-2 px-1.5 text-xs text-slate-500 text-center">No items found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* Totals */}
                            <div className="flex justify-end mb-6">
                                <div className="w-56 text-xs">
                                    <div className="flex justify-between py-1.5 text-slate-700">
                                        <span>Subtotal:</span>
                                        <span className="font-semibold">৳{(damageDetails.subtotal || damageDetails.totalLoss || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold">
                                        <span>TOTAL LOSS:</span>
                                        <span className="text-red-600">৳{(damageDetails.totalLoss || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            {damageDetails.notes && (
                                <div className="mb-6 pt-4 border-t border-slate-200 text-xs">
                                    <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide mb-1">Notes:</h3>
                                    <p className="text-slate-700 whitespace-pre-wrap">{damageDetails.notes}</p>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500">
                                <p>Thank you for your business!</p>
                                <p className="mt-1">Powered by: Bytespate Limited</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DamageInvoiceModal;

