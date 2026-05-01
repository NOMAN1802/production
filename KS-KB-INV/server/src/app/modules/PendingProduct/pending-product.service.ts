import mongoose from 'mongoose';
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { TPendingProduct } from './pending-product.interface';
import { PendingProduct } from './pending-product.model';

type CreateItemPayload = {
  productName: string;
  code?: string;
  quantity: number;
  amount: number;
  supplierName?: string;
};

const createPendingProducts = async (
  items: CreateItemPayload[],
  createdBy: string
): Promise<TPendingProduct[]> => {
  const docs = items.map((item) => ({
    ...item,
    status: 'pending' as const,
    createdBy: new mongoose.Types.ObjectId(createdBy),
  }));

  const result = await PendingProduct.insertMany(docs);
  return result as unknown as TPendingProduct[];
};

const getAllPendingProducts = async (
  query: Record<string, unknown>
): Promise<{ result: TPendingProduct[]; meta: { total: number; page: number; limit: number } }> => {
  const { page = 1, limit = 20, search, status } = query;

  const filter: Record<string, unknown> = { isDeleted: false };

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    filter.$or = [{ productName: searchRegex }, { code: searchRegex }];
  }

  if (status && status !== 'all') {
    filter.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [result, total] = await Promise.all([
    PendingProduct.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    PendingProduct.countDocuments(filter),
  ]);

  return {
    result: result as unknown as TPendingProduct[],
    meta: { total, page: Number(page), limit: Number(limit) },
  };
};

const updatePendingProduct = async (
  id: string,
  payload: Partial<TPendingProduct>
): Promise<TPendingProduct | null> => {
  const item = await PendingProduct.findOne({ _id: id, isDeleted: false });
  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Pending product not found');
  }

  const result = await PendingProduct.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  );

  return result as unknown as TPendingProduct | null;
};

const deletePendingProduct = async (id: string): Promise<boolean> => {
  const item = await PendingProduct.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Pending product not found');
  }

  return true;
};

export const PendingProductServices = {
  createPendingProducts,
  getAllPendingProducts,
  updatePendingProduct,
  deletePendingProduct,
};
