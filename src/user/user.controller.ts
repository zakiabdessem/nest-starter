import { Controller, Post } from '@nestjs/common';

@Controller('user')
export class UserController {
    private readonly userService: UserService;

  @Post('register')
  register() {
    return 'Register';
  }


}
