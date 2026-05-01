import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useUpdatePurchaseMutation, type Purchase } from '@/services/purchasesApi';

interface EditPurchaseModalProps {
    purchase: Purchase | null;
    onClose: () => void;
}

type FormData = {
    supplierName: string;
    supplierPhone: string;
    supplierEmail: string;
    supplierContactPerson: string;
    supplierAddress: string;
    status: 'pending' | 'completed' | 'partial';
    paidAmount: string;
    paymentMethod: string;
    notes: string;
};

const EditPurchaseModal = ({ purchase, onClose }: EditPurchaseModalProps) => {
    const [updatePurchase, { isLoading }] = useUpdatePurchaseMutation();

    const [formData, setFormData] = useState<FormData>({
        supplierName: '',
        supplierPhone: '',
        supplierEmail: '',
        supplierContactPerson: '',
        supplierAddress: '',
        status: 'pending',
        paidAmount: '',
        paymentMethod: '',
        notes: '',
    });

    useEffect(() => {
        if (purchase) {
            setFormData({
                supplierName: purchase.supplier?.name || '',
                supplierPhone: purchase.supplier?.phone || '',
                supplierEmail: purchase.supplier?.email || '',
                supplierContactPerson: purchase.supplier?.contactPerson || '',
                supplierAddress: purchase.supplier?.address || '',
                status: purchase.status || 'pending',
                paidAmount: purchase.paidAmount != null ? String(purchase.paidAmount) : '',
                paymentMethod: purchase.paymentMethod || '',
                notes: purchase.notes || '',
            });
        }
    }, [purchase]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!purchase) return null;

    const handleChange = (field: keyof FormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updatePurchase({
                id: purchase._id,
                data: {
                    supplier: {
                        _id: purchase.supplier?._id,
                        name: formData.supplierName,
                        phone: formData.supplierPhone || undefined,
                        email: formData.supplierEmail || undefined,
                        contactPerson: formData.supplierContactPerson || undefined,
                        address: formData.supplierAddress || undefined,
                    },
                    status: formData.status,
                    paidAmount: formData.paidAmount !== '' ? parseFloat(formData.paidAmount) : undefined,
                    paymentMethod: formData.paymentMethod || undefined,
                    notes: formData.notes || undefined,
                },
            }).unwrap();
            onClose();
        } catch (error) {
            console.error('Failed to update purchase:', error);
        }
    };

    const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all';
    const labelClass = 'block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Edit Purchase</h2>
                        <p className="text-sm text-slate-500">{purchase.purchaseNumber}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
                        {/* Supplier Info */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 mb-3">Supplier Information</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className={labelClass}>Supplier Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.supplierName}
                                        onChange={(e) => handleChange('supplierName', e.target.value)}
                                        className={inputClass}
                                        placeholder="Supplier name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Phone</label>
                                    <input
                                        type="text"
                                        value={formData.supplierPhone}
                                        onChange={(e) => handleChange('supplierPhone', e.target.value)}
                                        className={inputClass}
                                        placeholder="Phone number"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Contact Person</label>
                                    <input
                                        type="text"
                                        value={formData.supplierContactPerson}
                                        onChange={(e) => handleChange('supplierContactPerson', e.target.value)}
                                        className={inputClass}
                                        placeholder="Contact person"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <input
                                        type="email"
                                        value={formData.supplierEmail}
                                        onChange={(e) => handleChange('supplierEmail', e.target.value)}
                                        className={inputClass}
                                        placeholder="Email address"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={labelClass}>Address</label>
                                    <input
                                        type="text"
                                        value={formData.supplierAddress}
                                        onChange={(e) => handleChange('supplierAddress', e.target.value)}
                                        className={inputClass}
                                        placeholder="Address"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100" />

                        {/* Payment Info */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 mb-3">Payment Information</h3>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className={labelClass}>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => handleChange('status', e.target.value)}
                                        className={inputClass}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="partial">Partial</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Paid Amount</label>
                                    <input
                                        type="number"
                                        value={formData.paidAmount}
                                        onChange={(e) => handleChange('paidAmount', e.target.value)}
                                        min="0"
                                        step="0.01"
                                        className={inputClass}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className={labelClass}>Payment Method</label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={(e) => handleChange('paymentMethod', e.target.value)}
                                        className={inputClass}
                                    >
                                        <option value="">Select method</option>
                                        <option value="cash">Cash</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="check">Check</option>
                                        <option value="mobile_banking">Mobile Banking</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100" />

                        {/* Notes */}
                        <div>
                            <label className={labelClass}>Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                                className={`${inputClass} resize-none`}
                                placeholder="Add any notes..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-xl bg-linear-to-r from-brand to-brand-dark px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/40 transition-all hover:shadow-xl hover:shadow-brand/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditPurchaseModal;
