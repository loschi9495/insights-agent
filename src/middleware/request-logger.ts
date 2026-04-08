import { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const user = (req as any).user?.email || "anonymous";
    const status = res.statusCode;
    const color = status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : "\x1b[32m";
    console.log(`${color}${status}\x1b[0m ${method} ${path} - ${duration}ms [${user}]`);
  });

  next();
}
