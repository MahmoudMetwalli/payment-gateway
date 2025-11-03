import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MerchantDocument = HydratedDocument<Merchant>;

@Schema()
export class Merchant {
  @Prop({ unique: true, index: 'hashed' })
  userName: string;

  @Prop()
  password: string;

  @Prop()
  balance: number;

  @Prop({ unique: true, index: 'hashed' })
  apiKey: string;

  @Prop({ unique: true })
  apiSecret: string;
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);
