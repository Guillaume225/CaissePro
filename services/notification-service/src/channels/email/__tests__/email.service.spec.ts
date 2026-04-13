import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@/channels/email/email.service';
import { NotificationType } from '@/common/enums';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let nodemailer: { createTransport: jest.Mock };

  beforeEach(async () => {
    nodemailer = (await import('nodemailer')) as unknown as {
      createTransport: jest.Mock;
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              const map: Record<string, unknown> = {
                'smtp.host': 'smtp.test.com',
                'smtp.port': 587,
                'smtp.secure': false,
                'smtp.user': 'test@test.com',
                'smtp.password': 'password',
                'smtp.from': 'CaisseFlow <noreply@test.com>',
              };
              return map[key] ?? defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('should create transporter on init', () => {
    expect(nodemailer.createTransport).toHaveBeenCalled();
  });

  it('should send email with HTML template', async () => {
    await service.send(
      'user@test.com',
      NotificationType.EXPENSE_APPROVED,
      'Dépense approuvée',
      'Votre dépense a été approuvée',
      { reference: 'DEP-001', amount: 5000, approverName: 'Boss' },
    );

    const transporter = nodemailer.createTransport();
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Dépense approuvée',
        html: expect.stringContaining('DEP-001'),
      }),
    );
  });

  it('should not throw on send failure', async () => {
    const transporter = nodemailer.createTransport();
    transporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

    await expect(
      service.send('bad@test.com', NotificationType.BUDGET_ALERT, 'Alert', 'text', {}),
    ).resolves.not.toThrow();
  });
});
