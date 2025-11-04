import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MerchantDocument = HydratedDocument<Merchant>;

@Schema()
export class Merchant {
  _id: Types.ObjectId;

  @Prop({ unique: true, index: 'hashed' })
  userName: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: 0 })
  balance: number;

  @Prop({ unique: true, index: 'hashed' })
  apiKey: string;

  @Prop({ unique: true })
  apiSecret: string;

  @Prop({ type: [String], default: [] })
  webhook: string[];
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);
