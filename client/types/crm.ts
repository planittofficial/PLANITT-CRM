export type UserRole = "SUPERADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE" | "INTERN";

export type Department = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  head?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  _count?: {
    users: number;
  };
};

export type ProjectMemberRow = {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    departmentId?: string | null;
  };
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  departmentId: string;
  department: Department;
  owner?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  /** When non-empty, tasks on this project may only be assigned to these users. */
  members?: ProjectMemberRow[];
  progress: number;
  taskCounts: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
  };
};

export type CRMUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  department?: Department | null;
  manager?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  createdAt?: string;
};

export type ChatRoom = {
  id: string;
  type: "DEPARTMENT" | "PROJECT" | "GROUP";
  name: string;
  subtitle: string;
  isDirect?: boolean;
  directPeer?: {
    id: string;
    name: string;
    role: UserRole;
  } | null;
  unreadCount?: number;
  lastMessagePreview?: string;
  lastMessageAt?: string | null;
  department?: Department | null;
};

export type ChatRoomsResponse = {
  departments: ChatRoom[];
  projects: ChatRoom[];
  groups: ChatRoom[];
};

export type ChatGroup = {
  id: string;
  name: string;
  description?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
  };
};

export type ChatGroupMember = {
  id: string;
  groupId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  channelType: ChatRoom["type"];
  departmentId?: string | null;
  projectId?: string | null;
  groupId?: string | null;
  messageType: "TEXT" | "IMAGE" | "PDF" | "STICKER";
  content: string;
  attachmentUrl?: string | null;
  attachmentMimeType?: string | null;
  attachmentFileName?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  replyTo?: {
    id: string;
    content: string;
    messageType: "TEXT" | "IMAGE" | "PDF" | "STICKER";
    attachmentFileName?: string | null;
    isDeleted?: boolean;
    author: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  } | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
};

export type ChatAttachmentUploadResponse = {
  messageType: "IMAGE" | "PDF" | "STICKER";
  attachmentUrl: string;
  attachmentMimeType: string;
  attachmentFileName: string;
  size: number;
};

export type ChatMediaTypeFilter = "ALL" | "IMAGE" | "PDF";

export type AssignedUser = {
  id: string;
  name: string;
  role: UserRole;
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  deadlineAt?: string | null;
  assignedById?: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  priority: TaskPriority;
  progress: number;
  createdAt?: string;
  assignments: Array<{
    id: string;
    userId: string;
      user: AssignedUser;
  }>;
  checklistItems: Array<{
    id: string;
    title: string;
    completed: boolean;
    completedAt?: string | null;
  }>;
  issues: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    managerResponse?: string | null;
    reporter: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
    resolvedBy?: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    } | null;
    createdAt?: string;
  }>;
};

export type LeaveStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "MORE_INFORMATION"
  | "ALTERNATIVE_SUGGESTED"
  | "CANCELLED";

export type LeaveType = {
  id: string;
  name: string;
  description?: string | null;
};

export type LeaveComment = {
  id: string;
  message: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
};

export type LeaveRequest = {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  manager?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string | null;
  attachmentUrl?: string | null;
  status: LeaveStatus;
  requestedAt: string;
  updatedAt: string;
  comments?: LeaveComment[];
};

export type AdminDashboardSummary = {
  scope: "superadmin" | "admin";
  metrics: {
    totalEmployees: number;
    totalInterns: number;
    totalTasks: number;
    completedTasks: number;
    activeAttendance: number;
    checkedIn: boolean;
    totalDepartments: number;
    totalManagers: number;
  };
  departmentBreakdown: Department[];
  departmentPerformance: Array<{
    departmentId: string;
    departmentName: string;
    totalAssigned: number;
    completed: number;
    averageProgress: number;
  }>;
  rolePerformance: Array<{
    role: UserRole;
    totalAssigned: number;
    completed: number;
    averageProgress: number;
  }>;
  recentTasks: Task[];
  analytics: {
    attendanceHeatmap: Array<{
      date: string;
      label: string;
      value: number;
      intensity: number;
    }>;
    workingHoursTrend: Array<{
      date: string;
      label: string;
      hours: number;
    }>;
    taskProgressTrend: Array<{
      date: string;
      label: string;
      created: number;
      completed: number;
      avgProgress: number;
    }>;
    updatesFeed: Array<{
      id: string;
      title: string;
      message: string;
      authorName: string;
      authorRole: UserRole;
      taskTitle?: string | null;
      reporterName?: string | null;
      createdAt: string;
    }>;
    superAdmin: null | {
      departmentWise: Array<{
        departmentId: string;
        departmentName: string;
        members: number;
        managers: number;
        interns: number;
        totalProjects: number;
        totalTasks: number;
        completedTasks: number;
        pendingTasks: number;
        completionRate: number;
        avgProgress: number;
        activeAttendance: number;
        avgWorkingHours: number;
        openIssues: number;
      }>;
      organizationHealth: {
        totalProjects: number;
        projectToTaskRatio: number;
        taskCompletionRate: number;
        liveAttendanceRate: number;
        openIssues: number;
        avgDepartmentProgress: number;
      };
    };
  };
};

export type EmployeeDashboardSummary = {
  scope: "employee";
  metrics: {
    myTasks: number;
    completedTasks: number;
    pendingTasks: number;
    checkedIn: boolean;
  };
  recentTasks: Task[];
  analytics: {
    attendanceHeatmap: Array<{
      date: string;
      label: string;
      value: number;
      intensity: number;
    }>;
    workingHoursTrend: Array<{
      date: string;
      label: string;
      hours: number;
    }>;
    taskProgressTrend: Array<{
      date: string;
      label: string;
      created: number;
      completed: number;
      avgProgress: number;
    }>;
    updatesFeed: Array<{
      id: string;
      title: string;
      message: string;
      authorName: string;
      authorRole: UserRole;
      taskTitle?: string | null;
      reporterName?: string | null;
      createdAt: string;
    }>;
  };
};

export type DashboardSummary = AdminDashboardSummary | EmployeeDashboardSummary;

export type GoogleWorkspaceStatus = {
  connected: boolean;
  oauthConfigured?: boolean;
  setupRequired?: boolean;
  setupMessage?: string;
  workspaceEmail: string | null;
  services: {
    meet: boolean;
    sheets: boolean;
    drive: boolean;
  };
  grantedScopes: string[];
  lastSyncedAt: string | null;
  crmSignals: {
    totalTasks: number;
    openTasks: number;
    totalProjects: number;
    totalDepartments: number;
  };
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    source: string;
    crmUseCase: string;
  }>;
};

export type GoogleMeetSessionResult = {
  service: "meet";
  title: string;
  eventId: string;
  eventUrl: string | null;
  meetUrl: string | null;
  startAt: string;
  endAt: string;
  attendeeCount: number;
  project: {
    id: string;
    name: string;
  } | null;
};

export type GoogleProjectSheetResult = {
  service: "sheets";
  title: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowCount: number;
  project: {
    id: string;
    name: string;
  };
};

export type GoogleDriveFolderResult = {
  service: "drive";
  title: string;
  folderId: string;
  folderUrl: string | null;
  summaryFileId: string;
  summaryFileUrl: string | null;
  project: {
    id: string;
    name: string;
  };
};

export type GoogleDriveUploadResult = {
  service: "drive-upload";
  folderId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  fileUrl: string | null;
  size: number;
  project: {
    id: string;
    name: string;
  } | null;
};

export type UserAnalyticsSummary = {
  user: CRMUser;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    checkedIn: boolean;
    avgProgress: number;
    avgDailyHours: number;
    attendanceDays: number;
  };
  taskStatusBreakdown: Array<{
    label: string;
    value: number;
  }>;
  recentTasks: Task[];
  analytics: {
    attendanceHeatmap: Array<{
      date: string;
      label: string;
      value: number;
      intensity: number;
    }>;
    workingHoursTrend: Array<{
      date: string;
      label: string;
      hours: number;
    }>;
    taskProgressTrend: Array<{
      date: string;
      label: string;
      created: number;
      completed: number;
      avgProgress: number;
    }>;
  };
};

export type BulkUserUploadResult = {
  createdCount: number;
  failedCount: number;
  createdUsers: CRMUser[];
  errors: Array<{
    row: number;
    email: string | null;
    message: string;
  }>;
  expectedColumns: string[];
};

export type ActivityLogItem = {
  id: string;
  userId: string;
  userRole: UserRole;
  method: string;
  path: string;
  statusCode: number;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadataJson?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
};

export type ActivityLogsResponse = {
  items: ActivityLogItem[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
};
