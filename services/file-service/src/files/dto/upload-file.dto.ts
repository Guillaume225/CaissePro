import { IsEnum, IsOptional} from 'class-validator';
import { IsUUID } from '../../is-uuid-loose';
import { FileModule } from '../../entities/file.entity';

export class UploadFileDto {
  @IsEnum(FileModule)
  @IsOptional()
  module?: FileModule;

  @IsUUID()
  @IsOptional()
  entityId?: string;
}
