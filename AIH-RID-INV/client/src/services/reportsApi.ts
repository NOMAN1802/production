/* eslint-disable @typescript-eslint/no-explicit-any */
import { baseApi } from './baseApi';
import type { ApiResponse } from './types';

export type FinancialSummary = {
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: string | number;
    discount: number;
    tax: number;
};

export type StockReport = {
    summary: {
        totalProducts: number;
        totalStockValue: number;
        lowStockItems: number;
        outOfStockItems: number;
    };
    products: Array<{
        _id: string;
        name: string;
        sku: string;
        stockQuantity: number;
        minStockLevel?: number;
        purchasePrice: number;
        sellingPrice: number;
        category?: { name: string };
    }>;
};

export type OrderReport = {
    summary: {
        totalOrders: number;
        completedOrders: number;
        pendingOrders: number;
        partialOrders: number;
        totalRevenue: number;
    };
    orders: Array<{
        _id: string;
        orderNumber: string;
        totalAmount: number;
        status: string;
        createdAt: string;
        createdBy?: { name: string };
    }>;
};

export type DamageReport = {
    summary: {
        totalDamages: number;
        totalQuantity: number;
        totalValue: number;
    };
    damages: Array<{
        _id: string;
        quantity: number;
        reason: string;
        createdAt: string;
        product?: { name: string; sku: string };
        createdBy?: { name: string };
    }>;
};

export type ReturnReport = {
    summary: {
        totalReturns: number;
        totalQuantity: number;
        totalValue: number;
    };
    returns: Array<{
        _id: string;
        quantity: number;
        reason: string;
        createdAt: string;
        product?: { name: string; sku: string };
        order?: { orderNumber: string };
        createdBy?: { name: string };
    }>;
};

export type RevenueReport = {
    summary: {
        totalRevenue: number;
        totalOrders: number;
        totalDiscount: number;
        totalTax: number;
    };
    dailyRevenue: Array<{
        _id: { year: number; month: number; day: number };
        totalRevenue: number;
        totalDiscount: number;
        totalTax: number;
        orderCount: number;
    }>;
};

export type DateRangeParams = { startDate?: string; endDate?: string } | undefined;

export const reportsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getFinancialSummary: builder.query<FinancialSummary, DateRangeParams>({
            query: (params) => ({
                url: '/reports/financial-summary',
                params: params || undefined,
            }),
            transformResponse: (response: ApiResponse<FinancialSummary>) => response.data,
            providesTags: ['Reports'],
        }),

        getStockReport: builder.query<StockReport, void>({
            query: () => '/reports/stock',
            transformResponse: (response: ApiResponse<StockReport>) => response.data,
            providesTags: ['Reports', 'Products'],
        }),

        getOrderReport: builder.query<OrderReport, DateRangeParams>({
            query: (params) => ({
                url: '/reports/orders',
                params: params || undefined,
            }),
            transformResponse: (response: ApiResponse<OrderReport>) => response.data,
            providesTags: ['Reports', 'Orders'],
        }),

        getDamageReport: builder.query<DamageReport, DateRangeParams>({
            query: (params) => ({
                url: '/reports/damages',
                // Only pass params if they exist and have date values
                params: params && (params.startDate || params.endDate) ? params : undefined,
            }),
            transformResponse: (response: ApiResponse<DamageReport>) => response.data,
            providesTags: ['Reports'],
        }),

        getReturnReport: builder.query<ReturnReport, DateRangeParams>({
            query: (params) => ({
                url: '/reports/returns',
                params: params || undefined,
            }),
            transformResponse: (response: ApiResponse<ReturnReport>) => response.data,
            providesTags: ['Reports'],
        }),

        getRevenueReport: builder.query<RevenueReport, DateRangeParams>({
            query: (params) => ({
                url: '/reports/revenue',
                params: params || undefined,
            }),
            transformResponse: (response: ApiResponse<RevenueReport>) => response.data,
            providesTags: ['Reports'],
        }),

        getExpenseReport: builder.query<any, DateRangeParams>({
            query: (params) => ({
                url: '/reports/expenses',
                params: params || undefined,
            }),
            transformResponse: (response: ApiResponse<any>) => response.data,
            providesTags: ['Reports'],
        }),
    }),
});

export const {
    useGetFinancialSummaryQuery,
    useGetStockReportQuery,
    useGetOrderReportQuery,
    useGetDamageReportQuery,
    useGetReturnReportQuery,
    useGetRevenueReportQuery,
    useGetExpenseReportQuery,
} = reportsApi;

