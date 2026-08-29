import { registerDecorator, ValidationOptions } from 'class-validator';

const UUID_LOOSE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function IsUUID(
  _versionOrOptions?: string | ValidationOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  const opts = typeof _versionOrOptions === 'object' ? _versionOrOptions : validationOptions;
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: 'isUuidLoose',
      target: object.constructor,
      propertyName: propertyName as string,
      options: opts,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && UUID_LOOSE.test(value);
        },
        defaultMessage() {
          return `${String(propertyName)} must be a UUID`;
        },
      },
    });
  };
}
