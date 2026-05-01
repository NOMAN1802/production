import { Types } from 'mongoose';

export type TPendingProductStatus = 'pending' | 'partial_received' | 'received';

export type TPendingProduct = {
  _id?: Types.ObjectId;
  productName: string;
  code?: string;
  quantity: number;
  amount: number;
  supplierName?: string;
  status: TPendingProductStatus;
  receivedQuantity?: number;
  notes?: string;
  createdBy?: Types.ObjectId;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};
