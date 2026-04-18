/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useCreateReturnMutation } from '@/services/returnsApi';
import { useGetOrdersQuery, useGetOrderByIdQuery } from '@/services/ordersApi';
import type { Order, OrderItem } from '@/services/ordersApi';

interface ReturnItem {
    itemIndex: number;
    product: string;
    productName: string;
    maxQuantity: number;
    quantity: number;
    unitPrice: number;
}

const ProcessReturnPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [createReturn, { isLoading }] = useCreateReturnMutation();

    const orderIdFromUrl = searchParams.get('orderId');
    const orderNumberFromUrl = searchParams.get('orderNumber');

    const [orderSearch, setOrderSearch] = useState(orderNumberFromUrl || '');
    const [userSelectedOrder, setUserSelectedOrder] = useState<Order | null>(null);
    const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
    const [reason, setReason] = useState('Damaged Product');
    const [notes, setNotes] = useState('');
    const previousOrderId = useRef<string | null>(null);

    // Fetch order by ID if provided in URL
    const { data: orderData } = useGetOrderByIdQuery(orderIdFromUrl || '', { skip: !orderIdFromUrl });

    // Track orderId changes in effect (not during render)
    useEffect(() => {
        if (orderIdFromUrl && orderData) {
            previousOrderId.current = orderIdFromUrl;
        }
    }, [orderIdFromUrl, orderData]);

    // Derive the effective selected order: user selection takes precedence over URL order
    const selectedOrder = useMemo(() => {
        // If user has manually selected an order, use that
        if (userSelectedOrder) {
            return userSelectedOrder;
        }
        // Otherwise, use order from URL if available
        if (orderIdFromUrl && orderData) {
            return orderData;
        }
        return null;
    }, [userSelectedOrder, orderIdFromUrl, orderData]);

    // Derive effective order search: match selected order's order number
    const effectiveOrderSearch = useMemo(() => {
        if (selectedOrder) {
            return selectedOrder.orderNumber;
        }
        return orderSearch;
    }, [selectedOrder, orderSearch]);

    const { data: ordersData } = useGetOrdersQuery({
        search: effectiveOrderSearch
    } as any, { skip: !effectiveOrderSearch });

    // When order is selected, reset return items
    const handleOrderSelect = (order: Order) => {
        setUserSelectedOrder(order);
        setOrderSearch(order.orderNumber);
        setReturnItems([]);
    };

    // Add item to return list
    const handleAddItem = (item: OrderItem, index: number) => {
        // Check if item is already in return list
        if (returnItems.find(ri => ri.itemIndex === index)) {
            toast.error('Item already added');
            return;
        }

        const productId = typeof item.product === 'object' ? (item.product as any)._id : item.product;
        const availableQuantity = item.quantity - (item.returnProducts || 0);

        if (availableQuantity <= 0) {
            toast.error('This item has already been fully returned');
            return;
        }

        setReturnItems([...returnItems, {
            itemIndex: index,
            product: productId,
            productName: item.productName,
            maxQuantity: availableQuantity,
            quantity: Math.min(1, availableQuantity),
            unitPrice: item.unitPrice
        }]);
    };

    // Remove item from return list
    const handleRemoveItem = (itemIndex: number) => {
        setReturnItems(returnItems.filter(ri => ri.itemIndex !== itemIndex));
    };

    // Update return item quantity or price
    const handleUpdateReturnItem = (itemIndex: number, field: 'quantity' | 'unitPrice', value: number) => {
        setReturnItems(returnItems.map(ri => {
            if (ri.itemIndex === itemIndex) {
                if (field === 'quantity' && value > ri.maxQuantity) {
                    toast.error(`Maximum quantity is ${ri.maxQuantity}`);
                    return ri;
                }
                return { ...ri, [field]: value };
            }
            return ri;
        }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!selectedOrder) {
            toast.error('Please select an order');
            return;
        }

        if (returnItems.length === 0) {
            toast.error('Please add at least one item to return');
            return;
        }

        try {
            // Build items array for the return
            const items = returnItems.map(item => ({
                product: item.product,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
                orderItemIndex: item.itemIndex
            }));

            // Calculate subtotal and totalAmount
            const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
            const totalAmount = subtotal;

            // Create a single return with all items
            const returnData = {
                items: items,
                customer: {
                    name: selectedOrder.customer.name,
                    phone: selectedOrder.customer.phone || undefined,
                    email: selectedOrder.customer.email || undefined,
                },
                reason: reason,
                notes: notes || undefined,
                orderNumber: selectedOrder.orderNumber,
                orderId: selectedOrder._id,
                subtotal: subtotal,
                totalAmount: totalAmount
            };

            await createReturn(returnData).unwrap();
            toast.success(`Successfully processed return with ${returnItems.length} item(s)`);
            // Navigate back to returns page
            navigate('/returns');
        } catch (error: any) {
            console.error('Failed to process returns:', error);
            const errorMessage = error?.data?.message || error?.message || 'Please try again.';
            toast.error('Failed to process returns', {
                description: errorMessage,
            });
        }
    };

    const getAvailableQuantity = (item: OrderItem) => {
        return item.quantity - (item.returnProducts || 0);
    };

    const totalReturnAmount = returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/returns')}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand">Order Management</p>
                        <h1 className="mt-1 text-2xl font-bold text-slate-900">Process Return</h1>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Order Search */}
                <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                    <label className="block text-xs font-semibold text-slate-700 mb-2">Search Order</label>
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by Order Number (e.g. ORD-000001)..."
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                            onChange={(e) => {
                                setOrderSearch(e.target.value);
                                if (selectedOrder) {
                                    setUserSelectedOrder(null);
                                    setReturnItems([]);
                                }
                            }}
                            value={selectedOrder ? selectedOrder.orderNumber : orderSearch}
                            onFocus={() => {
                                if (selectedOrder) {
                                    setUserSelectedOrder(null);
                                    setOrderSearch('');
                                    setReturnItems([]);
                                }
                            }}
                        />
                        {!selectedOrder && orderSearch && (ordersData?.result || []).length > 0 && (
                            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-100 bg-white shadow-lg max-h-48 overflow-y-auto">
                                {(ordersData?.result || []).map((order) => (
                                    <button
                                        key={order._id}
                                        type="button"
                                        onClick={() => handleOrderSelect(order)}
                                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 border-b border-slate-50 last:border-none"
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-medium text-slate-900">{order.orderNumber}</span>
                                            <span className="text-[10px] text-slate-500">{dayjs(order.createdAt).format('DD MMM YYYY')}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">{order.customer.name} • {order.items.length} items</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedOrder && (
                        <div className="mt-3 flex items-center gap-3 text-xs">
                            <div>
                                <span className="text-slate-500">Customer:</span>
                                <span className="ml-1.5 font-semibold text-slate-900">{selectedOrder.customer.name}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Phone:</span>
                                <span className="ml-1.5 font-semibold text-slate-900">{selectedOrder.customer.phone || 'N/A'}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Date:</span>
                                <span className="ml-1.5 font-semibold text-slate-900">{dayjs(selectedOrder.createdAt).format('DD MMM YYYY')}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Combined Order and Return Items Table */}
                {selectedOrder && (
                    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold text-slate-700">Order Items</h3>
                            {returnItems.length > 0 && (
                                <span className="text-[10px] text-slate-500">
                                    {returnItems.length} item{returnItems.length !== 1 ? 's' : ''} selected for return
                                </span>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full divide-y divide-slate-200 text-xs">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-2 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-700">Product</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Ordered</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Available</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Return Qty</th>
                                        <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Unit Price</th>
                                        <th className="px-2 py-1.5 text-right text-[9px] font-semibold uppercase tracking-wider text-slate-700">Subtotal</th>
                                        <th className="px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {selectedOrder.items.map((item, idx) => {
                                        const availableQty = getAvailableQuantity(item);
                                        const returnItem = returnItems.find(ri => ri.itemIndex === idx);
                                        const isInReturn = !!returnItem;

                                        return (
                                            <tr key={idx} className={isInReturn ? 'bg-brand/5' : 'hover:bg-slate-50'}>
                                                <td className="px-2 py-1.5 whitespace-nowrap">
                                                    <div className="text-xs font-medium text-slate-900">{item.productName}</div>
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center text-xs text-slate-600">{item.quantity}</td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center text-xs font-semibold text-slate-900">{availableQty}</td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    {isInReturn ? (
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max={returnItem.maxQuantity}
                                                            value={returnItem.quantity}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value);
                                                                if (val > returnItem.maxQuantity) {
                                                                    toast.error(`Maximum quantity is ${returnItem.maxQuantity}`);
                                                                    return;
                                                                }
                                                                handleUpdateReturnItem(returnItem.itemIndex, 'quantity', val);
                                                            }}
                                                            className="w-16 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-center focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                                                            required
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                    {isInReturn ? (
                                                        <div className="relative inline-block">
                                                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500 text-[9px]">৳</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={returnItem.unitPrice}
                                                                onChange={(e) => handleUpdateReturnItem(returnItem.itemIndex, 'unitPrice', Number(e.target.value))}
                                                                className="w-20 rounded border border-slate-200 bg-white pl-5 pr-1.5 py-1 text-xs text-right focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                                                                required
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-600">৳{item.unitPrice}</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-right">
                                                    {isInReturn ? (
                                                        <div className="text-xs font-semibold text-green-600">
                                                            ৳{(returnItem.quantity * returnItem.unitPrice).toFixed(2)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                    {isInReturn ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(idx)}
                                                            className="inline-flex items-center px-1.5 py-1 rounded text-[9px] text-danger hover:bg-red-50 transition"
                                                            title="Remove from return"
                                                        >
                                                            <TrashIcon className="h-3 w-3" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddItem(item, idx)}
                                                            disabled={availableQty <= 0}
                                                            className="inline-flex items-center px-2 py-1 rounded text-[9px] font-semibold text-white bg-brand hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title="Add to return"
                                                        >
                                                            Add
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {returnItems.length > 0 && (
                                    <tfoot className="bg-brand/5">
                                        <tr>
                                            <td colSpan={5} className="px-2 py-1.5 text-right text-[9px] font-semibold text-slate-900">
                                                Total Return Amount:
                                            </td>
                                            <td className="px-2 py-1.5 text-right">
                                                <div className="text-xs font-bold text-brand">৳{totalReturnAmount.toFixed(2)}</div>
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* Reason and Notes */}
                {returnItems.length > 0 && (
                    <div className="rounded-xl border border-slate-200/60 bg-white p-3 shadow-sm">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Return Reason <span className="text-danger">*</span></label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                                    required
                                >
                                    <option value="Damaged Product">Damaged Product</option>
                                    <option value="Wrong Item">Wrong Item</option>
                                    <option value="Defective">Defective</option>
                                    <option value="Customer Changed Mind">Customer Changed Mind</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Order Number</label>
                                <input
                                    type="text"
                                    value={selectedOrder?.orderNumber || ''}
                                    readOnly
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs cursor-not-allowed opacity-75"
                                />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes (Optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 resize-none"
                                placeholder="Additional notes about the return..."
                            />
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {returnItems.length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/returns')}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || returnItems.length === 0 || !selectedOrder}
                            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Processing...' : `Process ${returnItems.length} Return(s)`}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default ProcessReturnPage;

