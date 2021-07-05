import {
  BaseEntity,
  Column,
  Entity, PrimaryColumn,
  PrimaryGeneratedColumn
} from 'typeorm';

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
  status: number;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  updatedAt: number;

  @Column({
    type: 'timestamp',
    readonly: true,
    default: () => 'CURRENT_TIMESTAMP'
  })
  createdAt: number;
}
