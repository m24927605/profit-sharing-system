import { UniqueID } from 'nodejs-snowflake';

export class UtilService{
  public static genUniqueId(): string {
    return new UniqueID({ returnNumber: true }).getUniqueID().toString();
  }
}