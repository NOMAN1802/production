import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useGetProductsQuery } from '@/services/productsApi';
import { useGetSuppliersQuery } from '@/services/suppliersApi';
import { useCreatePendingProductsMutation } from '@/services/pendingProductsApi';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';

type PendingItem = {
    productName: string;
    code: string;
    quantity: string;
    amount: string;
    supplierName: string;
};

const AddPendingProductsPage = () => {
    const navigate = useNavigate();
    const [createPendingProducts, { isLoading }] = useCreatePendingProductsMutation();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductNames, setSelectedProductNames] = useState<Set<string>>(new Set());
    const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { data: productsData, isLoading: isLoadingProducts, isError } = useGetProductsQuery({
        search: searchTerm,
        limit: 100,
        page: 1,
    });

    const { data: suppliersData } = useGetSuppliersQuery({ limit: 100 });

    const products = useMemo(() => productsData?.products ?? [], [productsData?.products]);
    const suppliers = useMemo(() => suppliersData?.suppliers?.filter((s) => s.status === 'active') ?? [], [suppliersData?.suppliers]);

    const handleProductToggle = (productId: string) => {
        const product = products.find((p) => p._id === productId);
        if (!product) return;

        const key = product._id;
        const newSelected = new Set(selectedProductNames);

        if (newSelected.has(key)) {
            newSelected.delete(key);
            setPendingItems((prev) => prev.filter((i) => i.productName !== product.name || i.code !== (product.sku ?? '')));
        } else {
            newSelected.add(key);
            setPendingItems((prev) => [
                ...prev,
                {
                    productName: product.name,
                    code: '',
                    quantity: '',
                    amount: '',
                    supplierName: '',
                },
            ]);
        }
        setSelectedProductNames(newSelected);
    };

    const handleItemUpdate = (index: number, field: keyof PendingItem, value: string) => {
        setPendingItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
        const errKey = `${index}-${field}`;
        if (errors[errKey]) {
            setErrors((prev) => { const n = { ...prev }; delete n[errKey]; return n; });
        }
    };

    const handleRemove = (index: number) => {
        const item = pendingItems[index];
        const product = products.find((p) => p.name === item.productName && (p.sku ?? '') === item.code);
        if (product) {
            const newSelected = new Set(selectedProductNames);
            newSelected.delete(product._id);
            setSelectedProductNames(newSelected);
        }
        setPendingItems((prev) => prev.filter((_, i) => i !== index));
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (pendingItems.length === 0) {
            newErrors.general = 'Please select at least one product';
        }
        pendingItems.forEach((item, i) => {
            if (!item.quantity || Number(item.quantity) < 1) newErrors[`${i}-quantity`] = 'Required';
            if (!item.amount || Number(item.amount) < 0) newErrors[`${i}-amount`] = 'Required';
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) {
            toast.error('Please fix the errors before submitting');
            return;
        }
        try {
            await createPendingProducts({
                items: pendingItems.map((item) => ({
                    productName: item.productName,
                    code: item.code || undefined,
                    quantity: Number(item.quantity),
                    amount: Number(item.amount),
                    supplierName: item.supplierName || undefined,
                })),
            }).unwrap();

            toast.success(`${pendingItems.length} pending product(s) added successfully`);
            navigate('/products/pending');
        } catch {
            toast.error('Failed to add pending products');
        }
    };

    if (isLoadingProducts) return <Loader fullScreen message="Loading products..." />;
    if (isError) return <ErrorState title="Failed to load products" onRetry={() => window.location.reload()} />;

    const inputCls = (hasErr: boolean) =>
        `w-full rounded border ${hasErr ? 'border-danger' : 'border-slate-200'} bg-white px-1.5 py-1 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20`;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/products/pending')}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand">Products</p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-900">Add Pending Products</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Product Search */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Search & Select Products</label>
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                            placeholder="Search by name, SKU, or category..."
                        />
                    </div>
                    {errors.general && <p className="mt-1 text-[10px] text-danger">{errors.general}</p>}
                </div>

                {/* Product List */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-700 mb-2">Available Products</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-slate-200 text-xs">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Product</th>
                                    <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Code / SKU</th>
                                    <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Category</th>
                                    <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Stock</th>
                                    <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {products.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-4 text-center text-xs text-slate-500">No products found</td>
                                    </tr>
                                ) : (
                                    products.map((product) => {
                                        const isSelected = selectedProductNames.has(product._id);
                                        return (
                                            <tr key={product._id} className={isSelected ? 'bg-brand/5' : 'hover:bg-slate-50'}>
                                                <td className="px-2 py-1.5">
                                                    <div className="font-medium text-slate-900">{product.name}</div>
                                                    <div className="text-[10px] text-slate-500">Unit: {product.unit}</div>
                                                </td>
                                                <td className="px-2 py-1.5 text-slate-600">{product.sku || 'N/A'}</td>
                                                <td className="px-2 py-1.5 text-slate-600">{product.categoryName || 'N/A'}</td>
                                                <td className="px-2 py-1.5 text-center font-semibold text-slate-900">{product.stockQuantity}</td>
                                                <td className="px-2 py-1.5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleProductToggle(product._id)}
                                                        className={`inline-flex items-center px-2 py-1 rounded text-[9px] font-semibold transition ${isSelected
                                                            ? 'text-danger bg-red-50 hover:bg-red-100'
                                                            : 'text-white bg-brand hover:bg-brand-dark'
                                                            }`}
                                                    >
                                                        {isSelected ? 'Remove' : 'Add'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pending Items Table */}
                {pendingItems.length > 0 && (
                    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold text-slate-700">Pending Product Details</h3>
                            <span className="text-[10px] text-slate-500">{pendingItems.length} product{pendingItems.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full divide-y divide-slate-200 text-xs">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Product Name</th>
                                        <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Code</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Quantity</th>
                                        <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Amount</th>
                                        <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Supplier</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {pendingItems.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50">
                                            <td className="px-2 py-1.5 font-medium text-slate-900 whitespace-nowrap">{item.productName}</td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                <input
                                                    type="text"
                                                    value={item.code}
                                                    onChange={(e) => handleItemUpdate(index, 'code', e.target.value)}
                                                    className={inputCls(false) + ' w-24'}
                                                    placeholder="Code"
                                                />
                                            </td>
                                            <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemUpdate(index, 'quantity', e.target.value)}
                                                    className={inputCls(!!errors[`${index}-quantity`]) + ' w-16 text-center'}
                                                    placeholder="1"
                                                />
                                                {errors[`${index}-quantity`] && (
                                                    <p className="text-[9px] text-danger mt-0.5">{errors[`${index}-quantity`]}</p>
                                                )}
                                            </td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                <div className="relative inline-block">
                                                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500 text-[9px]">৳</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.amount}
                                                        onChange={(e) => handleItemUpdate(index, 'amount', e.target.value)}
                                                        className={inputCls(!!errors[`${index}-amount`]) + ' w-24 pl-4 text-right'}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {errors[`${index}-amount`] && (
                                                    <p className="text-[9px] text-danger mt-0.5">{errors[`${index}-amount`]}</p>
                                                )}
                                            </td>
                                            <td className="px-2 py-1.5 whitespace-nowrap">
                                                <select
                                                    value={item.supplierName}
                                                    onChange={(e) => handleItemUpdate(index, 'supplierName', e.target.value)}
                                                    className={inputCls(false) + ' w-36'}
                                                >
                                                    <option value="">-- Select --</option>
                                                    {suppliers.map((s) => (
                                                        <option key={s._id} value={s.name}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(index)}
                                                    className="inline-flex items-center px-1.5 py-1 rounded text-danger hover:bg-red-50 transition"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Submit */}
                {pendingItems.length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/products/pending')}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Saving...' : 'Save Pending Products'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default AddPendingProductsPage;
