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
import { Permissions } from '../common/decorators';
import { CurrentUser } from '../common/decorators';
import { SkipCashClosingCheck } from '../common/decorators';
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
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.expensesService.getStats({ dateFrom, dateTo, categoryId });
  }

  @Get()
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findAll(@Query() query: ListExpensesQueryDto) {
    return this.expensesService.findAll(query);
  }

  @Get(':id')
  @Permissions(EXPENSE_PERMISSIONS.READ)
  findById(@Param('id', ParseLooseUUIDPipe) id: string) {
    return this.expensesService.findById(id);
  }

  @Post()
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: WorkflowUser) {
    return this.expensesService.create(dto, user);
  }

  @Patch(':id')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(EXPENSE_PERMISSIONS.DELETE)
  remove(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.remove(id, userId);
  }

  @Post(':id/submit')
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  submit(@Param('id', ParseLooseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.submit(id, userId);
  }

  @Post(':id/approve')
  @Permissions(EXPENSE_PERMISSIONS.APPROVE_L1)
  approve(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.expensesService.approve(id, dto, user);
  }

  @Post(':id/reject')
  @Permissions(EXPENSE_PERMISSIONS.APPROVE_L1)
  reject(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.expensesService.reject(id, dto, user);
  }

  @Post(':id/pay')
  @SkipCashClosingCheck()
  @Permissions(EXPENSE_PERMISSIONS.PAY)
  markPaid(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @CurrentUser() user: WorkflowUser,
  ) {
    return this.expensesService.markPaid(id, user);
  }

  @Post(':id/cancel')
  @SkipCashClosingCheck()
  @Permissions(EXPENSE_PERMISSIONS.CANCEL)
  cancel(
    @Param('id', ParseLooseUUIDPipe) id: string,
    @Body() dto: CancelExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.cancel(id, dto, userId);
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
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
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
    @Param('id', ParseLooseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.addAttachments(id, files, userId);
  }
}
