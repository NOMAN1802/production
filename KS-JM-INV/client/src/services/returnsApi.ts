/* eslint-disable @typescript-eslint/no-explicit-any */

import { baseApi } from './baseApi';
import type { ApiResponse } from './types';

export type ReturnItem = {
    product: string | { _id: string; name?: string; supplier?: { name?: string; _id?: string } };
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    orderItemIndex?: number;
    supplierName?: string;
};

export type Return = {
    _id: string;
    returnNumber: string;
    order?: string | { _id: string; orderNumber?: string };
    orderId?: string;
    orderNumber?: string;
    items: ReturnItem[];
    subtotal?: number;
    totalAmount: number;
    reason?: string;
    customer: {
        name: string;
        phone?: string;
        email?: string;
    };
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
    // Legacy fields for backward compatibility
    product?: string;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
};

export type CreateReturnInput = {
    order?: string;
    orderNumber?: string;
    orderId?: string;
    items: ReturnItem[];
    subtotal: number;
    totalAmount: number;
    reason?: string;
    customer: {
        name: string;
        phone?: string;
        email?: string;
    };
    notes?: string;
};

export type ReturnListResponse = {
    returns: Return[];
    total: number;
    page: number;
    limit: number;
};

export const returnsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getReturns: builder.query<ReturnListResponse, { page?: number; search?: string; limit?: number; date?: string; startDate?: string; endDate?: string }>({
            query: ({ page = 1, search, limit = 30, date, startDate, endDate } = {}) => {
                const params: Record<string, any> = {
                    page,
                    limit,
                    searchTerm: search,
                };
                if (date) {
                    params.date = date;
                }
                if (startDate) {
                    params.startDate = startDate;
                }
                if (endDate) {
                    params.endDate = endDate;
                }
                return {
                    url: '/returns',
                    params,
                };
            },
            transformResponse: (response: ApiResponse<Return[]>) => {
                return {
                    returns: response.data,
                    total: typeof response.meta === 'number' ? response.meta : 0,
                    page: 1,
                    limit: 30
                };
            },
            providesTags: (result) =>
                result?.returns
                    ? [
                        ...result.returns.map(({ _id }) => ({ type: 'Returns' as const, id: _id })),
                        { type: 'Returns' as const, id: 'LIST' },
                    ]
                    : [{ type: 'Returns', id: 'LIST' }],
        }),
        getReturn: builder.query<Return, string>({
            query: (id) => ({
                url: `/returns/${id}`,
            }),
            transformResponse: (response: ApiResponse<Return>) => response.data,
            providesTags: (_result, _error, id) => [{ type: 'Returns', id }],
        }),
        createReturn: builder.mutation<Return, CreateReturnInput>({
            query: (data) => ({
                url: '/returns',
                method: 'POST',
                body: data,
            }),
            transformResponse: (response: ApiResponse<Return>) => response.data,
            invalidatesTags: [{ type: 'Returns', id: 'LIST' }, 'Reports', 'Products', 'Orders'],
        }),
        updateReturn: builder.mutation<Return, { id: string; data: Partial<CreateReturnInput> }>({
            query: ({ id, data }) => ({
                url: `/returns/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (response: ApiResponse<Return>) => response.data,
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Returns', id },
                { type: 'Returns', id: 'LIST' },
                'Reports',
                'Products',
                'Orders',
            ],
        }),
        deleteReturn: builder.mutation<void, string>({
            query: (id) => ({
                url: `/returns/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Returns', id: 'LIST' }, 'Reports', 'Products', 'Orders'],
        }),
    }),
});

export const {
    useGetReturnsQuery,
    useGetReturnQuery,
    useCreateReturnMutation,
    useUpdateReturnMutation,
    useDeleteReturnMutation
} = returnsApi;
