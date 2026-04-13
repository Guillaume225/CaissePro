import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';
import { UploadFileDto, FileResponseDto } from './dto';
import { CurrentUser } from '../common/decorators';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB hard limit at multer level
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser('id') userId: string,
  ): Promise<{ success: true; data: FileResponseDto }> {
    const data = await this.filesService.upload(
      file,
      userId,
      dto.module,
      dto.entityId,
    );
    return { success: true, data };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: FileResponseDto }> {
    const data = await this.filesService.findOne(id);
    return { success: true, data };
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: true; data: { url: string; filename: string } }> {
    const data = await this.filesService.getDownloadUrl(id);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ success: true; message: string }> {
    await this.filesService.softDelete(id, userId);
    return { success: true, message: 'File deleted' };
  }
}
