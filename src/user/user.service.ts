import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { UserCreateDto } from './dtos/user-create.dto';

@Injectable()
export class UserService {
  constructor(@Inject('USER_MODEL') private readonly userModel: Model<User>) {}

  async create(createUserDto: UserCreateDto): Promise<User> {
    const newUser = new this.userModel(createUserDto);
    try {
      return await newUser.save();
    } catch (error) {
      throw error;
    }
  }
  
}
