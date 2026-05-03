/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import Loader from '@/components/common/Loader';
import ErrorState from '@/components/common/ErrorState';
import { useGetProductsQuery } from '@/services/productsApi';
import { useGetOrdersQuery } from '@/services/ordersApi';
import { useGetPurchasesQuery } from '@/services/purchasesApi';
import { useGetDamagesQuery } from '@/services/damagesApi';
import { useGetReturnsQuery } from '@/services/returnsApi';
import { ChevronDownIcon, ChevronUpIcon, PrinterIcon, TableCellsIcon } from '@heroicons/react/24/outline';

const StockReportPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const limit = 20;
    const reportRef = useRef<HTMLDivElement>(null);

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

    const paginatedProducts = useMemo(() => filteredProducts.slice((page - 1) * limit, page * limit), [filteredProducts, page]);

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

        return { sales, purchases, damages, returns };
    };

    const toggleProduct = (productId: string) => {
        const newExpanded = new Set(expandedProducts);
        if (newExpanded.has(productId)) {
            newExpanded.delete(productId);
        } else {
            newExpanded.add(productId);
        }
        setExpandedProducts(newExpanded);
    };

    const handlePrint = useReactToPrint({
        contentRef: reportRef,
        documentTitle: `Stock_Report_${dayjs().format('YYYY-MM-DD')}`,
        pageStyle: `@page { size: A4 landscape; margin: 12mm; }`,
    });

    const handleDownloadExcel = () => {
        const headers = [
            'Product',
            'SKU',
            'Category',
            'Stock',
            'Purchase Price',
            'Selling Price',
            'Sales',
            'Purchases',
            'Damages',
            'Purchase Subtotal',
            'Selling Subtotal',
        ];
        const rows = filteredProducts.map((product: any) => {
            const history = getProductHistory(product._id);
            const totalSalesQty = history.sales.reduce((sum, s) => sum + (s.quantity || 0), 0);
            const totalReturns = history.returns.reduce((sum, r) => sum + (r.quantity || 0), 0);
            const totalSales = totalSalesQty - totalReturns;
            const totalPurchases = history.purchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
            const totalDamages = history.damages.reduce((sum, d) => sum + (d.quantity || 0), 0);
            const purchaseSubtotal =
                product.purchasePrice != null && product.stockQuantity != null
                    ? product.stockQuantity * product.purchasePrice
                    : '';
            const sellingSubtotal =
                product.sellingPrice != null && product.stockQuantity != null
                    ? product.stockQuantity * product.sellingPrice
                    : '';
            return [
                product.name ?? '',
                product.sku ?? '-',
                product.categoryName ?? '-',
                product.stockQuantity ?? 0,
                product.purchasePrice ?? '',
                product.sellingPrice ?? '',
                totalSales,
                totalPurchases,
                totalDamages,
                purchaseSubtotal,
                sellingSubtotal,
            ];
        });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
        XLSX.writeFile(wb, `Stock_Report_${dayjs().format('YYYY-MM-DD_HH-mm')}.xlsx`);
    };

    if (isLoading) return <Loader fullScreen message="Loading stock report..." />;
    if (productsError) return <ErrorState description="Unable to load stock report" onRetry={refetchProducts} />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); setExpandedProducts(new Set()); }}
                            placeholder="Search products..."
                            className="w-64 rounded border border-slate-200 bg-white px-2 py-1.5 pl-7 text-[10px] focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20"
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
                    <button
                        type="button"
                        onClick={handleDownloadExcel}
                        className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand/20"
                    >
                        <TableCellsIcon className="h-3.5 w-3.5" />
                        Download Excel
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePrint()}
                        className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand/20"
                    >
                        <PrinterIcon className="h-3.5 w-3.5" />
                        Print
                    </button>
                </div>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-brand">Reports</p>
                    <h1 className="mt-1 text-xl font-bold text-slate-900">Stock Report</h1>
                </div>
            </div>

            {/* Main Products Table - PDF and Print content (table only, no source/search) */}
            <div ref={reportRef} className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 w-6"></th>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700 w-8">S/N</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Product</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700">SKU</th>
                                <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Category</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Stock</th>
                                <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Purchase Price</th>
                                <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Selling Price</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Sales</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Purchases</th>
                                <th className="px-2 py-1.5 text-center font-semibold text-slate-700">Damages</th>
                                <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Purchase Subtotal</th>
                                <th className="px-2 py-1.5 text-right font-semibold text-slate-700">Selling Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-2 py-3 text-center text-[10px] text-slate-500">
                                        {searchQuery ? 'No products found matching your search' : 'No products found'}
                                    </td>
                                </tr>
                            ) : (
                                paginatedProducts.map((product: any, idx: number) => {
                                    const isExpanded = expandedProducts.has(product._id);
                                    const history = getProductHistory(product._id);
                                    const totalSalesQty = history.sales.reduce((sum, s) => sum + (s.quantity || 0), 0);
                                    const totalReturns = history.returns.reduce((sum, r) => sum + (r.quantity || 0), 0);
                                    const totalSales = totalSalesQty - totalReturns; // Net Sales (Sale - Return)
                                    const totalPurchases = history.purchases.reduce((sum, p) => sum + (p.quantity || 0), 0);
                                    const totalDamages = history.damages.reduce((sum, d) => sum + (d.quantity || 0), 0);

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
                                                <td className="px-2 py-1.5 text-slate-400 text-xs">{(page - 1) * limit + idx + 1}</td>
                                                <td className="px-2 py-1.5 font-medium text-slate-900">{product.name}</td>
                                                <td className="px-2 py-1.5 text-slate-600">{product.sku || '-'}</td>
                                                <td className="px-2 py-1.5 text-slate-600">{product.categoryName || '-'}</td>
                                                <td className="px-2 py-1.5 text-center text-slate-900 font-semibold">{product.stockQuantity}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-600">
                                                    {product.purchasePrice ? `৳${product.purchasePrice.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-2 py-1.5 text-right text-brand font-medium">
                                                    {product.sellingPrice ? `৳${product.sellingPrice.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="px-2 py-1.5 text-center text-purple-600 font-semibold">{totalSales}</td>
                                                <td className="px-2 py-1.5 text-center text-green-600">{totalPurchases}</td>
                                                <td className="px-2 py-1.5 text-center text-red-600">{totalDamages}</td>
                                                <td className="px-2 py-1.5 text-right text-slate-600">
                                                    {product.purchasePrice != null && product.stockQuantity != null
                                                        ? `৳${(product.stockQuantity * product.purchasePrice).toLocaleString()}`
                                                        : '-'}
                                                </td>
                                                <td className="px-2 py-1.5 text-right text-brand font-medium">
                                                    {product.sellingPrice != null && product.stockQuantity != null
                                                        ? `৳${(product.stockQuantity * product.sellingPrice).toLocaleString()}`
                                                        : '-'}
                                                </td>
                                            </tr>
                                            {isExpanded && (() => {
                                                // Calculate net sales for display
                                                const returnsByOrder = new Map<string, number>();
                                                history.returns.forEach((ret: any) => {
                                                    const orderNum = ret.orderNumber || '';
                                                    if (orderNum) {
                                                        const currentQty = returnsByOrder.get(orderNum) || 0;
                                                        returnsByOrder.set(orderNum, currentQty + (ret.quantity || 0));
                                                    }
                                                });

                                                const netSalesList = history.sales.map((sale: any) => {
                                                    const orderNum = sale.orderNumber || '';
                                                    const returnedQty = returnsByOrder.get(orderNum) || 0;
                                                    const saleQty = sale.quantity || 0;
                                                    const netQty = saleQty - returnedQty;
                                                    return {
                                                        ...sale,
                                                        saleQuantity: saleQty,
                                                        returnedQty: returnedQty,
                                                        quantity: Math.max(0, netQty),
                                                        totalPrice: Math.max(0, netQty) * (sale.unitPrice || 0)
                                                    };
                                                });

                                                return (
                                                    <tr>
                                                        <td colSpan={13} className="px-0 py-0 bg-slate-50">
                                                            <div className="p-2 space-y-4">
                                                                {/* Sales (Sale - Return) */}
                                                                <div>
                                                                    <h3 className="text-[10px] font-bold text-purple-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                                                                        <span className="w-3 h-3 rounded bg-purple-500"></span>
                                                                        Sales (Sale - Return)
                                                                    </h3>
                                                                    {netSalesList.length === 0 ? (
                                                                        <p className="text-[9px] text-slate-500 text-center py-3">No sales history</p>
                                                                    ) : (
                                                                        <div className="overflow-x-auto">
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
                                                                                    {netSalesList.map((sale: any, idx: number) => (
                                                                                        <tr key={idx} className="hover:bg-slate-50">
                                                                                            <td className="px-1.5 py-1 text-slate-600">{dayjs(sale.orderDate).format('DD MMM YY')}</td>
                                                                                            <td className="px-1.5 py-1 font-medium text-slate-900">{sale.orderNumber}</td>
                                                                                            <td className="px-1.5 py-1 text-slate-600">{sale.customer?.name || 'N/A'}</td>
                                                                                            <td className="px-1.5 py-1 text-center text-blue-600">{sale.saleQuantity}</td>
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
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Purchases */}
                                                                <div>
                                                                    <h3 className="text-[10px] font-bold text-green-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                                                                        <span className="w-3 h-3 rounded bg-green-500"></span>
                                                                        Purchases
                                                                    </h3>
                                                                    {history.purchases.length === 0 ? (
                                                                        <p className="text-[9px] text-slate-500 text-center py-3">No purchase history</p>
                                                                    ) : (
                                                                        <div className="overflow-x-auto">
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
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Damages */}
                                                                <div>
                                                                    <h3 className="text-[10px] font-bold text-red-700 mb-2 uppercase tracking-wide flex items-center gap-2">
                                                                        <span className="w-3 h-3 rounded bg-red-500"></span>
                                                                        Damages
                                                                    </h3>
                                                                    {history.damages.length === 0 ? (
                                                                        <p className="text-[9px] text-slate-500 text-center py-3">No damage history</p>
                                                                    ) : (
                                                                        <div className="overflow-x-auto">
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
            {filteredProducts.length > limit && (
                <div className="flex items-center justify-between pt-3 print:hidden">
                    <p className="text-xs text-slate-500">
                        Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span>–<span className="font-semibold text-slate-900">{Math.min(page * limit, filteredProducts.length)}</span> of{' '}
                        <span className="font-semibold text-slate-900">{filteredProducts.length}</span>
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Prev</button>
                        <span className="text-xs font-semibold text-slate-700">Page {page} of {Math.ceil(filteredProducts.length / limit)}</span>
                        <button onClick={() => setPage(p => Math.min(Math.ceil(filteredProducts.length / limit), p + 1))} disabled={page >= Math.ceil(filteredProducts.length / limit)} className="rounded border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockReportPage;
