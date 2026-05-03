import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

interface StockMovementsSectionProps {
    returnData?: {
        summary: {
            totalReturns: number;
            totalValue: number;
            totalQuantity: number;
        };
        returns: Array<{
            _id: string;
            product?: { name: string };
            quantity: number;
            order?: { orderNumber: string };
        }>;
    };
    damageData?: {
        summary: {
            totalDamages: number;
            totalValue: number;
            totalQuantity: number;
        };
        damages: Array<{
            _id: string;
            product?: { name: string };
            quantity: number;
            reason: string;
        }>;
    };
    stockMovements: Array<{
        type: string;
        product: string;
        quantity: number;
        date: string;
        reason: string;
    }>;
}

const StockMovementsSection = ({
    returnData,
    damageData,
    stockMovements,
}: StockMovementsSectionProps) => {
    const movementCards = [
        {
            label: 'Total Returns',
            value: returnData?.summary.totalReturns || 0,
            delta: '+0.0%',
            color: 'blue' as const,
            icon: '↩️',
            subtitle: 'all time'
        },
        {
            label: 'Return Value',
            value: `৳${(returnData?.summary.totalValue || 0).toLocaleString()}`,
            delta: '+0.0%',
            color: 'green' as const,
            icon: '💸',
            subtitle: 'total amount'
        },
        {
            label: 'Total Damages',
            value: damageData?.summary.totalDamages || 0,
            delta: '+0.0%',
            color: 'red' as const,
            icon: '⚠️',
            subtitle: 'all time'
        },
        {
            label: 'Damage Loss',
            value: `৳${(damageData?.summary.totalValue || 0).toLocaleString()}`,
            delta: '+0.0%',
            color: 'red' as const,
            icon: '💸',
            subtitle: 'value lost'
        }
    ];

    return (
        <div className="space-y-8">
            {/* Movement Summary Cards */}
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {movementCards.map((card) => (
                    <div key={card.label} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-linear-to-br from-white/95 to-slate-50/95 p-6 shadow-lg shadow-slate-200/40 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{card.icon}</span>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
                                </div>
                                <p className={`text-2xl font-bold ${card.color === 'green' ? 'text-emerald-600' :
                                    card.color === 'red' ? 'text-red-600' :
                                        'text-blue-600'
                                    } group-hover:scale-105 transition-transform duration-300`}>
                                    {card.value}
                                </p>
                                <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">{card.subtitle}</p>
                            </div>
                            <div className={`rounded-full p-2 ${card.color === 'green' ? 'bg-emerald-100' :
                                card.color === 'red' ? 'bg-red-100' :
                                    'bg-blue-100'
                                } opacity-60 group-hover:opacity-100 transition-opacity duration-300`}>
                                <div className={`h-2 w-2 rounded-full ${card.color === 'green' ? 'bg-emerald-500' :
                                    card.color === 'red' ? 'bg-red-500' :
                                        'bg-blue-500'
                                    }`}></div>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center">
                            <span className={`text-xs font-semibold ${card.delta.startsWith('+') ? 'text-emerald-600' : 'text-red-500'
                                }`}>
                                {card.delta}
                            </span>
                            <span className="ml-1 text-xs text-slate-400">vs last month</span>
                        </div>
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${card.color === 'green' ? 'bg-emerald-500' :
                            card.color === 'red' ? 'bg-red-500' :
                                'bg-blue-500'
                            }`}></div>
                    </div>
                ))}
            </section>

            {/* Movement Comparison Chart */}
            <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card">
                <h3 className="text-lg font-semibold text-slate-900">Returns vs Damages</h3>
                <p className="text-xs text-slate-400 mb-4">Stock additions vs deductions</p>
                <div className="h-64 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip
                                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value: number) => [`${value} units`, '']}
                            />
                            <Legend />
                            <Pie
                                data={[
                                    { name: 'Returns (Stock In)', value: returnData?.summary.totalQuantity || 0, color: '#10B981' },
                                    { name: 'Damages (Stock Out)', value: damageData?.summary.totalQuantity || 0, color: '#EF4444' },
                                ]}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={4}
                            >
                                <Cell fill="#10B981" />
                                <Cell fill="#EF4444" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Stock Movements Table */}
            <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Stock Movements</h3>
                {stockMovements.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No stock movements recorded</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-xs uppercase text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="py-3 pr-4 text-left">S/N</th>
                                    <th className="py-3 text-left">Type</th>
                                    <th className="py-3 text-left">Product</th>
                                    <th className="py-3 text-right">Quantity</th>
                                    <th className="py-3 text-left">Reason</th>
                                    <th className="py-3 text-left">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stockMovements.map((movement, index) => (
                                    <tr key={index} className="hover:bg-slate-50/50">
                                        <td className="py-3 pr-4 text-slate-400 text-xs">{index + 1}</td>
                                        <td className="py-3">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${movement.type === 'return'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}
                                            >
                                                {movement.type === 'return' ? '+' : '-'} {movement.type}
                                            </span>
                                        </td>
                                        <td className="py-3 font-medium text-slate-900">{movement.product}</td>
                                        <td className={`py-3 text-right font-semibold ${movement.type === 'return' ? 'text-emerald-600' : 'text-red-600'
                                            }`}>
                                            {movement.type === 'return' ? '+' : '-'}{movement.quantity}
                                        </td>
                                        <td className="py-3 text-slate-500 max-w-[200px] truncate">{movement.reason}</td>
                                        <td className="py-3 text-slate-500">{movement.date}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Returns & Damages Details */}
            <div className="grid gap-6 xl:grid-cols-2">
                {/* Returns Table */}
                <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                        <h3 className="text-lg font-semibold text-slate-900">Recent Returns</h3>
                    </div>
                    {!returnData?.returns.length ? (
                        <p className="text-sm text-slate-500 text-center py-8">No returns recorded</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-xs uppercase text-slate-500 border-b border-slate-100">
                                    <tr>
                                        <th className="py-2 pr-4 text-left">S/N</th>
                                        <th className="py-2 text-left">Product</th>
                                        <th className="py-2 text-right">Qty</th>
                                        <th className="py-2 text-left">Order</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {returnData.returns.slice(0, 5).map((r, idx) => (
                                        <tr key={r._id} className="hover:bg-slate-50/50">
                                            <td className="py-3 pr-4 text-slate-400 text-xs">{idx + 1}</td>
                                            <td className="py-3 font-medium text-slate-900">{r.product?.name || 'N/A'}</td>
                                            <td className="py-3 text-right text-emerald-600 font-semibold">+{r.quantity}</td>
                                            <td className="py-3 text-slate-500">{r.order?.orderNumber || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Damages Table */}
                <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-card">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <h3 className="text-lg font-semibold text-slate-900">Recent Damages</h3>
                    </div>
                    {!damageData?.damages.length ? (
                        <p className="text-sm text-slate-500 text-center py-8">No damages recorded</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="text-xs uppercase text-slate-500 border-b border-slate-100">
                                    <tr>
                                        <th className="py-2 pr-4 text-left">S/N</th>
                                        <th className="py-2 text-left">Product</th>
                                        <th className="py-2 text-right">Qty</th>
                                        <th className="py-2 text-left">Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {damageData.damages.slice(0, 5).map((d, idx) => (
                                        <tr key={d._id} className="hover:bg-slate-50/50">
                                            <td className="py-3 pr-4 text-slate-400 text-xs">{idx + 1}</td>
                                            <td className="py-3 font-medium text-slate-900">{d.product?.name || 'N/A'}</td>
                                            <td className="py-3 text-right text-red-600 font-semibold">-{d.quantity}</td>
                                            <td className="py-3 text-slate-500 max-w-[150px] truncate">{d.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockMovementsSection;

