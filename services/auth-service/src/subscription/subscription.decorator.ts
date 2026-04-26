import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'subscription:feature';
export const REQUIRE_LIMIT_KEY = 'subscription:limit';

/**
 * Blocks the route if the tenant's subscription does not include the given feature.
 * Example: @RequireFeature('fne')
 */
export const RequireFeature = (feature: string) => SetMetadata(REQUIRE_FEATURE_KEY, feature);

/**
 * Blocks the route if the tenant has reached the given limit.
 * Example: @RequireLimit('max_users')
 */
export const RequireLimit = (limitName: string) => SetMetadata(REQUIRE_LIMIT_KEY, limitName);
