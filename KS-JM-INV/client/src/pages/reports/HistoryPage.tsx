/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import { useGetProductsQuery } from '@/services/productsApi';
import { useGetOrdersQuery } from '@/services/ordersApi';
import { useGetPurchasesQuery } from '@/services/purchasesApi';
import { useGetDamagesQuery } from '@/services/damagesApi';
import { useGetReturnsQuery } from '@/services/returnsApi';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

type HistoryTab = 'sales' | 'netsale' | 'purchases' | 'damages' | 'returns';

const HistoryPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [activeTabs, setActiveTabs] = useState<Record<string, HistoryTab>>({});

    // Fetch all data
    const { data: productsData, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useGetProductsQuery({ limit: 10000 });
    const { data: ordersData, isLoading: ordersLoading } = useGetOrdersQuery({ limit: 10000 });
    const { data: purchasesData, isLoading: purchasesLoading } = useGetPurchasesQuery({ limit: 10000 });
    const { data: damagesData, isLoading: damagesLoading } = useGetDamagesQuery({ limit: 10000 });
    const { data: returnsData, isLoading: returnsLoading } = useGetReturnsQuery({ limit: 10000 });

    const isLoading = productsLoading || ordersLoading || purchasesLoading || damagesLoading || returnsLoading;

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        if (!productsData?.products) return [];
        
        if (!searchQuery.trim()) {
            return productsData.products;
        }
        
        const query = searchQuery.toLowerCase().trim();
        return productsData.products.filter((product: any) => {
            const name = product.name?.toLowerCase() || '';
            const sku = product.sku?.toLowerCase() || '';
            const category = product.categoryName?.toLowerCase() || '';
            
            return (
                name.includes(query) ||
                sku.includes(query) ||
                category.includes(query)
            );
        });
    }, [productsData, searchQuery]);

    // Get product history
    const getProductHistory = (productId: string) => {
        const sales: any[] = [];
        const purchases: any[] = [];
        const damages: any[] = [];
        const returns: any[] = [];

        // Process sales (orders)
        if (ordersData?.result) {
            ordersData.result.forEach((order: any) => {
                order.items?.forEach((item: any) => {
                    const itemProductId = typeof item.product === 'string' ? item.product : item.product?._id;
                    if (itemProductId === productId) {
                        sales.push({
                            ...item,
                            orderNumber: order.orderNumber,
                            orderDate: order.createdAt,
                            customer: order.customer,
                            type: 'sale'
                        });
                    }
                });
            });
        }

        // Process purchases
        if (purchasesData?.result) {
            purchasesData.result.forEach((purchase: any) => {
                purchase.items?.forEach((item: any) => {
                    const itemProductId = typeof item.product === 'string' ? item.product : item.product?._id;
                    if (itemProductId === productId) {
                        purchases.push({
                            ...item,
                            purchaseNumber: purchase.purchaseNumber,
                            purchaseDate: purchase.createdAt,
                            supplier: purchase.supplier,
                            type: 'purchase'
                        });
                    }
                });
            });
        }

        // Process damages
        if (damagesData?.damages) {
            damagesData.damages.forEach((damage: any) => {
                damage.items?.forEach((item: any) => {
                    const itemProductId = typeof item.product === 'string' ? item.product : item.product?._id;
                    if (itemProductId === productId) {
                        damages.push({
                            ...item,
                            damageNumber: damage.damageNumber,
                            damageDate: damage.createdAt,
                            type: 'damage'
                        });
                    }
                });
            });
        }

        // Process returns
        if (returnsData?.returns) {
            returnsData.returns.forEach((returnItem: any) => {
                returnItem.items?.forEach((item: any) => {
                    const itemProductId = typeof item.product === 'string' ? item.product : item.product?._id;
                    if (itemProductId === productId) {
                        returns.push({
                            ...item,
                            returnNumber: returnItem.returnNumber,
                            returnDate: returnItem.createdAt,
                            orderNumber: returnItem.orderNumber || (typeof returnItem.order === 'object' ? returnItem.order?.orderNumber : null),
                            customer: returnItem.customer,
                            reason: returnItem.reason,
                            type: 'return'
                        });
                    }
                });
            });
        }

        // Calculate net sales (sales with returns deducted)
        const netSales: any[] = [];
        sales.forEach((sale) => {
            // Find returns for this sale
            const saleReturns = returns.filter((ret: any) => {
                // Match by order number or check if return is from same order
                return ret.orderNumber === sale.orderNumber || ret.returnDate >= sale.orderDate;
            });

            // Calculate total returned quantity for this sale
            const returnedQty = saleReturns.reduce((sum, ret) => {
                // Check if return is from the same order item
                if (ret.orderNumber === sale.orderNumber || 
                    (ret.orderDate && sale.orderDate && new Date(ret.returnDate) >= new Date(sale.orderDate))) {
                    return sum + (ret.quantity || 0);
                }
                return sum;
            }, 0);

            const netQty = (sale.quantity || 0) - returnedQty;
            const saleQty = sale.quantity || 0;

            // Show all sales, even if fully returned
            netSales.push({
                ...sale,
                saleQuantity: saleQty,
                returnedQty: returnedQty,
                quantity: Math.max(0, netQty), // Ensure non-negative
                totalPrice: Math.max(0, netQty) * (sale.unitPrice || 0),
                originalTotalPrice: saleQty * (sale.unitPrice || 0)
            });
        });

        return { sales, purchases, damages, returns, netSales };
    };

    const toggleProduct = (productId: string) => {
        const newExpanded = new Set(expandedProducts);
        if (newExpanded.has(productId)) {
            newExpanded.delete(productId);
        } else {
            newExpanded.add(productId);
            // Set default tab to sales if not set
            if (!activeTabs[productId]) {
                setActiveTabs({ ...activeTabs, [productId]: 'sales' });
            }
        }
        setExpandedProducts(newExpanded);
    };

    const setActiveTab = (productId: string, tab: HistoryTab) => {
        setActiveTabs({ ...activeTabs, [productId]: tab });
    };

    if (isLoading) return <Loader fullScreen message="Loading history..." />;
    if (productsError) return <ErrorState description="Unable to load history" onRetry={refetchProducts} />;

    return (
        <div className="space-y-4">
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-brand">Reports</p>
                <h1 className="mt-1 text-xl font-bold text-slate-900">History</h1>
            </div>

            {/* Search */}
            <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 pl-7 text-[10px] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
                    />
                    <svg
                        className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </div>
            </div>

            {/* Main Products Table */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 w-6"></th>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Product</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700">SKU</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Category</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Stock</th>
                                <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Price</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Sales</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Net Sale</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Purchases</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Damages</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Returns</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-2 py-3 text-center text-[10px] text-slate-500">
                                        {searchQuery ? 'No products found matching your search' : 'No products found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product: any) => {
                                    const isExpanded = expandedProducts.has(product._id);
                                    const history = getProductHistory(product._id);
                                    const totalSales = history.sales.reduce((sum, s) => sum + (s.quantity || 0), 0);
                                    const totalPurchases = history.purchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
                                    const totalDamages = history.damages.reduce((sum, d) => sum + (d.quantity || 0), 0);
                                    const totalReturns = history.returns.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const netSale = totalSales - totalReturns;

                                    return (
                                        <>
                                            <tr key={product._id} className="hover:bg-slate-50">
                                                <td className="px-2 py-1.5">
                                                    <button
                                                        onClick={() => toggleProduct(product._id)}
                                                        className="text-slate-400 hover:text-slate-600"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronUpIcon className="h-3 w-3" />
                                                        ) : (
                                                            <ChevronDownIcon className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-2 py-1.5 font-medium text-slate-900">{product.name}</td>
                                                <td className="px-2 py-1.5 text-slate-600">{product.sku || '-'}</td>
                                                <td className="px-2 py-1.5 text-slate-600">{product.categoryName || '-'}</td>
                                                <td className="px-2 py-1.5 text-center text-slate-900 font-semibold">{product.stockQuantity}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-600">৳{product.sellingPrice?.toLocaleString()}</td>
                                                <td className="px-2 py-1.5 text-center text-blue-600">{totalSales}</td>
                                                <td className="px-2 py-1.5 text-center font-semibold text-purple-600">{netSale}</td>
                                                <td className="px-2 py-1.5 text-center text-green-600">{totalPurchases}</td>
                                                <td className="px-2 py-1.5 text-center text-red-600">{totalDamages}</td>
                                                <td className="px-2 py-1.5 text-center text-orange-600">{totalReturns}</td>
                                            </tr>
                                            {isExpanded && (() => {
                                                const activeTab = activeTabs[product._id] || 'sales';
                                                return (
                                                    <tr>
                                                        <td colSpan={11} className="px-0 py-0 bg-slate-50">
                                                            <div className="p-2">
                                                                {/* Tabs */}
                                                                <div className="flex gap-1 mb-2 border-b border-slate-200">
                                                                    {[
                                                                        { id: 'sales' as HistoryTab, label: 'Sales', count: history.sales.length },
                                                                        { id: 'netsale' as HistoryTab, label: 'Net Sale', count: history.netSales?.length || 0 },
                                                                        { id: 'purchases' as HistoryTab, label: 'Purchases', count: history.purchases.length },
                                                                        { id: 'damages' as HistoryTab, label: 'Damages', count: history.damages.length },
                                                                        { id: 'returns' as HistoryTab, label: 'Returns', count: history.returns.length },
                                                                    ].map((tab) => {
                                                                        const isActive = activeTab === tab.id;
                                                                        let activeClasses = '';
                                                                        if (isActive) {
                                                                            if (tab.id === 'sales') activeClasses = 'bg-blue-50 text-blue-700 border-b-2 border-blue-500';
                                                                            else if (tab.id === 'netsale') activeClasses = 'bg-purple-50 text-purple-700 border-b-2 border-purple-500';
                                                                            else if (tab.id === 'purchases') activeClasses = 'bg-green-50 text-green-700 border-b-2 border-green-500';
                                                                            else if (tab.id === 'damages') activeClasses = 'bg-red-50 text-red-700 border-b-2 border-red-500';
                                                                            else if (tab.id === 'returns') activeClasses = 'bg-orange-50 text-orange-700 border-b-2 border-orange-500';
                                                                        }
                                                                        return (
                                                                            <button
                                                                                key={tab.id}
                                                                                onClick={() => setActiveTab(product._id, tab.id)}
                                                                                className={`px-2 py-1 text-[9px] font-semibold rounded-t transition-colors ${
                                                                                    isActive
                                                                                        ? activeClasses
                                                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                                                }`}
                                                                            >
                                                                                {tab.label} ({tab.count})
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Tab Content */}
                                                                <div className="mt-2">
                                                                    {/* Sales History */}
                                                                    {activeTab === 'sales' && (
                                                                        <div className="overflow-x-auto">
                                                                            {history.sales.length === 0 ? (
                                                                                <p className="text-[9px] text-slate-500 text-center py-3">No sales history</p>
                                                                            ) : (
                                                                                <table className="w-full text-[9px]">
                                                                                    <thead className="bg-blue-50">
                                                                                        <tr>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Date</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Order #</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Customer</th>
                                                                                            <th className="px-1.5 py-1 text-center font-semibold text-slate-700">Qty</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Unit Price</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Total</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-200 bg-white">
                                                                                        {history.sales.map((sale: any, idx: number) => (
                                                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                                                <td className="px-1.5 py-1 text-slate-600">{dayjs(sale.orderDate).format('DD MMM YY')}</td>
                                                                                                <td className="px-1.5 py-1 font-medium text-slate-900">{sale.orderNumber}</td>
                                                                                                <td className="px-1.5 py-1 text-slate-600">{sale.customer?.name || 'N/A'}</td>
                                                                                                <td className="px-1.5 py-1 text-center text-slate-600">{sale.quantity}</td>
                                                                                                <td className="px-1.5 py-1 text-right text-slate-600">৳{sale.unitPrice?.toLocaleString()}</td>
                                                                                                <td className="px-1.5 py-1 text-right font-semibold text-blue-600">৳{sale.totalPrice?.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Net Sale History */}
                                                                    {activeTab === 'netsale' && (
                                                                        <div className="overflow-x-auto">
                                                                            {!history.netSales || history.netSales.length === 0 ? (
                                                                                <p className="text-[9px] text-slate-500 text-center py-3">No net sale history</p>
                                                                            ) : (
                                                                                <table className="w-full text-[9px]">
                                                                                    <thead className="bg-purple-50">
                                                                                        <tr>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Date</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Order #</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Customer</th>
                                                                                            <th className="px-1.5 py-1 text-center font-semibold text-slate-700">Sale</th>
                                                                                            <th className="px-1.5 py-1 text-center font-semibold text-slate-700">Return</th>
                                                                                            <th className="px-1.5 py-1 text-center font-semibold text-slate-700">Net Sale</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Unit Price</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Net Total</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-200 bg-white">
                                                                                        {history.netSales.map((sale: any, idx: number) => (
                                                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                                                <td className="px-1.5 py-1 text-slate-600">{dayjs(sale.orderDate).format('DD MMM YY')}</td>
                                                                                                <td className="px-1.5 py-1 font-medium text-slate-900">{sale.orderNumber}</td>
                                                                                                <td className="px-1.5 py-1 text-slate-600">{sale.customer?.name || 'N/A'}</td>
                                                                                                <td className="px-1.5 py-1 text-center text-blue-600">{sale.saleQuantity || sale.quantity + (sale.returnedQty || 0)}</td>
                                                                                                <td className="px-1.5 py-1 text-center text-orange-600">
                                                                                                    {sale.returnedQty > 0 ? `-${sale.returnedQty}` : '-'}
                                                                                                </td>
                                                                                                <td className="px-1.5 py-1 text-center font-semibold text-purple-600">{sale.quantity}</td>
                                                                                                <td className="px-1.5 py-1 text-right text-slate-600">৳{sale.unitPrice?.toLocaleString()}</td>
                                                                                                <td className="px-1.5 py-1 text-right font-semibold text-purple-600">৳{sale.totalPrice?.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Purchases History */}
                                                                    {activeTab === 'purchases' && (
                                                                        <div className="overflow-x-auto">
                                                                            {history.purchases.length === 0 ? (
                                                                                <p className="text-[9px] text-slate-500 text-center py-3">No purchase history</p>
                                                                            ) : (
                                                                                <table className="w-full text-[9px]">
                                                                                    <thead className="bg-green-50">
                                                                                        <tr>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Date</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Purchase #</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Supplier</th>
                                                                                            <th className="px-1.5 py-1 text-center font-semibold text-slate-700">Qty</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Unit Price</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Total</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-200 bg-white">
                                                                                        {history.purchases.map((purchase: any, idx: number) => (
                                                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                                                <td className="px-1.5 py-1 text-slate-600">{dayjs(purchase.purchaseDate).format('DD MMM YY')}</td>
                                                                                                <td className="px-1.5 py-1 font-medium text-slate-900">{purchase.purchaseNumber}</td>
                                                                                                <td className="px-1.5 py-1 text-slate-600">
                                                                                                    {typeof purchase.supplier === 'object' ? purchase.supplier?.name : purchase.supplier || 'N/A'}
                                                                                                </td>
                                                                                                <td className="px-1.5 py-1 text-center text-slate-600">{purchase.quantity}</td>
                                                                                                <td className="px-1.5 py-1 text-right text-slate-600">৳{purchase.unitPrice?.toLocaleString()}</td>
                                                                                                <td className="px-1.5 py-1 text-right font-semibold text-green-600">৳{purchase.totalPrice?.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Damages History */}
                                                                    {activeTab === 'damages' && (
                                                                        <div className="overflow-x-auto">
                                                                            {history.damages.length === 0 ? (
                                                                                <p className="text-[9px] text-slate-500 text-center py-3">No damage history</p>
                                                                            ) : (
                                                                                <table className="w-full text-[9px]">
                                                                                    <thead className="bg-red-50">
                                                                                        <tr>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Date</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Damage #</th>
                                                                                            <th className="px-1.5 py-1 text-center font-semibold text-slate-700">Qty</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Type</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Unit Cost</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Total Loss</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-200 bg-white">
                                                                                        {history.damages.map((damage: any, idx: number) => (
                                                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                                                <td className="px-1.5 py-1 text-slate-600">{dayjs(damage.damageDate).format('DD MMM YY')}</td>
                                                                                                <td className="px-1.5 py-1 font-medium text-slate-900">{damage.damageNumber}</td>
                                                                                                <td className="px-1.5 py-1 text-center text-red-600 font-semibold">{damage.quantity}</td>
                                                                                                <td className="px-1.5 py-1 text-slate-600 capitalize">{damage.damageType || 'N/A'}</td>
                                                                                                <td className="px-1.5 py-1 text-right text-slate-600">৳{damage.unitCost?.toLocaleString()}</td>
                                                                                                <td className="px-1.5 py-1 text-right font-semibold text-red-600">৳{damage.totalLoss?.toLocaleString()}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Returns History */}
                                                                    {activeTab === 'returns' && (
                                                                        <div className="overflow-x-auto">
                                                                            {history.returns.length === 0 ? (
                                                                                <p className="text-[9px] text-slate-500 text-center py-3">No return history</p>
                                                                            ) : (
                                                                                <table className="w-full text-[9px]">
                                                                                    <thead className="bg-orange-50">
                                                                                        <tr>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Date</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Return #</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Customer</th>
                                                                                            <th className="px-1.5 py-1 text-center font-semibold text-slate-700">Qty</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Unit Price</th>
                                                                                            <th className="px-1.5 py-1 text-right font-semibold text-slate-700">Total</th>
                                                                                            <th className="px-1.5 py-1 text-left font-semibold text-slate-700">Reason</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-200 bg-white">
                                                                                        {history.returns.map((returnItem: any, idx: number) => (
                                                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                                                <td className="px-1.5 py-1 text-slate-600">{dayjs(returnItem.returnDate).format('DD MMM YY')}</td>
                                                                                                <td className="px-1.5 py-1 font-medium text-slate-900">{returnItem.returnNumber}</td>
                                                                                                <td className="px-1.5 py-1 text-slate-600">{returnItem.customer?.name || 'N/A'}</td>
                                                                                                <td className="px-1.5 py-1 text-center text-slate-600">{returnItem.quantity}</td>
                                                                                                <td className="px-1.5 py-1 text-right text-slate-600">৳{returnItem.unitPrice?.toLocaleString()}</td>
                                                                                                <td className="px-1.5 py-1 text-right font-semibold text-orange-600">৳{returnItem.totalPrice?.toLocaleString()}</td>
                                                                                                <td className="px-1.5 py-1 text-slate-600">{returnItem.reason || 'N/A'}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HistoryPage;

