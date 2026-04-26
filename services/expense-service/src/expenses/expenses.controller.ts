import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UseGuards,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ExpensesService } from './expenses.service';
import { Permissions, CurrentUser, SkipCashClosingCheck } from '../common/decorators';
import { EXPENSE_PERMISSIONS } from '../common/permissions';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  CancelExpenseDto,
  ListExpensesQueryDto,
} from './dto';
import { WorkflowUser } from './expenses.service';
import { CashClosingRequiredGuard } from '../cash-closing/guards/cash-closing-required.guard';
import { ParseLooseUUIDPipe } from '../common/pipes/parse-loose-uuid.pipe';

@Controller('expenses')
@UseGuards(CashClosingRequiredGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly configService: ConfigService,
  ) {}

  @Get('stats')
  @Permissions(EXPENSE_PERMISSIONS.READ)
  getStats(
    @CurrentUser('tenantId') tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.expensesService.getStats(tenantId, { dateFrom, dateTo, categoryId });
  }

  @Get()
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListExpensesQueryDto) {
    return this.expensesService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findById(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseLooseUUIDPipe) id: string,
  ) {
    return this.expensesService.findById(tenantId, id);
  }

  @Post()
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  create(@CurrentUser() user: WorkflowUser, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user.tenantId, dto, user);
  }

  @Patch(':id')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.update(tenantId, id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(EXPENSE_PERMISSIONS.DELETE)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseLooseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.remove(tenantId, id, userId);
  }

  @Post(':id/submit')
  @SkipCashClosingCheck()
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  submit(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseLooseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.submit(tenantId, id, userId);
  }

  @Post(':id/approve')
  @SkipCashClosingCheck()
  @Permissions(EXPENSE_PERMISSIONS.APPROVE_L1)
  approve(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.expensesService.approve(user.tenantId, id, dto, user);
  }

  @Post(':id/reject')
  @SkipCashClosingCheck()
  @Permissions(EXPENSE_PERMISSIONS.APPROVE_L1)
  reject(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.expensesService.reject(user.tenantId, id, dto, user);
  }

  @Post(':id/pay')
  @SkipCashClosingCheck()
  @Permissions(EXPENSE_PERMISSIONS.PAY)
  markPaid(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser() user: WorkflowUser) {
    return this.expensesService.markPaid(user.tenantId, id, user);
  }

  @Post(':id/cancel')
  @SkipCashClosingCheck()
  @Permissions(EXPENSE_PERMISSIONS.CANCEL)
  cancel(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: CancelExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.cancel(tenantId, id, dto, userId);
  }

  @Post(':id/attachments')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
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
        const allowed = /\.(pdf|jpg|jpeg|png)$/i;
        if (!allowed.test(extname(file.originalname))) {
          cb(new Error('Only PDF, JPG and PNG files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadAttachments(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseLooseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.addAttachments(tenantId, id, files, userId);
  }
}
