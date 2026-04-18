import { useMemo } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useGetProductsQuery } from '@/services/productsApi';

type StockAlertProps = {
    onClose?: () => void;
    showCloseButton?: boolean;
};

const StockAlert = ({ onClose, showCloseButton = true }: StockAlertProps) => {
    const { data } = useGetProductsQuery({ limit: 1000 });

    const lowStockProducts = useMemo(() => {
        if (!data?.products) return [];
        return data.products.filter(product =>
            product.stockQuantity <= (product.minStockLevel || 10)
        );
    }, [data]);

    const outOfStockProducts = useMemo(() => {
        return lowStockProducts.filter(product => product.stockQuantity === 0);
    }, [lowStockProducts]);

    if (lowStockProducts.length === 0) return null;

    return (
        <div className="rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                    <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-900">Stock Alert</h3>
                    <div className="mt-1 space-y-1">
                        {outOfStockProducts.length > 0 && (
                            <p className="text-sm text-red-600">
                                <span className="font-semibold">{outOfStockProducts.length}</span> products are out of stock
                            </p>
                        )}
                        {lowStockProducts.length > outOfStockProducts.length && (
                            <p className="text-sm text-orange-600">
                                <span className="font-semibold">{lowStockProducts.length - outOfStockProducts.length}</span> products are running low
                            </p>
                        )}
                        <p className="text-xs text-slate-500">
                            Products: {lowStockProducts.slice(0, 3).map(p => p.name).join(', ')}
                            {lowStockProducts.length > 3 && ` +${lowStockProducts.length - 3} more`}
                        </p>
                    </div>
                </div>
                {showCloseButton && onClose && (
                    <button
                        onClick={onClose}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                    >
                        <XMarkIcon className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default StockAlert;
