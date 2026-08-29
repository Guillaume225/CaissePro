import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { PurchaseRequestsService, WorkflowUser } from './purchase-requests.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { DA_PERMISSIONS } from '../common/permissions';
import { PurchaseRequestDocumentType } from '../entities/enums';
import {
  CreatePurchaseRequestDto,
  UpdatePurchaseRequestDto,
  ApprovalActionDto,
  RejectReturnDto,
  CancelPurchaseRequestDto,
  AddCommentDto,
  ListPurchaseRequestsQueryDto,
  UpdateLinePricingDto,
} from './dto';
import { ParseLooseUUIDPipe } from '../common/pipes/parse-loose-uuid.pipe';

@Controller('purchase-requests')
export class PurchaseRequestsController {
  constructor(private readonly service: PurchaseRequestsService) {}

  @Get('mine')
  @Permissions(DA_PERMISSIONS.READ)
  findMine(@CurrentUser() user: WorkflowUser, @Query() query: ListPurchaseRequestsQueryDto) {
    return this.service.findAll(user.tenantId, query, user.id);
  }

  @Get('to-validate')
  @Permissions(DA_PERMISSIONS.APPROVE)
  findToValidate(@CurrentUser() user: WorkflowUser) {
    return this.service.findToValidate(user.tenantId, user);
  }

  @Get()
  @Permissions(DA_PERMISSIONS.VIEW_ALL)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListPurchaseRequestsQueryDto) {
    return this.service.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(DA_PERMISSIONS.READ)
  findById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseLooseUUIDPipe) id: string,
  ) {
    return this.service.findById(tenantId, id);
  }

  @Post()
  @Permissions(DA_PERMISSIONS.CREATE)
  create(@CurrentUser() user: WorkflowUser, @Body() dto: CreatePurchaseRequestDto) {
    return this.service.create(user.tenantId, dto, user);
  }

  @Patch(':id')
  @Permissions(DA_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseRequestDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.update(user.tenantId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(DA_PERMISSIONS.DELETE)
  remove(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser() user: WorkflowUser) {
    return this.service.remove(user.tenantId, id, user);
  }

  @Post(':id/submit')
  @Permissions(DA_PERMISSIONS.SUBMIT)
  submit(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser() user: WorkflowUser) {
    return this.service.submit(user.tenantId, id, user);
  }

  @Patch(':id/pricing')
  @Permissions(DA_PERMISSIONS.PROCESS)
  updatePricing(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: UpdateLinePricingDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.updateLinePricing(user.tenantId, id, dto, user);
  }

  @Post(':id/submit-to-circuit')
  @Permissions(DA_PERMISSIONS.PROCESS)
  submitToCircuit(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser() user: WorkflowUser) {
    return this.service.submitToCircuit(user.tenantId, id, user);
  }

  @Post(':id/approve')
  @Permissions(DA_PERMISSIONS.APPROVE)
  approve(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.approve(user.tenantId, id, dto, user);
  }

  @Post(':id/reject')
  @Permissions(DA_PERMISSIONS.REJECT)
  reject(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: RejectReturnDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.reject(user.tenantId, id, dto, user);
  }

  @Post(':id/return')
  @Permissions(DA_PERMISSIONS.RETURN)
  returnToRequester(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: RejectReturnDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.returnToRequester(user.tenantId, id, dto, user);
  }

  @Post(':id/cancel')
  @Permissions(DA_PERMISSIONS.CANCEL)
  cancel(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: CancelPurchaseRequestDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.cancel(user.tenantId, id, dto, user);
  }

  @Post(':id/reopen-to-pricing')
  @Permissions(DA_PERMISSIONS.PROCESS)
  reopenToPricing(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser() user: WorkflowUser) {
    return this.service.reopenToPricing(user.tenantId, id, user);
  }

  @Post(':id/comments')
  @Permissions(DA_PERMISSIONS.READ)
  addComment(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.addComment(user.tenantId, id, dto, user);
  }

  @Post(':id/attachments')
  @Permissions(DA_PERMISSIONS.UPDATE)
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = process.env.UPLOAD_DIR || './uploads';
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${uuid()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /\.(pdf|jpg|jpeg|png|xls|xlsx|doc|docx)$/i;
        if (!allowed.test(extname(file.originalname))) {
          cb(new Error('Unsupported file type'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadAttachments(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentType') documentType: PurchaseRequestDocumentType | undefined,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.service.addAttachments(user.tenantId, id, files, documentType, user.id);
  }

  @Get(':id/attachments/:attachmentId')
  @Permissions(DA_PERMISSIONS.READ)
  async downloadAttachment(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Param('attachmentId', ParseLooseUUIDPipe) attachmentId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
  ) {
    const { path, fileName } = await this.service.getAttachmentFile(tenantId, id, attachmentId);
    res.download(path, fileName);
  }

  @Delete(':id/attachments/:attachmentId')
  @Permissions(DA_PERMISSIONS.UPDATE)
  removeAttachment(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Param('attachmentId', ParseLooseUUIDPipe) attachmentId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.service.removeAttachment(tenantId, id, attachmentId);
  }
}
