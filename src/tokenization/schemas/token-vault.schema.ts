import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TokenVaultDocument = HydratedDocument<TokenVault>;

@Schema({ timestamps: true })
export class TokenVault {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true })
  encryptedCardData: string;

  @Prop({ required: true })
  cardLast4: string;

  @Prop({ required: true })
  cardBrand: string;

  @Prop({ required: true, min: 1, max: 12 })
  expiryMonth: number;

  @Prop({ required: true, min: 2024, max: 2099 })
  expiryYear: number;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Merchant', index: true })
  merchantId: Types.ObjectId;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TokenVaultSchema = SchemaFactory.createForClass(TokenVault);

// Index for merchant queries
TokenVaultSchema.index({ merchantId: 1, createdAt: -1 });

