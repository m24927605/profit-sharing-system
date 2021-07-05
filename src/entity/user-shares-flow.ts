import {
  BaseEntity,
  Column,
  Entity, PrimaryColumn,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity()
export class UserSharesFlow extends BaseEntity {
  @PrimaryColumn({
    type: 'bigint',
  })
  id: string;

  @Column({
    type: 'bigint',
  })
  userId: string;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false
  })
  invest: string;

  @Column({
    type: 'bigint',
    unsigned: true,
    nullable: false
  })
  withdraw: string;

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
