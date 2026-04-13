import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private bucket: string;
  private presignedUrlExpiry: number;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('minio.endpoint')!;
    const accessKey = this.config.get<string>('minio.accessKey')!;
    const secretKey = this.config.get<string>('minio.secretKey')!;
    const region = this.config.get<string>('minio.region')!;

    this.bucket = this.config.get<string>('minio.bucket')!;
    this.presignedUrlExpiry = this.config.get<number>('minio.presignedUrlExpiry')!;

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" ready`);
    } catch {
      this.logger.log(`Creating bucket "${this.bucket}"...`);
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" created`);
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getPresignedDownloadUrl(key: string, filename: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return getSignedUrl(this.s3, command, { expiresIn: this.presignedUrlExpiry });
  }
}
