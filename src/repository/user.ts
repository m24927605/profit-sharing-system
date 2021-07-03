import { User } from '../entity/user';

export class UserRepository {
  public async getOne(condition: getOneCondition): Promise<User> {
    const user = await User.findOne(condition);
    return user;
  }
}

type getOneCondition = {
  id: bigint;
}