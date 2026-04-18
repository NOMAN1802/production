/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetDamageQuery } from '@/services/damagesApi';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import dayjs from 'dayjs';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import kabirLogo from '@/assets/kabirLogo.png';

const PrintDamagePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: damageData, isLoading, isError } = useGetDamageQuery(id || '', { skip: !id });

    useEffect(() => {
        if (damageData) {
            // Auto print when loaded
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [damageData]);

    if (isLoading) return <Loader fullScreen message="Loading damage invoice..." />;
    if (isError || !damageData) return <ErrorState description="Damage invoice not found" />;

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
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-6 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <img 
                                src={kabirLogo} 
                                alt="Kabir Store Logo" 
                                className="h-16 w-auto mb-3"
                            />
                            <h1 className="text-4xl font-bold text-slate-900">DAMAGE REPORT</h1>
                            <p className="text-lg text-slate-600 mt-2">Kabir Store</p>
                            <p className="text-sm text-slate-500">Inventory Management System</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-red-600">#{damageData.damageNumber}</p>
                            <p className="text-sm text-slate-600 mt-2">
                                Date: {damageData.createdAt ? dayjs(damageData.createdAt).format('DD MMM YYYY') : 'N/A'}
                            </p>
                            {damageData.orderNumber && (
                                <p className="text-sm text-slate-600 mt-1">
                                    Order: {damageData.orderNumber}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full mb-8">
                    <thead>
                        <tr className="border-b-2 border-slate-900">
                            <th className="text-left py-3 px-2 text-sm font-bold text-slate-900 uppercase">
                                Item
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-bold text-slate-900 uppercase">
                                Supplier
                            </th>
                            <th className="text-center py-3 px-2 text-sm font-bold text-slate-900 uppercase">
                                Quantity
                            </th>
                            <th className="text-right py-3 px-2 text-sm font-bold text-slate-900 uppercase">
                                Unit Cost
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-bold text-slate-900 uppercase">
                                Type
                            </th>
                            <th className="text-right py-3 px-2 text-sm font-bold text-slate-900 uppercase">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {damageData.items && damageData.items.length > 0 ? (
                            damageData.items.map((item: any, index: number) => (
                                <tr key={index} className="border-b border-slate-200">
                                    <td className="py-3 px-2 text-slate-800">{item.productName}</td>
                                    <td className="py-3 px-2 text-slate-700">{item.supplierName || item.supplier?.name || 'N/A'}</td>
                                    <td className="py-3 px-2 text-center text-slate-700">{item.quantity}</td>
                                    <td className="py-3 px-2 text-right text-slate-700">
                                        ৳{(item.unitCost || 0).toLocaleString()}
                                    </td>
                                    <td className="py-3 px-2 text-slate-700 capitalize">{item.damageType}</td>
                                    <td className="py-3 px-2 text-right font-semibold text-slate-900">
                                        ৳{(item.totalLoss || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="py-3 px-2 text-slate-500 text-center">No items found</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                    <div className="w-64">
                        <div className="flex justify-between py-2 text-slate-700">
                            <span>Subtotal:</span>
                            <span className="font-semibold">৳{(damageData.subtotal || damageData.totalLoss || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-3 border-t-2 border-slate-900 text-lg font-bold">
                            <span>TOTAL LOSS:</span>
                            <span className="text-red-600">৳{(damageData.totalLoss || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {damageData.notes && (
                    <div className="mb-8 pt-8 border-t border-slate-200">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">
                                Notes:
                            </h3>
                            <p className="text-slate-700 whitespace-pre-wrap">{damageData.notes}</p>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
                    <p>Thank you for your business!</p>
                    <p className="mt-2">Powered by: Bytespate Limited</p>
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

export default PrintDamagePage;

