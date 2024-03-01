import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies.jwt;

    if (!token) return res.status(404).json({ auth: false });
    try {
      verify(token, process.env.SECRET);

      next();
    } catch (e) {
      console.log(e);
      return res.status(401).json({ auth: false });
    }
  }
}
