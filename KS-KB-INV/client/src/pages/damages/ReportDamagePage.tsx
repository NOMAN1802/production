/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useCreateDamageMutation } from '@/services/damagesApi';
import { useGetProductsQuery } from '@/services/productsApi';
import { useGetSuppliersQuery } from '@/services/suppliersApi';
import { useGetExpensesQuery } from '@/services/expensesApi';
import { useGetCustomersQuery } from '@/services/customersApi';
import type { CreateDamageInput } from '@/services/damagesApi';

type DamageItem = {
    productId: string;
    productName: string;
    quantity: string;
    unitCost: string;
    damageType: string;
    reason: string;
    stockQuantity: number;
    supplierId?: string;
    orderId?: string;
    orderItemIndex?: number;
};

const ReportDamagePage = () => {
    const navigate = useNavigate();
    const [createDamage, { isLoading }] = useCreateDamageMutation();
    
    const [productSearch, setProductSearch] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Fetch products
    const { data: productsData } = useGetProductsQuery({
        search: productSearch,
        limit: 100,
    });

    // Fetch suppliers
    const { data: suppliersData } = useGetSuppliersQuery({ limit: 100 });

    // Fetch customers
    const { data: customersData } = useGetCustomersQuery({ limit: 1000 });
    const customers = useMemo(() => customersData?.customers ?? [], [customersData]);

    // Fetch expenses to get supplier for products
    const { data: expensesData } = useGetExpensesQuery({
        category: 'product_purchase',
        limit: 10000, // Fetch all to find suppliers
    });

    const products = useMemo(() => productsData?.products ?? [], [productsData]);
    const suppliers = useMemo(() => suppliersData?.suppliers?.filter(s => s.status === 'active') ?? [], [suppliersData?.suppliers]);
    const expenses = useMemo(() => expensesData?.result ?? [], [expensesData]);

    // Helper function to get supplier ID for a product
    const getProductSupplierId = useCallback((productId: string): string | undefined => {
        // Find the most recent expense for this product
        const productExpenses = expenses
            .filter(exp => 
                exp.referenceModel === 'Product' && 
                (typeof exp.referenceId === 'string' ? exp.referenceId : exp.referenceId?._id) === productId
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (productExpenses.length > 0) {
            const expense = productExpenses[0];
            if (expense.supplier) {
                return typeof expense.supplier === 'object' ? expense.supplier._id : expense.supplier;
            }
        }
        return undefined;
    }, [expenses]);

    // Filter products by selected supplier
    const filteredProducts = useMemo(() => {
        if (selectedSupplier === 'all') {
            return products;
        }

        // Filter products that belong to the selected supplier
        return products.filter((product) => {
            // First, check if product has supplierId matching the selected supplier
            if (product.supplierId === selectedSupplier) {
                return true;
            }
            
            // If product doesn't have supplierId, check purchase history
            const historicalSupplierId = getProductSupplierId(product._id);
            if (historicalSupplierId === selectedSupplier) {
                return true;
            }
            
            return false;
        });
    }, [products, selectedSupplier, getProductSupplierId]);

    // Calculate total loss
    const totalLoss = useMemo(() => {
        return damageItems.reduce((total, item) => {
            const qty = Number(item.quantity) || 0;
            const cost = Number(item.unitCost) || 0;
            return total + (qty * cost);
        }, 0);
    }, [damageItems]);

    const handleProductToggle = (productId: string) => {
        const newSelectedIds = new Set(selectedProductIds);
        if (newSelectedIds.has(productId)) {
            newSelectedIds.delete(productId);
            setDamageItems(items => items.filter(item => item.productId !== productId));
        } else {
            newSelectedIds.add(productId);
            const product = products.find(p => p._id === productId);
            if (product) {
                // Get supplier from product's supplierId first, then from purchase history
                const productSupplierId = product.supplierId || getProductSupplierId(productId);
                setDamageItems(items => [...items, {
                    productId,
                    productName: product.name,
                    quantity: '',
                    unitCost: product.purchasePrice?.toString() || '',
                    damageType: 'expired',
                    reason: 'Product damaged or expired',
                    stockQuantity: product.stockQuantity,
                    supplierId: productSupplierId || '',
                }]);
            }
        }
        setSelectedProductIds(newSelectedIds);
    };


    const handleItemUpdate = (productId: string, orderItemIndex: number | undefined, field: keyof DamageItem, value: string) => {
        setDamageItems(items =>
            items.map(item =>
                item.productId === productId && item.orderItemIndex === orderItemIndex
                    ? { ...item, [field]: value }
                    : item
            )
        );
        const errorKey = `${productId}-${orderItemIndex || 'product'}-${field}`;
        if (errors[errorKey]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    const handleRemoveItem = (productId: string, orderItemIndex?: number) => {
        setDamageItems(items => items.filter(item => {
            if (orderItemIndex !== undefined) {
                return !(item.productId === productId && item.orderItemIndex === orderItemIndex);
            }
            return item.productId !== productId || item.orderItemIndex !== undefined;
        }));
        if (orderItemIndex === undefined && productId) {
            const newSelectedIds = new Set(selectedProductIds);
            newSelectedIds.delete(productId);
            setSelectedProductIds(newSelectedIds);
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (damageItems.length === 0) {
            newErrors.general = 'Please select at least one product';
        }

        damageItems.forEach(item => {
            const key = `${item.productId}-${item.orderItemIndex || 'product'}`;
            if (!item.quantity || Number(item.quantity) <= 0) {
                newErrors[`${key}-quantity`] = 'Valid quantity is required';
            }
            if (Number(item.quantity) > item.stockQuantity) {
                newErrors[`${key}-quantity`] = `Cannot exceed stock (${item.stockQuantity})`;
            }
            if (!item.unitCost || Number(item.unitCost) <= 0) {
                newErrors[`${key}-unitCost`] = 'Valid unit cost is required';
            }
            if (!item.damageType) {
                newErrors[`${key}-damageType`] = 'Damage type is required';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        try {
            // Calculate subtotal and totalLoss
            const subtotal = damageItems.reduce((sum, item) => {
                const qty = Number(item.quantity) || 0;
                const cost = Number(item.unitCost) || 0;
                return sum + (qty * cost);
            }, 0);

            const damageData: CreateDamageInput = {
                ...(selectedCustomerId && { customerId: selectedCustomerId }),
                items: damageItems.map(item => ({
                    product: item.productId,
                    productName: item.productName,
                    quantity: Number(item.quantity),
                    unitCost: Number(item.unitCost),
                    totalLoss: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
                    damageType: item.damageType as any,
                    reason: item.reason || undefined,
                    ...(item.supplierId && { supplier: item.supplierId }),
                    ...(item.orderItemIndex !== undefined && { orderItemIndex: item.orderItemIndex }),
                })),
                subtotal,
                totalLoss: subtotal,
                ...(damageItems[0]?.orderId && { orderId: damageItems[0].orderId }),
            };

            await createDamage(damageData).unwrap();

            // Reset form
            setSelectedProductIds(new Set());
            setDamageItems([]);
            setProductSearch('');
            setSelectedCustomerId('');
            
            toast.success('Damage report created successfully!', {
                description: `Reported ${damageItems.length} product(s)`,
            });
            
            navigate('/damages');
        } catch (error: any) {
            console.error('Failed to report damages:', error);
            const errorMessage = error?.data?.message || 'Failed to report damages. Please try again.';
            toast.error('Report failed', {
                description: errorMessage,
            });
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/damages')}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand">Inventory Management</p>
                        <h1 className="mt-1 text-2xl font-bold text-slate-900">Report Damage</h1>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Supplier & Customer Filter */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Select Supplier</label>
                    <select
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                    >
                        <option value="all">All Suppliers</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier._id} value={supplier._id}>
                                {supplier.name}
                            </option>
                        ))}
                    </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-2">Select Customer</label>
                            <select
                                value={selectedCustomerId}
                                onChange={(e) => setSelectedCustomerId(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                            >
                                <option value="">-- No Customer --</option>
                                {customers.map((customer) => (
                                    <option key={customer._id} value={customer._id}>
                                        {customer.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Product Search */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Search Products</label>
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                            placeholder="Search by name, SKU, or category..."
                        />
                    </div>
                    {errors.general && (
                        <p className="mt-1 text-[10px] text-danger">{errors.general}</p>
                    )}
                </div>

                {/* Products Table */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-semibold text-slate-700 mb-2">Select Products</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full divide-y divide-slate-200 text-xs">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Product</th>
                                    <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">SKU</th>
                                    <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Stock</th>
                                    <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Unit Cost</th>
                                    <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-2 py-3 text-center text-xs text-slate-500">
                                            {selectedSupplier === 'all' 
                                                ? 'No products found' 
                                                : 'No products found for selected supplier'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product) => {
                                        const isSelected = selectedProductIds.has(product._id);
                                        return (
                                            <tr key={product._id} className={isSelected ? 'bg-brand/5' : 'hover:bg-slate-50'}>
                                                <td className="px-2 py-1.5 whitespace-nowrap">
                                                    <div className="text-xs font-medium text-slate-900">{product.name}</div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap">
                                                    <div className="text-xs text-slate-600">{product.sku || 'N/A'}</div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    <div className="text-xs font-semibold text-slate-900">{product.stockQuantity}</div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                    <div className="text-xs text-slate-900">৳{product.purchasePrice?.toLocaleString() || '0'}</div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleProductToggle(product._id)}
                                                        className={`inline-flex items-center px-2 py-1 rounded text-[9px] font-semibold transition ${
                                                            isSelected
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

                {/* Damage Items Table */}
                {damageItems.length > 0 && (
                    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold text-slate-700">Damage Details</h3>
                            <span className="text-[10px] text-slate-500">
                                {damageItems.length} product{damageItems.length !== 1 ? 's' : ''} selected
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full divide-y divide-slate-200 text-xs">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Product</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Stock</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Qty</th>
                                        <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Unit Cost</th>
                                        <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Type</th>
                                        <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Loss</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {damageItems.map((item, index) => {
                                        const itemLoss = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
                                        const key = `${item.productId}-${item.orderItemIndex || 'product'}`;
                                        return (
                                            <tr key={`${item.productId}-${item.orderItemIndex || index}`} className="hover:bg-slate-50">
                                                <td className="px-2 py-1.5 whitespace-nowrap">
                                                    <div className="text-xs font-medium text-slate-900">{item.productName}</div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    <div className="text-xs font-semibold text-slate-900">{item.stockQuantity}</div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={item.stockQuantity}
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemUpdate(item.productId, item.orderItemIndex, 'quantity', e.target.value)}
                                                        className={`w-16 rounded border ${
                                                            errors[`${key}-quantity`] ? 'border-danger' : 'border-slate-200'
                                                        } bg-white px-1.5 py-1 text-xs text-center focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20`}
                                                        placeholder="1"
                                                    />
                                                    {errors[`${key}-quantity`] && (
                                                        <p className="text-[9px] text-danger mt-0.5">{errors[`${key}-quantity`]}</p>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                    <div className="relative inline-block">
                                                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500 text-[9px]">৳</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={item.unitCost}
                                                            onChange={(e) => handleItemUpdate(item.productId, item.orderItemIndex, 'unitCost', e.target.value)}
                                                            className={`w-20 rounded border ${
                                                                errors[`${key}-unitCost`] ? 'border-danger' : 'border-slate-200'
                                                            } bg-white pl-5 pr-1.5 py-1 text-xs text-right focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20`}
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    {errors[`${key}-unitCost`] && (
                                                        <p className="text-[9px] text-danger mt-0.5">{errors[`${key}-unitCost`]}</p>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap">
                                                    <select
                                                        value={item.damageType}
                                                        onChange={(e) => handleItemUpdate(item.productId, item.orderItemIndex, 'damageType', e.target.value)}
                                                        className={`w-full rounded border ${
                                                            errors[`${key}-damageType`] ? 'border-danger' : 'border-slate-200'
                                                        } bg-white px-1.5 py-1 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20`}
                                                    >
                                                        <option value="expired">Expired</option>
                                                        <option value="broken">Broken</option>
                                                        <option value="lost">Lost</option>
                                                        <option value="defective">Defective</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                    <div className="text-xs font-semibold text-red-600">
                                                        ৳{itemLoss.toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(item.productId, item.orderItemIndex)}
                                                        className="inline-flex items-center px-1.5 py-1 rounded text-[9px] text-danger hover:bg-red-50 transition"
                                                    >
                                                        <TrashIcon className="h-3 w-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-red-50">
                                    <tr>
                                        <td colSpan={5} className="px-2 py-1.5 text-right text-[9px] font-semibold text-slate-900">
                                            Total Loss:
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                            <div className="text-xs font-bold text-red-600">৳{totalLoss.toFixed(2)}</div>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {damageItems.length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/damages')}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || damageItems.length === 0}
                            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Reporting...' : `Report ${damageItems.length} Damage(s)`}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ReportDamagePage;

