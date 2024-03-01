import { Body, Controller, Post, Res, HttpStatus, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { UserCreateDto } from './dtos/user-create.dto';
import { Response } from 'express';
import { sign } from 'jsonwebtoken';
import cookieConfig from './../../config/cookie';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  register(@Body() createUserDto: UserCreateDto) {
    return this.userService.createUser(createUserDto);
  }

  @Post('login')
  async login(
    @Body() { email, password }: { email: string; password: string },
    @Res() res: Response,
  ) {
    try {
      const user = await this.userService.loginUser(email, password);

      if (!user)
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ message: 'Invalid credentials' });

      const token = await sign(user.email, process.env.SECRET);

      return res
        .cookie('jwt', token, cookieConfig())
        .status(HttpStatus.OK)
        .json({ message: 'Auth Success' });
    } catch (error) {
      console.error(error);
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        message: 'Authentication failed',
      });
    }
  }
}
