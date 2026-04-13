import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import { NotificationType } from '@/common/enums';
import { EMAIL_TEMPLATES } from './email-templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('smtp.from', 'CaisseFlow <noreply@caisseflow.com>');

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('smtp.host'),
      port: this.configService.get<number>('smtp.port'),
      secure: this.configService.get<boolean>('smtp.secure'),
      auth: {
        user: this.configService.get<string>('smtp.user'),
        pass: this.configService.get<string>('smtp.password'),
      },
    });
  }

  async send(
    to: string,
    type: NotificationType,
    subject: string,
    textContent: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      const htmlTemplate = EMAIL_TEMPLATES[type] || EMAIL_TEMPLATES.DEFAULT;
      const compiled = Handlebars.compile(htmlTemplate);
      const html = compiled({ ...data, subject, textContent });

      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: textContent,
        html,
      });

      this.logger.debug(`Email sent to ${to} — type: ${type}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`);
    }
  }
}
