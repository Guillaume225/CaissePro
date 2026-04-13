export class FileResponseDto {
  id!: string;
  originalName!: string;
  mimeType!: string;
  extension!: string;
  size!: number;
  module!: string;
  entityId!: string | null;
  status!: string;
  uploadedBy!: string;
  thumbnailAvailable!: boolean;
  createdAt!: Date;
}
