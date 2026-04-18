/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetReturnQuery } from '@/services/returnsApi';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import dayjs from 'dayjs';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import kabirLogo from '@/assets/kabirLogo.png';

const PrintReturnPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: returnData, isLoading, isError } = useGetReturnQuery(id || '', { skip: !id });

    useEffect(() => {
        if (returnData) {
            // Auto print when loaded
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [returnData]);

    if (isLoading) return <Loader fullScreen message="Loading return invoice..." />;
    if (isError || !returnData) return <ErrorState description="Return invoice not found" />;

    return (
        <div className="min-h-screen bg-white p-8">
            <div className="max-w-4xl mx-auto print:hidden mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Back
                </button>
            </div>
            <div className="max-w-4xl mx-auto text-[10px]">
                {/* Header - smaller font factor */}
                <div className="border-b-2 border-slate-900 pb-3 mb-3">
                    <div className="flex justify-between items-start">
                        <div>
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
                            <p className="text-base font-bold text-orange-600">#{returnData.returnNumber}</p>
                            <p className="text-[9px] text-slate-600 mt-0.5">
                                Date: {returnData.createdAt ? dayjs(returnData.createdAt).format('DD MMM YYYY') : 'N/A'}
                            </p>
                            <div className="mt-1.5 pt-1.5 border-t border-slate-200">
                                <p className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Return To:</p>
                                <div className="text-slate-700 text-[9px]">
                                    <p className="font-semibold">{returnData.customer?.name || 'N/A'}</p>
                                    {returnData.customer?.phone && <p className="mt-0.5">Phone: {returnData.customer.phone}</p>}
                                    {returnData.customer?.email && <p className="mt-0.5">Email: {returnData.customer.email}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Return Items Table */}
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
                        {returnData.items && returnData.items.length > 0 ? (
                            returnData.items.map((item: any, index: number) => (
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

                {/* Notes */}
                {(returnData.reason || returnData.notes) && (
                    <div className="mb-4 pt-3 border-t border-slate-200 text-[10px]">
                        {returnData.reason && (
                            <div className="mb-1.5">
                                <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Reason for Return:</h3>
                                <p className="text-slate-700">{returnData.reason}</p>
                            </div>
                        )}
                        {returnData.notes && (
                            <div>
                                <h3 className="text-[9px] font-bold text-slate-900 uppercase tracking-wide mb-0.5">Notes:</h3>
                                <p className="text-slate-700 whitespace-pre-wrap">{returnData.notes}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Totals */}
                <div className="flex justify-end mb-4">
                    <div className="w-48 text-[10px]">
                        <div className="flex justify-between py-1 text-slate-700">
                            <span>Subtotal:</span>
                            <span className="font-semibold">৳{(returnData.subtotal || returnData.totalAmount || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-t-2 border-slate-900 text-xs font-bold">
                            <span>TOTAL:</span>
                            <span className="text-orange-600">৳{(returnData.totalAmount || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 pt-3 text-center text-[9px] text-slate-500">
                    <p>Thank you for your business!</p>
                    <p className="mt-0.5">This is a computer-generated return invoice.</p>
                    <p className="mt-0.5">Powered by: Bytespate Limited</p>
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
    );
};

export default PrintReturnPage;

