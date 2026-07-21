import type { UserRole } from '../../../global/security/type/user-role.enum.js';

export namespace UserData {
  export interface CreateMember {
    memberName: string;
    email: string;
    password: string;
    authorize: UserRole;
    profileUrl: string;
    refreshToken: string | null;
    loginAt: Date;
    createdAt: Date;
    createdBy: string;
    disabledAt: Date | null;
  }

  export interface CreateMemberDepartment {
    memberId: string;
    departmentId: string;
  }

  export interface CreateMemberLimit {
    limit: string;
    memberId: string;
    activeApiKeyId: string;
  }
}
