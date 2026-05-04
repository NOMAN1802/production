/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeftIcon,
    PlusIcon,
    TrashIcon,
    PrinterIcon,
    ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useGetProductsQuery } from '@/services/productsApi';
import { useGetOrderByIdQuery, useUpdateOrderMutation } from '@/services/ordersApi';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';

type OrderItem = {
    product: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
};

type CustomerInfo = {
    name: string;
    email: string;
    phone: string;
    address: string;
};

const EditOrderPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: productsData } = useGetProductsQuery({ limit: 1000 });
    const { data: order, isLoading: loadingOrder, isError: errorOrder } = useGetOrderByIdQuery(id!, { skip: !id });
    const [updateOrder, { isLoading: updating }] = useUpdateOrderMutation();

    const [customer, setCustomer] = useState<CustomerInfo>({
        name: '',
        email: '',
        phone: '',
        address: '',
    });

    const [items, setItems] = useState<OrderItem[]>([]);
    const [status, setStatus] = useState<string>('pending');
    const [discountPercent, setDiscountPercent] = useState(0);
    const [tax, setTax] = useState(0);
    const [additionalCharges, setAdditionalCharges] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [notes, setNotes] = useState('');
    const [_errors, setErrors] = useState<{ [key: string]: string }>({});
    const prevOrderIdRef = useRef<string | undefined>(undefined);

    // Populate form when order data is loaded (only when order ID changes to avoid cascading renders)
    useEffect(() => {
        if (!order) return;

        // Only update if this is a new order (order ID changed)
        if (prevOrderIdRef.current !== order._id) {
            prevOrderIdRef.current = order._id;
            // Defer setState to avoid synchronous setState in effect
            queueMicrotask(() => {
                setCustomer({
                    name: order.customer.name,
                    email: order.customer.email || 'customer@gmail.com',
                    phone: order.customer.phone || '',
                    address: order.customer.address || '',
                });

                // Map order items to form items
                // Note: order.items has product object populated, but we need ID for the select
                const formItems = order.items.map((item: any) => ({
                    product: typeof item.product === 'object' ? item.product._id : item.product,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                }));

                setItems(formItems);
                setStatus(order.status);
                const subtotalVal = order.items.reduce((s: number, i: any) => s + (i.totalPrice || 0), 0);
                setDiscountPercent(subtotalVal > 0 ? Math.round(((order.discount || 0) / subtotalVal) * 100) : 0);
                setTax(order.tax || 0);
                setAdditionalCharges(order.additionalCharges || 0);
                setPaymentMethod(order.paymentMethod || 'cash');
                setNotes(order.notes || '');
            });
        }
    }, [order]);

    const products = useMemo(() => productsData?.products ?? [], [productsData]);

    const subtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + item.totalPrice, 0);
    }, [items]);

    const discountAmount = useMemo(() => {
        return subtotal * (discountPercent / 100);
    }, [subtotal, discountPercent]);

    const totalAmount = useMemo(() => {
        return subtotal - discountAmount + tax + additionalCharges;
    }, [subtotal, discountAmount, tax, additionalCharges]);

    const addItem = () => {
        setItems([
            ...items,
            { product: '', productName: '', quantity: 1, unitPrice: 0, totalPrice: 0 },
        ]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: keyof OrderItem, value: any) => {
        const newItems = [...items];
        const item = newItems[index];

        if (field === 'product') {
            const selectedProduct = products.find((p) => p._id === value);
            if (selectedProduct) {
                item.product = value;
                item.productName = selectedProduct.name;
                item.unitPrice = selectedProduct.sellingPrice;
                item.totalPrice = selectedProduct.sellingPrice * item.quantity;
            }
        } else if (field === 'quantity') {
            item.quantity = Number(value);
            item.totalPrice = item.unitPrice * item.quantity;
        } else if (field === 'unitPrice') {
            item.unitPrice = Number(value);
            item.totalPrice = item.unitPrice * item.quantity;
        }

        setItems(newItems);
    };

    const validateEmail = (email: string): boolean => {
        if (!email) return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmit = async (print: boolean = false) => {
        if (!id) return;

        try {
            setErrors({});

            const validItems = items.filter((item) => item.product && item.quantity > 0);

            if (validItems.length === 0) {
                setErrors({ items: 'Please add at least one product to the order' });
                toast.error('Please add at least one product to the order');
                return;
            }

            if (customer.email && customer.email.trim() && !validateEmail(customer.email.trim())) {
                setErrors({ email: 'Please enter a valid email address' });
                toast.error('Please enter a valid email address');
                return;
            }

            const orderData: any = {
                customer: {
                    name: customer.name.trim() || 'Walk-in Customer',
                    email: customer.email?.trim(),
                    phone: customer.phone?.trim(),
                    address: customer.address?.trim(),
                },
                items: validItems,
                status,
                subtotal: Number(subtotal),
                discount: Number(discountAmount.toFixed(2)),
                tax: Number(tax),
                additionalCharges: Number(additionalCharges),
                totalAmount: Number(totalAmount),
                paymentMethod: paymentMethod?.trim(),
                notes: notes?.trim(),
            };

            console.log('Updating order data:', orderData);

            await updateOrder({ id, data: orderData }).unwrap();

            if (print) {
                window.open(`/invoices/${id}/print`, '_blank');
            }

            navigate('/invoices');
        } catch (error: any) {
            console.error('Failed to update order:', error);
            let errorMessage = 'Failed to update order.';
            if (error?.data?.message) {
                errorMessage = error.data.message;
            }
            toast.error(errorMessage);
        }
    };

    if (loadingOrder) return <Loader fullScreen message="Loading order details..." />;
    if (errorOrder || !order) return <ErrorState description="Unable to load order" />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/invoices')}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">Order Management</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-900">Edit Order <span className="text-slate-400">#{order.orderNumber}</span></h1>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Form - 2 columns */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer Information */}
                    <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Customer Information</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Customer Name</label>
                                <input
                                    type="text"
                                    value={customer.name}
                                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                                <input
                                    type="tel"
                                    value={customer.phone}
                                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={customer.email}
                                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                                <input
                                    type="text"
                                    value={customer.address}
                                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Products */}
                    <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900">Products</h2>
                            <button
                                onClick={addItem}
                                className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-3 p-4 bg-slate-50 rounded-xl">
                                    <div className="flex-1 grid gap-3 sm:grid-cols-4">
                                        <div className="sm:col-span-2">
                                            <select
                                                value={item.product}
                                                onChange={(e) => updateItem(index, 'product', e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                            >
                                                <option value="">Select Product</option>
                                                {products.map((product) => (
                                                    <option key={product._id} value={product._id}>
                                                        {product.name} - ৳{product.sellingPrice}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                placeholder="Qty"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={item.unitPrice}
                                                onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                                                placeholder="Price"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-slate-900 min-w-[80px] text-right">
                                            ৳{item.totalPrice.toFixed(2)}
                                        </span>
                                        <button
                                            onClick={() => removeItem(index)}
                                            disabled={items.length === 1}
                                            className="flex h-9 w-9 items-center justify-center rounded-lg text-danger hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Additional Details */}
                    <section className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Additional Details</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Order Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 ${status === 'completed' ? 'text-emerald-600 bg-emerald-50' :
                                        status === 'pending' ? 'text-amber-600 bg-amber-50' :
                                            'text-red-600 bg-red-50'
                                        }`}
                                >
                                    <option value="pending">Pending (Unpaid)</option>
                                    <option value="partial">Partial</option>
                                    <option value="completed">Completed (Paid)</option>
                                </select>
                                <p className="mt-2 text-xs text-slate-500">
                                    Note: Changing status from <strong>Completed</strong> to <strong>Pending</strong> will restore stock. Changing from <strong>Pending</strong> to <strong>Completed</strong> will deduct stock.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="mobile_banking">Mobile Banking</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Summary Sidebar */}
                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm sticky top-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ShoppingCartIcon className="h-5 w-5 text-brand" />
                            <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
                        </div>

                        <div className="space-y-3 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Subtotal</span>
                                <span className="font-semibold text-slate-900">৳{subtotal.toFixed(2)}</span>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Discount (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={discountPercent}
                                        onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">%</span>
                                </div>
                                {discountAmount > 0 && (
                                    <p className="mt-1 text-xs text-slate-500">= ৳{discountAmount.toFixed(2)} off</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Tax</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={tax}
                                    onChange={(e) => setTax(Number(e.target.value))}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Additional Charges</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={additionalCharges}
                                    onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <div className="flex justify-between text-lg font-bold">
                                <span>Total</span>
                                <span className="text-brand">৳{totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-6 space-y-3">
                            <button
                                onClick={() => handleSubmit(true)}
                                disabled={updating || items.filter((i) => i.product).length === 0}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand to-brand-dark px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/40 transition-all duration-200 hover:shadow-xl hover:shadow-brand/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PrinterIcon className="h-5 w-5" />
                                {updating ? 'Updating...' : 'Update & Print'}
                            </button>
                            <button
                                onClick={() => handleSubmit(false)}
                                disabled={updating || items.filter((i) => i.product).length === 0}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Update Order
                            </button>
                            <button
                                onClick={() => navigate('/invoices')}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditOrderPage;

