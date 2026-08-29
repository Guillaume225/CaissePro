/**
 * Push provider interface — implementations send to device tokens (FCM, etc).
 */
export interface PushProvider {
  /**
   * Sends the same notification to a batch of device tokens.
   * Returns the subset of tokens the provider reports as permanently
   * invalid (app uninstalled, token rotated) so callers can prune them.
   */
  send(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<{ invalidTokens: string[] }>;
}

export const PUSH_PROVIDER = 'PUSH_PROVIDER';
