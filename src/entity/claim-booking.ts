import {
  BaseEntity,
  Column,
  Entity,
  PrimaryColumn
} from 'typeorm';
import { ClaimState } from '../util/state';

@Entity()
export class ClaimBooking extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    type: 'bigint'
  })
  userId: string;

  @Column({
    type: 'smallint',
    default: 0
  })
  status: ClaimState;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  updatedAt: Date;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  createdAt: number;
}
