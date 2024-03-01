import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { UserCreateDto } from './dtos/user-create.dto';
import { compare, hash } from 'bcryptjs';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async createUser(createUserDto: UserCreateDto): Promise<User> {
    const newUser = new this.userModel({
      ...createUserDto,
      password: await hash(createUserDto.password, 10),
    });
    try {
      return await newUser.save();
    } catch (error) {
      throw error;
    }
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email });
  }

  async findOneById(id: string): Promise<User | null> {
    return this.userModel.findById(id);
  }

  async loginUser(email: string, password: string): Promise<User | null> {
    const user = await this.userModel.findOne({ email });
    if (!user) return null;

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) throw new Error('Invalid password');

    return user;
  }
}
