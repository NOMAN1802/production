import { baseApi } from './baseApi';
import type { ApiResponse } from './types';

export type PendingProductStatus = 'pending' | 'partial_received' | 'received';

export type PendingProduct = {
    _id: string;
    productName: string;
    code?: string;
    quantity: number;
    amount: number;
    supplierName?: string;
    status: PendingProductStatus;
    receivedQuantity?: number;
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
    notes?: string;
};

export type PendingProductsResponse = {
    result: PendingProduct[];
    meta: { total: number; page: number; limit: number };
};

export const pendingProductsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getPendingProducts: builder.query<
            PendingProductsResponse,
            { page?: number; limit?: number; search?: string; status?: string }
        >({
            query: (params) => ({ url: '/pending-products', params }),
            transformResponse: (response: ApiResponse<PendingProduct[]>) => ({
                result: response.data,
                meta: response.meta as PendingProductsResponse['meta'],
            }),
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
    useCreatePendingProductsMutation,
    useUpdatePendingProductMutation,
    useDeletePendingProductMutation,
} = pendingProductsApi;
