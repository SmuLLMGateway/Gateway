import { AdminResDTO } from '../dto/admin.response.dto.js';

export class AdminMapper {
  static toDashboard(data: Readonly<AdminResDTO.Dashboard>): AdminResDTO.Dashboard {
    return { ...data };
  }

  static toAdminLog(
    title: string,
    activityAt: string,
    adminName: string,
  ): AdminResDTO.AdminLog {
    return { title, activityAt, adminName };
  }

  static toPolicyDetect(
    category: string,
    detailCategory: string,
    count: number,
  ): AdminResDTO.PolicyDetect {
    return { category, detailCategory, count };
  }

  static toDepartmentRisk(
    departmentName: string,
    llmRequestCnt: number,
    userCnt: number,
    detectRate: number,
  ): AdminResDTO.DepartmentRisk {
    return { departmentName, llmRequestCnt, userCnt, detectRate };
  }

  static toUserSummary(
    updatedAt: string,
    totalUserCnt: number,
    activateUserCnt: number,
    disabledUserCnt: number,
    newUserCnt: number,
  ): AdminResDTO.UserSummary {
    return {
      updatedAt,
      totalUserCnt,
      activateUserCnt,
      disabledUserCnt,
      newUserCnt,
    };
  }

  static toUserListItem(data: Readonly<AdminResDTO.UserListItem>): AdminResDTO.UserListItem {
    return { ...data };
  }

  static toUserList(
    data: AdminResDTO.UserListItem[],
    totalCnt: number,
    dataCnt: number,
    filteringCnt: number | null,
    pageNumber: number,
  ): AdminResDTO.UserList {
    return { data: [...data], totalCnt, dataCnt, filteringCnt, pageNumber };
  }

  static toUserDetail(data: Readonly<AdminResDTO.UserDetail>): AdminResDTO.UserDetail {
    return { ...data };
  }

  static toDisableUser(name: string, disabledAt: string): AdminResDTO.DisableUser {
    return { name, disabledAt };
  }

  static toRestoreUser(name: string, restoredAt: string): AdminResDTO.RestoreUser {
    return { name, restoredAt };
  }

  static toLogsSummary(
    updatedAt: string,
    totalChatCnt: number,
    filterDetectCnt: number,
    masking: number,
    local: number,
  ): AdminResDTO.LogsSummary {
    return { updatedAt, totalChatCnt, filterDetectCnt, masking, local };
  }

  static toDetecting(
    sensitiveCnt: number,
    privateCnt: number,
  ): AdminResDTO.Detecting {
    return { sensitiveCnt, privateCnt };
  }

  static toLogListItem(data: Readonly<AdminResDTO.LogListItem>): AdminResDTO.LogListItem {
    return { ...data };
  }

  static toLogList(
    data: AdminResDTO.LogListItem[],
    totalCnt: number,
    dataCnt: number,
    filteringCnt: number | null,
    pageNumber: number,
  ): AdminResDTO.LogList {
    return { data: [...data], totalCnt, dataCnt, filteringCnt, pageNumber };
  }

  static toUnknown<T>(result: T): T {
    return result;
  }
}
