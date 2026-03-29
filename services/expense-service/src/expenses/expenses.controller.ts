import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ExpensesService } from './expenses.service';
import { Permissions } from '../common/decorators';
import { CurrentUser } from '../common/decorators';
import { EXPENSE_PERMISSIONS } from '../common/permissions';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ApproveExpenseDto,
  RejectExpenseDto,
  ListExpensesQueryDto,
} from './dto';

@Controller('expenses')
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
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.findById(id);
  }

  @Post()
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  create(@Body() dto: CreateExpenseDto, @CurrentUser('id') userId: string) {
    return this.expensesService.create(dto, userId);
  }

  @Patch(':id')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.update(id, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(EXPENSE_PERMISSIONS.DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.remove(id, userId);
  }

  @Post(':id/submit')
  @Permissions(EXPENSE_PERMISSIONS.CREATE)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.submit(id, userId);
  }

  @Post(':id/approve/l1')
  @Permissions(EXPENSE_PERMISSIONS.APPROVE_L1)
  approveL1(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentUser('id') approverId: string,
  ) {
    return this.expensesService.approve(id, 1, dto, approverId);
  }

  @Post(':id/approve/l2')
  @Permissions(EXPENSE_PERMISSIONS.APPROVE_L2)
  approveL2(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveExpenseDto,
    @CurrentUser('id') approverId: string,
  ) {
    return this.expensesService.approve(id, 2, dto, approverId);
  }

  @Post(':id/reject')
  @Permissions(EXPENSE_PERMISSIONS.APPROVE_L1)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser('id') approverId: string,
  ) {
    return this.expensesService.reject(id, 1, dto, approverId);
  }

  @Post(':id/pay')
  @Permissions(EXPENSE_PERMISSIONS.UPDATE)
  markPaid(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.expensesService.markPaid(id, userId);
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
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('id') userId: string,
  ) {
    return this.expensesService.addAttachments(id, files, userId);
  }
}
