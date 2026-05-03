import { baseApi } from './baseApi';
import type { ApiResponse } from './types';

export type DamageItem = {
    product: string | {
        _id: string;
        name: string;
        sku?: string;
        category?: { name: string };
        supplier?: {
            _id: string;
            name: string;
            phone?: string;
            email?: string;
        };
    };
    productName: string;
    quantity: number;
    unitCost: number;
    totalLoss: number;
    damageType: 'expired' | 'broken' | 'lost' | 'defective' | 'other';
    reason?: string;
    supplier?: string | {
        _id: string;
        name: string;
        phone?: string;
        email?: string;
    };
    supplierName?: string;
    orderItemIndex?: number;
};

export type Damage = {
    _id: string;
    damageNumber: string;
    orderId?: string;
    orderNumber?: string;
    customerId?: string | {
        _id: string;
        name: string;
        phone?: string;
        address?: string;
    };
    items: DamageItem[];
    notes?: string;
    subtotal: number;
    totalLoss: number;
    createdAt?: string;
    updatedAt?: string;
};

export type CreateDamageItemInput = {
    product: string;
    productName: string;
    quantity: number;
    unitCost: number;
    totalLoss: number;
    damageType: 'expired' | 'broken' | 'lost' | 'defective' | 'other';
    reason?: string;
    supplier?: string;
    orderItemIndex?: number;
};

export type CreateDamageInput = {
    orderId?: string;
    orderNumber?: string;
    customerId?: string;
    items: CreateDamageItemInput[];
    notes?: string;
    subtotal: number;
    totalLoss: number;
};

export type DamageListResponse = {
    damages: Damage[];
    total: number;
    page: number;
    limit: number;
};

export const damagesApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getDamages: builder.query<DamageListResponse, { page?: number; search?: string; limit?: number; date?: string; startDate?: string; endDate?: string }>({
            query: ({ page = 1, search, limit = 30, date, startDate, endDate } = {}) => ({
                url: '/damages',
                params: {
                    page,
                    limit,
                    searchTerm: search,
                    ...(date && { date }),
                    ...(startDate && { startDate }),
                    ...(endDate && { endDate }),
                },
            }),
            transformResponse: (response: ApiResponse<Damage[]>) => ({
                damages: response.data,
                total: typeof response.meta === 'number' ? response.meta : 0,
                page: 1,
                limit: 30
            }),
            providesTags: (result) =>
                result
                    ? [
                        ...result.damages.map(({ _id }) => ({ type: 'Damages' as const, id: _id })),
                        { type: 'Damages' as const, id: 'LIST' },
                    ]
                    : [{ type: 'Damages', id: 'LIST' }],
        }),
        getDamage: builder.query<Damage, string>({
            query: (id) => ({
                url: `/damages/${id}`,
            }),
            transformResponse: (response: ApiResponse<Damage>) => response.data,
            providesTags: (_result, _error, id) => [{ type: 'Damages', id }],
        }),
        createDamage: builder.mutation<Damage, CreateDamageInput>({
            query: (data) => ({
                url: '/damages',
                method: 'POST',
                body: data,
            }),
            transformResponse: (response: ApiResponse<Damage>) => response.data,
            invalidatesTags: [{ type: 'Damages', id: 'LIST' }, 'Reports', 'Products', 'Expenses'],
        }),
        updateDamage: builder.mutation<Damage, { id: string; data: Partial<CreateDamageInput> }>({
            query: ({ id, data }) => ({
                url: `/damages/${id}`,
                method: 'PATCH',
                body: data,
            }),
            transformResponse: (response: ApiResponse<Damage>) => response.data,
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Damages', id },
                { type: 'Damages', id: 'LIST' },
                'Reports',
                'Products',
                'Expenses',
            ],
        }),
        deleteDamage: builder.mutation<void, string>({
            query: (id) => ({
                url: `/damages/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Damages', id: 'LIST' }, 'Reports', 'Products', 'Expenses'],
        }),
    }),
});

export const {
    useGetDamagesQuery,
    useGetDamageQuery,
    useCreateDamageMutation,
    useUpdateDamageMutation,
    useDeleteDamageMutation
} = damagesApi;
