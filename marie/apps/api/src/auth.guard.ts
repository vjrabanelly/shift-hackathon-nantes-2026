import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey = process.env.API_KEY;

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.apiKey) return true; // pas de clé configurée → accès libre (dev)

    const req = ctx.switchToHttp().getRequest<Request>();

    // Header Authorization: Bearer <key>  OU  ?key=<key> (pour EventSource qui ne supporte pas les headers)
    const header = req.headers['authorization'] ?? '';
    const fromHeader = header.startsWith('Bearer ') ? header.slice(7) : header;
    const fromQuery = (req.query['key'] as string | undefined) ?? '';
    const token = fromHeader || fromQuery;

    if (token !== this.apiKey) throw new UnauthorizedException('Clé API invalide ou manquante.');
    return true;
  }
}
