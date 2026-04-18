/* eslint-disable @typescript-eslint/no-explicit-any */
import { XMarkIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import Loader from '@/components/common/Loader';
import { useGetReturnQuery } from '@/services/returnsApi';

interface ReturnDetailsModalProps {
    returnId: string | null;
    onClose: () => void;
}

const ReturnDetailsModal = ({ returnId, onClose }: ReturnDetailsModalProps) => {
    const { data: returnDetails, isLoading: isReturnDetailsLoading } = useGetReturnQuery(
        returnId || '',
        { skip: !returnId }
    );

    if (!returnId) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Return Details</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {isReturnDetailsLoading ? (
                    <div className="py-10 text-center">
                        <Loader message="Loading return details..." />
                    </div>
                ) : returnDetails ? (
                    <div className="space-y-6">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Return ID</td>
                                        <td className="py-3 text-sm font-semibold text-slate-900">{returnDetails.returnNumber}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Date</td>
                                        <td className="py-3 text-sm text-slate-900">
                                            {returnDetails.createdAt ? dayjs(returnDetails.createdAt).format('DD MMM YYYY') : 'N/A'}
                                        </td>
                                    </tr>
                                    {returnDetails.orderNumber && (
                                        <tr>
                                            <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Order Number</td>
                                            <td className="py-3 text-sm text-slate-900">{returnDetails.orderNumber}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest align-top">Items</td>
                                        <td className="py-3 text-sm text-slate-900">
                                            {returnDetails.items && returnDetails.items.length > 0 ? (
                                                <div className="space-y-2">
                                                    {returnDetails.items.map((item: any, index: number) => (
                                                        <div key={index} className="border-b border-slate-100 pb-2 last:border-0">
                                                            <div className="font-semibold">{item.productName}</div>
                                                            <div className="text-xs text-slate-600">
                                                                Qty: {item.quantity} × ৳{item.unitPrice?.toLocaleString() || '0'} = ৳{item.totalPrice?.toLocaleString() || '0'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">No items</span>
                                            )}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Subtotal</td>
                                        <td className="py-3 text-sm text-slate-900">৳{(returnDetails.subtotal || returnDetails.totalAmount || 0).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Total Amount</td>
                                        <td className="py-3 text-sm font-bold text-slate-900">৳{(returnDetails.totalAmount || 0).toLocaleString()}</td>
                                    </tr>
                                    {returnDetails.reason && (
                                        <tr>
                                            <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Reason</td>
                                            <td className="py-3 text-sm text-slate-900">{returnDetails.reason}</td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Customer Name</td>
                                        <td className="py-3 text-sm text-slate-900">{returnDetails.customer?.name || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Phone Number</td>
                                        <td className="py-3 text-sm text-slate-900">{returnDetails.customer?.phone || 'N/A'}</td>
                                    </tr>
                                    {returnDetails.customer?.email && (
                                        <tr>
                                            <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest">Email</td>
                                            <td className="py-3 text-sm text-slate-900">{returnDetails.customer.email}</td>
                                        </tr>
                                    )}
                                    {returnDetails.notes && (
                                        <tr>
                                            <td className="py-3 pr-8 text-sm font-semibold text-slate-600 uppercase tracking-widest align-top">Notes</td>
                                            <td className="py-3 text-sm text-slate-900 whitespace-pre-wrap">{returnDetails.notes}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Close Button */}
                        <div className="flex justify-end pt-4 border-t border-slate-100">
                            <button
                                onClick={onClose}
                                className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-10 text-center text-sm text-slate-500">
                        Unable to load return details.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReturnDetailsModal;

