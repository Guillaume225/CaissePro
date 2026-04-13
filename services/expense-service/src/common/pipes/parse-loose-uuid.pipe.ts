import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

const UUID_LOOSE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseLooseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_LOOSE.test(value)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }
    return value;
  }
}
