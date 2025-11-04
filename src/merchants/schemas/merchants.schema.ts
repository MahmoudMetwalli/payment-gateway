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

  // Banking information (encrypted)
  @Prop({ type: String })
  encryptedBankAccountNumber: string;

  @Prop({ type: String })
  encryptedBankRoutingNumber: string;

  @Prop({ type: String })
  bankAccountHolderName: string;

  @Prop({ type: String })
  bankName: string;
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);
