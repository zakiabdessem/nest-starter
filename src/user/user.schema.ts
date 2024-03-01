import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { UserRole } from './user.entity';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, enum: UserRole })
  roles: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
