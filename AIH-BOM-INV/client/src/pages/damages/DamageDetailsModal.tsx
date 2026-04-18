import { XMarkIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import type { Damage } from '@/services/damagesApi';

type DamageDetailsModalProps = {
    damage: Damage | null;
    onClose: () => void;
};

const getDamageTypeIcon = (type?: string) => {
    const icons = {
        expired: '⏰',
        broken: '💔',
        lost: '❓',
        defective: '⚠️',
        other: '📝'
    };
    return icons[type as keyof typeof icons] || '📝';
};

const DamageDetailsModal = ({ damage, onClose }: DamageDetailsModalProps) => {
    if (!damage) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900">Damage Details</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="space-y-6">
                        {/* Damage ID and Date */}
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-lg">
                                {getDamageTypeIcon(damage.items[0]?.damageType)}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-900">{damage.damageNumber}</p>
                                <p className="text-xs text-slate-400">
                                    {damage.createdAt ? dayjs(damage.createdAt).format('MMMM DD, YYYY [at] hh:mm A') : 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Items */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Damaged Items</label>
                            <div className="space-y-4">
                                {damage.items.map((item, index) => (
                                    <div key={index} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Product Name</label>
                                                <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                                                <p className="text-sm font-semibold text-slate-900">{item.quantity}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Unit Cost</label>
                                                <p className="text-sm font-semibold text-slate-900">৳{(item.unitCost || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Total Loss</label>
                                                <p className="text-sm font-semibold text-red-600">৳{(item.totalLoss || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Damage Type</label>
                                                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                                                    {item.damageType}
                                                </span>
                                            </div>
                                            {item.reason && (
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Reason</label>
                                                    <p className="text-sm text-slate-700">{item.reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Total Loss */}
                        <div className="pt-4 border-t border-slate-200">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-semibold uppercase tracking-widest text-slate-500">Total Loss Value</label>
                                <p className="text-lg font-bold text-red-600">৳{(damage.totalLoss || 0).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Notes */}
                        {damage.notes && (
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Notes</label>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    {damage.notes}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="w-1/3 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DamageDetailsModal;

