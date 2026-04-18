/* eslint-disable @typescript-eslint/no-explicit-any */
import { baseApi } from './baseApi';
import type { ApiResponse } from './types';

export type Refund = {
    _id: string;
    refundNumber: string;
    order?: string;
    orderId?: string;
    orderNumber?: string;
    amount: number;
    reason?: string;
    paymentMethod?: string;
    customer: {
        name: string;
        phone?: string;
        email?: string;
    };
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
};

export type CreateRefundInput = {
    order?: string;
    orderId?: string;
    orderNumber?: string;
    amount: number;
    reason?: string;
    paymentMethod?: string;
    customer: {
        name: string;
        phone?: string;
        email?: string;
    };
    notes?: string;
};

export type RefundListResponse = {
    refunds: Refund[];
    total: number;
    page: number;
    limit: number;
};

export const refundsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getRefunds: builder.query<RefundListResponse, { page?: number; search?: string; limit?: number }>({
            query: ({ page = 1, search, limit = 30 } = {}) => {
                const params: Record<string, any> = {
                    page,
                    limit,
                    searchTerm: search,
                };
                return {
                    url: '/refunds',
                    params,
                };
            },
            transformResponse: (response: ApiResponse<Refund[]>) => {
                return {
                    refunds: response.data,
                    total: typeof response.meta === 'number' ? response.meta : 0,
                    page: 1,
                    limit: 30
                };
            },
            providesTags: (result) =>
                result?.refunds
                    ? [
                        ...result.refunds.map(({ _id }) => ({ type: 'Refunds' as const, id: _id })),
                        { type: 'Refunds' as const, id: 'LIST' },
                    ]
                    : [{ type: 'Refunds', id: 'LIST' }],
        }),
        getRefund: builder.query<Refund, string>({
            query: (id) => ({
                url: `/refunds/${id}`,
            }),
            transformResponse: (response: ApiResponse<Refund>) => response.data,
            providesTags: (_result, _error, id) => [{ type: 'Refunds', id }],
        }),
        createRefund: builder.mutation<Refund, CreateRefundInput>({
            query: (data) => ({
                url: '/refunds',
                method: 'POST',
                body: data,
            }),
            transformResponse: (response: ApiResponse<Refund>) => response.data,
            invalidatesTags: [{ type: 'Refunds', id: 'LIST' }, 'Reports', 'Orders'],
        }),
        updateRefund: builder.mutation<Refund, { id: string; data: Partial<CreateRefundInput> }>({
            query: ({ id, data }) => ({
                url: `/refunds/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (response: ApiResponse<Refund>) => response.data,
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Refunds', id },
                { type: 'Refunds', id: 'LIST' },
                'Reports',
                'Orders',
            ],
        }),
        deleteRefund: builder.mutation<void, string>({
            query: (id) => ({
                url: `/refunds/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Refunds', id: 'LIST' }, 'Reports', 'Orders'],
        }),
    }),
});

export const {
    useGetRefundsQuery,
    useGetRefundQuery,
    useCreateRefundMutation,
    useUpdateRefundMutation,
    useDeleteRefundMutation
} = refundsApi;

