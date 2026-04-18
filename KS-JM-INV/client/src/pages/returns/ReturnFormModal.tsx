/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState } from 'react';
import { XMarkIcon, CheckCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import type { Return } from '@/services/returnsApi';
import type { Product } from '@/services/productsApi';
import { useGetOrdersQuery } from '@/services/ordersApi';
import type { Order, OrderItem } from '@/services/ordersApi';

interface ReturnItem {
    itemIndex: number;
    product: string;
    productName: string;
    maxQuantity: number;
    quantity: number;
    unitPrice: number;
}

interface ReturnFormModalProps {
    isOpen: boolean;
    editingReturn: Return | null;
    selectedProduct: Product | null;
    onClose: () => void;
    onSubmit: (data: {
        product: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        reason: string;
        customer: {
            name: string;
            phone: string;
            email: string;
        };
        notes: string;
        orderNumber: string;
        orderId?: string;
        orderItemIndex?: number;
    }) => Promise<void>;
    isLoading: boolean;
}

const ReturnFormModal = ({
    isOpen,
    selectedProduct: _initialSelectedProduct,
    onClose,
    onSubmit,
    isLoading
}: ReturnFormModalProps) => {
    const [orderSearch, setOrderSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
    const [reason, setReason] = useState('Damaged Product');
    const [notes, setNotes] = useState('');

    const { data: ordersData } = useGetOrdersQuery({
        search: orderSearch
    } as any, { skip: !orderSearch });

    if (!isOpen) return null;

    // When order is selected, reset return items
    const handleOrderSelect = (order: Order) => {
        setSelectedOrder(order);
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

            await onSubmit(returnData as any);
            toast.success(`Successfully processed return with ${returnItems.length} item(s)`);
            // Reset form
            setSelectedOrder(null);
            setOrderSearch('');
            setReturnItems([]);
            setReason('Damaged Product');
            setNotes('');
            onClose();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Process Return</h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Order Selection */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700">Search Order</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by Order Number (e.g. ORD-000001)..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                onChange={(e) => {
                                    setOrderSearch(e.target.value);
                                    if (selectedOrder) {
                                        setSelectedOrder(null);
                                        setReturnItems([]);
                                    }
                                }}
                                value={selectedOrder ? selectedOrder.orderNumber : orderSearch}
                                onFocus={() => {
                                    if (selectedOrder) {
                                        setSelectedOrder(null);
                                        setOrderSearch('');
                                        setReturnItems([]);
                                    }
                                }}
                            />
                            {!selectedOrder && orderSearch && (ordersData?.result || []).length > 0 && (
                                <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-100 bg-white shadow-lg max-h-60 overflow-y-auto">
                                    {(ordersData?.result || []).map((order) => (
                                        <button
                                            key={order._id}
                                            type="button"
                                            onClick={() => handleOrderSelect(order)}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 border-b border-slate-50 last:border-none"
                                        >
                                            <div className="flex justify-between">
                                                <span className="font-medium text-slate-900">{order.orderNumber}</span>
                                                <span className="text-xs text-slate-500">{dayjs(order.createdAt).format('DD MMM YYYY')}</span>
                                            </div>
                                            <div className="text-xs text-slate-500">{order.customer.name} • {order.items.length} items</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Customer Info (when order selected) */}
                    {selectedOrder && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-bold text-slate-900 mb-2">Customer Information</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-slate-500">Name:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{selectedOrder.customer.name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Phone:</span>
                                    <span className="ml-2 font-semibold text-slate-900">{selectedOrder.customer.phone || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Select Items to Return */}
                    {selectedOrder && (
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-slate-700">Select Items to Return</label>
                            <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                                {selectedOrder.items.map((item, idx) => {
                                    const availableQty = getAvailableQuantity(item);
                                    const isAdded = returnItems.find(ri => ri.itemIndex === idx);
                                    
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                                                isAdded
                                                    ? 'border-brand bg-brand/5'
                                                    : availableQty > 0
                                                        ? 'border-slate-200 hover:border-slate-300 hover:bg-white cursor-pointer'
                                                        : 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                                            }`}
                                        >
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900">{item.productName}</p>
                                                <p className="text-xs text-slate-500">
                                                    Ordered: {item.quantity} • 
                                                    Returned: {item.returnProducts || 0} • 
                                                    Available: {availableQty} • 
                                                    Price: ৳{item.unitPrice}
                                                </p>
                                            </div>
                                            {isAdded ? (
                                                <div className="flex items-center gap-2">
                                                    <CheckCircleIcon className="h-5 w-5 text-brand" />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-danger transition"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddItem(item, idx)}
                                                    disabled={availableQty <= 0}
                                                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Add
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Return Items List with Quantity/Price Inputs */}
                    {returnItems.length > 0 && (
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-slate-700">Return Details</label>
                            <div className="space-y-3">
                                {returnItems.map((returnItem) => (
                                    <div key={returnItem.itemIndex} className="rounded-xl border border-slate-200 bg-white p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="font-semibold text-slate-900">{returnItem.productName}</p>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(returnItem.itemIndex)}
                                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-danger transition"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                    Quantity (Max: {returnItem.maxQuantity})
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={returnItem.maxQuantity}
                                                    value={returnItem.quantity}
                                                    onChange={(e) => handleUpdateReturnItem(returnItem.itemIndex, 'quantity', Number(e.target.value))}
                                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                                    Return Unit Price (৳)
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">৳</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={returnItem.unitPrice}
                                                        onChange={(e) => handleUpdateReturnItem(returnItem.itemIndex, 'unitPrice', Number(e.target.value))}
                                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-right text-sm text-slate-600">
                                            Subtotal: <span className="font-semibold text-slate-900">৳{(returnItem.quantity * returnItem.unitPrice).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Total */}
                            <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-slate-900">Total Return Amount</span>
                                    <span className="text-xl font-bold text-brand">৳{totalReturnAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reason and Notes (only show when items are selected) */}
                    {returnItems.length > 0 && (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Reason</label>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
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
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Order Number</label>
                                    <input
                                        type="text"
                                        value={selectedOrder?.orderNumber || ''}
                                        readOnly
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm cursor-not-allowed opacity-75"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
                                    placeholder="Additional notes about the return..."
                                />
                            </div>
                        </>
                    )}

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || returnItems.length === 0 || !selectedOrder}
                            className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Processing...' : `Process ${returnItems.length} Return(s)`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReturnFormModal;
