import {
  BaseEntity,
  Column,
  Entity, PrimaryColumn,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity()
export class UserSharesBalance extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint',
  })
  userId: string;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false
  })
  balance: string;

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
