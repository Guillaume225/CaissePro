import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CashClosingService } from '../cash-closing.service';
import { IS_PUBLIC_KEY } from '../../common/decorators';

export const SKIP_CASH_CLOSING_CHECK = 'skipCashClosingCheck';

/**
 * Guard that blocks operations if yesterday's cash register was not closed.
 * Apply to controllers/routes that should enforce daily closing discipline.
 */
@Injectable()
export class CashClosingRequiredGuard implements CanActivate {
  constructor(
    private readonly cashClosingService: CashClosingService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CASH_CLOSING_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // Only block write operations
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

    const isClosed = await this.cashClosingService.isYesterdayClosed();
    if (!isClosed) {
      throw new ForbiddenException(
        "La clôture de la veille n'a pas été effectuée. Aucune opération n'est autorisée tant que la caisse précédente n'est pas clôturée.",
      );
    }

    return true;
  }
}
