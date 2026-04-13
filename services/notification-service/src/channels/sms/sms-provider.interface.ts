/**
 * SMS provider interface — implementations can use Twilio, local API, etc.
 */
export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
