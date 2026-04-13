import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto';
import { CurrentUser, Permissions } from '../common/decorators';
import { PERMISSIONS } from '../common/permissions';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Permissions(PERMISSIONS.COMPANY_READ)
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    const data = await this.companiesService.findAllByTenant(tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  @Permissions(PERMISSIONS.COMPANY_READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('tenantId') tenantId: string) {
    const data = await this.companiesService.findById(id, tenantId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post()
  @Permissions(PERMISSIONS.COMPANY_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.companiesService.create(dto, tenantId, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.COMPANY_UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.companiesService.update(id, dto, tenantId, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post(':id/logo')
  @Permissions(PERMISSIONS.COMPANY_UPDATE)
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: (err: Error | null, accept: boolean) => void,
      ) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException('Format autorisé : PNG, JPEG, WebP ou SVG'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.OK)
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const ip = req.ip || req.socket.remoteAddress || '';
    const data = await this.companiesService.update(id, { logo: dataUri }, tenantId, actorId, ip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post(':id/switch')
  @HttpCode(HttpStatus.OK)
  async switchCompany(
    @Param('id', ParseUUIDPipe) companyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    await this.companiesService.switchUserCompany(userId, companyId, tenantId);
    return { success: true, message: 'Company switched', timestamp: new Date().toISOString() };
  }
}
