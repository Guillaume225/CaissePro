import {
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveReportConfigDto {
  @IsString()
  @MaxLength(50)
  reportId!: string;

  @IsString()
  @MaxLength(200)
  reportName!: string;

  @IsString()
  configJson!: string;
}

export class BulkSaveReportConfigsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveReportConfigDto)
  configs!: SaveReportConfigDto[];
}
