import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error('后端错误:', err);

  res.status(500).json({
    success: false,
    message: '出了点小问题，请再试一次',
    ...(process.env.NODE_ENV === 'development' && { error: err.message }),
  });
}