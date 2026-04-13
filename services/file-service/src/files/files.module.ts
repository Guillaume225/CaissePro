import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from '../entities/file.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ThumbnailService } from './thumbnail.service';
import { FileValidationService } from './file-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  controllers: [FilesController],
  providers: [FilesService, ThumbnailService, FileValidationService],
  exports: [FilesService],
})
export class FilesModule {}
