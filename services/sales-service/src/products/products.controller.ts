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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Permissions, CurrentUser } from '../common/decorators';
import { PRODUCT_PERMISSIONS } from '../common/permissions';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto } from './dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Permissions(PRODUCT_PERMISSIONS.READ)
  findAll(@CurrentUser('tenantId') tenantId: string, @Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(tenantId, query);
  }

  @Get(':id')
  @Permissions(PRODUCT_PERMISSIONS.READ)
  findById(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(tenantId, id);
  }

  @Post()
  @Permissions(PRODUCT_PERMISSIONS.CREATE)
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.productsService.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @Permissions(PRODUCT_PERMISSIONS.UPDATE)
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.productsService.update(tenantId, id, dto, userId);
  }

  @Patch(':id/toggle-active')
  @Permissions(PRODUCT_PERMISSIONS.UPDATE)
  toggleActive(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.productsService.toggleActive(tenantId, id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(PRODUCT_PERMISSIONS.DELETE)
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.productsService.remove(tenantId, id, userId);
  }
}
