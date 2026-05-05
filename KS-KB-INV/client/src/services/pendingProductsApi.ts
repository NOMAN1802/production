import { baseApi } from './baseApi';
import type { ApiResponse } from './types';

export type PendingProductStatus = 'pending' | 'partial_received' | 'received';

export type PartialReceive = {
    quantity: number;
    amount: number;
    date: string;
};

export type PendingProduct = {
    _id: string;
    productName: string;
    code?: string;
    quantity: number;
    amount: number;
    supplierName?: string;
    status: PendingProductStatus;
    receivedQuantity?: number;
    receivedAmount?: number;
    partialReceives?: PartialReceive[];
    notes?: string;
    createdAt: string;
    updatedAt: string;
};

export type CreatePendingProductsInput = {
    items: {
        productName: string;
        code?: string;
        quantity: number;
        amount: number;
        supplierName?: string;
    }[];
};

export type UpdatePendingProductInput = {
    status?: PendingProductStatus;
    receivedQuantity?: number;
    partialAmount?: number;
    notes?: string;
};

export type PendingProductsResponse = {
    result: PendingProduct[];
    meta: { total: number; page: number; limit: number };
};

export type PendingProductStats = {
    total: { count: number; amount: number };
    pending: { count: number; amount: number };
    partial_received: { count: number; amount: number; receivedAmount: number };
    received: { count: number; amount: number };
};

export const pendingProductsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getPendingProducts: builder.query<
            PendingProductsResponse,
            { page?: number; limit?: number; search?: string; status?: string; startDate?: string; endDate?: string }
        >({
            query: (params) => ({ url: '/pending-products', params }),
            transformResponse: (response: ApiResponse<PendingProduct[]>) => ({
                result: response.data,
                meta: response.meta as PendingProductsResponse['meta'],
            }),
            providesTags: ['PendingProducts'],
        }),
        getPendingProductStats: builder.query<PendingProductStats, { startDate?: string; endDate?: string } | void>({
            query: (params) => ({ url: '/pending-products/stats', params: params ?? undefined }),
            transformResponse: (response: ApiResponse<PendingProductStats>) => response.data,
            providesTags: ['PendingProducts'],
        }),
        createPendingProducts: builder.mutation<PendingProduct[], CreatePendingProductsInput>({
            query: (data) => ({ url: '/pending-products', method: 'POST', body: data }),
            transformResponse: (response: ApiResponse<PendingProduct[]>) => response.data,
            invalidatesTags: ['PendingProducts'],
        }),
        updatePendingProduct: builder.mutation<
            PendingProduct,
            { id: string; data: UpdatePendingProductInput }
        >({
            query: ({ id, data }) => ({
                url: `/pending-products/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (response: ApiResponse<PendingProduct>) => response.data,
            invalidatesTags: ['PendingProducts'],
        }),
        deletePendingProduct: builder.mutation<void, string>({
            query: (id) => ({ url: `/pending-products/${id}`, method: 'DELETE' }),
            invalidatesTags: ['PendingProducts'],
        }),
    }),
});

export const {
    useGetPendingProductsQuery,
    useGetPendingProductStatsQuery,
    useCreatePendingProductsMutation,
    useUpdatePendingProductMutation,
    useDeletePendingProductMutation,
} = pendingProductsApi;
