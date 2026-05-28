import prisma from "../config/db.js";
import { sendSafeError } from "../middleware/error.middleware.js";

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLastNDays(dayCount) {
  const days = [];
  const now = new Date();
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - offset);
    days.push(date);
  }
  return days;
}

function toShortLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getDurationHours(checkIn, checkOut) {
  const end = checkOut ? new Date(checkOut) : new Date();
  const start = new Date(checkIn);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
}

function buildWorkingHoursTrend(records, days) {
  const map = new Map();
  for (const day of days) {
    map.set(toDateKey(day), { totalHours: 0, count: 0 });
  }

  for (const record of records) {
    const key = toDateKey(new Date(record.date));
    if (!map.has(key)) {
      continue;
    }
    const bucket = map.get(key);
    bucket.totalHours += getDurationHours(record.checkIn, record.checkOut);
    bucket.count += 1;
  }

  return days.map((day) => {
    const key = toDateKey(day);
    const bucket = map.get(key);
    const hours = bucket.count ? Number((bucket.totalHours / bucket.count).toFixed(2)) : 0;
    return {
      date: key,
      label: toShortLabel(day),
      hours,
    };
  });
}

function buildTaskProgressTrend(tasks, days) {
  const map = new Map();
  for (const day of days) {
    map.set(toDateKey(day), { created: 0, completed: 0, progressSum: 0, progressCount: 0 });
  }

  for (const task of tasks) {
    const createdKey = toDateKey(new Date(task.createdAt));
    if (map.has(createdKey)) {
      map.get(createdKey).created += 1;
    }

    const updatedKey = toDateKey(new Date(task.updatedAt));
    if (map.has(updatedKey)) {
      const updatedBucket = map.get(updatedKey);
      updatedBucket.progressSum += task.progress;
      updatedBucket.progressCount += 1;
      if (task.status === "DONE") {
        updatedBucket.completed += 1;
      }
    }
  }

  return days.map((day) => {
    const key = toDateKey(day);
    const bucket = map.get(key);
    return {
      date: key,
      label: toShortLabel(day),
      created: bucket.created,
      completed: bucket.completed,
      avgProgress: bucket.progressCount
        ? Math.round(bucket.progressSum / bucket.progressCount)
        : 0,
    };
  });
}

function buildAttendanceHeatmap(records, days, denominator = 1, useHours = false) {
  const map = new Map();
  for (const day of days) {
    map.set(toDateKey(day), { count: 0, hours: 0 });
  }

  for (const record of records) {
    const key = toDateKey(new Date(record.date));
    if (!map.has(key)) {
      continue;
    }
    const bucket = map.get(key);
    bucket.count += 1;
    bucket.hours += getDurationHours(record.checkIn, record.checkOut);
  }

  return days.map((day) => {
    const key = toDateKey(day);
    const bucket = map.get(key);
    const value = useHours ? Number(bucket.hours.toFixed(1)) : bucket.count;
    const intensity = useHours
      ? Math.min(100, Math.round((bucket.hours / 10) * 100))
      : Math.min(100, Math.round((bucket.count / Math.max(1, denominator)) * 100));

    return {
      date: key,
      label: toShortLabel(day),
      value,
      intensity,
    };
  });
}

function toPercent(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100);
}

async function runSequentially(tasks) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

async function getLeadershipUpdates(limit = 8) {
  const issues = await prisma.taskIssue.findMany({
    where: {
      managerResponse: {
        not: null,
      },
      resolvedById: {
        not: null,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      task: {
        select: {
          id: true,
          title: true,
        },
      },
      resolvedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      reporter: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return issues.map((issue) => ({
    id: issue.id,
    title: `Task support: ${issue.title}`,
    message: issue.managerResponse,
    authorName: issue.resolvedBy?.name ?? "Leadership",
    authorRole: issue.resolvedBy?.role ?? "MANAGER",
    taskTitle: issue.task?.title ?? null,
    createdAt: issue.updatedAt,
    reporterName: issue.reporter?.name ?? null,
  }));
}

export async function getDashboardSummary(req, res) {
  try {
    const isSuperAdmin = req.user.role === "SUPERADMIN";
    const isAdminView = isSuperAdmin || req.user.role === "ADMIN" || req.user.role === "MANAGER";

    const heatmapDays = getLastNDays(35);
    const trendDays = getLastNDays(14);
    const heatmapStart = heatmapDays[0];
    const trendStart = trendDays[0];

    if (isAdminView) {
      const [
        totalEmployees,
        totalInterns,
        totalTasks,
        completedTasks,
        activeAttendance,
        myActiveAttendance,
        totalDepartments,
        totalManagers,
        departmentBreakdown,
        tasksWithAssignments,
        recentTasks,
        attendanceForHeatmap,
        attendanceForTrend,
        trendTasks,
        updatesFeed,
        departmentUsers,
        projectsWithTasks,
        taskIssues,
        attendanceWithDepartments,
      ] = await runSequentially([
        () => prisma.user.count({
          where: { role: { in: ["EMPLOYEE", "MANAGER", "ADMIN", "SUPERADMIN"] } },
        }),
        () => prisma.user.count({
          where: { role: "INTERN" },
        }),
        () => prisma.task.count(),
        () => prisma.task.count({
          where: { status: "DONE" },
        }),
        () => prisma.attendance.count({
          where: { checkOut: null },
        }),
        () => prisma.attendance.findFirst({
          where: {
            userId: req.user.userId,
            checkOut: null,
          },
          select: { id: true },
        }),
        () => prisma.department.count(),
        () => prisma.user.count({
          where: { role: { in: ["MANAGER", "ADMIN", "SUPERADMIN"] } },
        }),
        () => prisma.department.findMany({
          orderBy: { name: "asc" },
          include: {
            head: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
            _count: {
              select: {
                users: true,
              },
            },
          },
        }),
        () => prisma.task.findMany({
          include: {
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    role: true,
                    departmentId: true,
                  },
                },
              },
            },
          },
        }),
        () => prisma.task.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    role: true,
                  },
                },
              },
            },
            checklistItems: {
              orderBy: { createdAt: "asc" },
            },
            issues: {
              orderBy: { createdAt: "desc" },
              include: {
                reporter: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },
                resolvedBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        }),
        () => prisma.attendance.findMany({
          where: { date: { gte: heatmapStart } },
          select: { date: true, checkIn: true, checkOut: true },
        }),
        () => prisma.attendance.findMany({
          where: { date: { gte: trendStart } },
          select: { date: true, checkIn: true, checkOut: true },
        }),
        () => prisma.task.findMany({
          where: {
            OR: [{ createdAt: { gte: trendStart } }, { updatedAt: { gte: trendStart } }],
          },
          select: { createdAt: true, updatedAt: true, progress: true, status: true },
        }),
        () => getLeadershipUpdates(8),
        () => prisma.user.findMany({
          where: {
            role: { in: ["EMPLOYEE", "INTERN", "MANAGER", "ADMIN"] },
          },
          select: {
            id: true,
            role: true,
            departmentId: true,
          },
        }),
        () => prisma.project.findMany({
          select: {
            id: true,
            departmentId: true,
            tasks: {
              select: {
                status: true,
                progress: true,
              },
            },
          },
        }),
        () => prisma.taskIssue.findMany({
          select: {
            id: true,
            status: true,
            task: {
              select: {
                assignments: {
                  select: {
                    user: {
                      select: {
                        departmentId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        () => prisma.attendance.findMany({
          where: { date: { gte: trendStart } },
          select: {
            date: true,
            checkIn: true,
            checkOut: true,
            user: {
              select: {
                departmentId: true,
              },
            },
          },
        }),
      ]);

      const rolePerformanceMap = new Map();
      const departmentPerformanceMap = new Map();

      for (const task of tasksWithAssignments) {
        for (const assignment of task.assignments) {
          const roleKey = assignment.user.role;
          const existingRole = rolePerformanceMap.get(roleKey) ?? {
            role: roleKey,
            totalAssigned: 0,
            completed: 0,
            averageProgress: 0,
            progressSum: 0,
          };

          existingRole.totalAssigned += 1;
          existingRole.progressSum += task.progress;
          if (task.progress >= 100 || task.status === "DONE") {
            existingRole.completed += 1;
          }
          rolePerformanceMap.set(roleKey, existingRole);

          if (assignment.user.departmentId) {
            const existingDepartment = departmentPerformanceMap.get(assignment.user.departmentId) ?? {
              departmentId: assignment.user.departmentId,
              totalAssigned: 0,
              completed: 0,
              averageProgress: 0,
              progressSum: 0,
            };

            existingDepartment.totalAssigned += 1;
            existingDepartment.progressSum += task.progress;
            if (task.progress >= 100 || task.status === "DONE") {
              existingDepartment.completed += 1;
            }
            departmentPerformanceMap.set(assignment.user.departmentId, existingDepartment);
          }
        }
      }

      const departmentPerformance = departmentBreakdown.map((department) => {
        const stats = departmentPerformanceMap.get(department.id) ?? {
          totalAssigned: 0,
          completed: 0,
          progressSum: 0,
        };

        return {
          departmentId: department.id,
          departmentName: department.name,
          totalAssigned: stats.totalAssigned,
          completed: stats.completed,
          averageProgress: stats.totalAssigned
            ? Math.round(stats.progressSum / stats.totalAssigned)
            : 0,
        };
      });

      const rolePerformance = Array.from(rolePerformanceMap.values()).map((stats) => ({
        role: stats.role,
        totalAssigned: stats.totalAssigned,
        completed: stats.completed,
        averageProgress: stats.totalAssigned
          ? Math.round(stats.progressSum / stats.totalAssigned)
          : 0,
      }));

      const attendanceHeatmap = buildAttendanceHeatmap(
        attendanceForHeatmap,
        heatmapDays,
        Math.max(1, totalEmployees + totalInterns),
        false
      );
      const workingHoursTrend = buildWorkingHoursTrend(attendanceForTrend, trendDays);
      const taskProgressTrend = buildTaskProgressTrend(trendTasks, trendDays);

      const departmentStatsMap = new Map();
      for (const department of departmentBreakdown) {
        departmentStatsMap.set(department.id, {
          departmentId: department.id,
          departmentName: department.name,
          members: 0,
          managers: 0,
          interns: 0,
          totalProjects: 0,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          activeAttendance: 0,
          totalHours: 0,
          attendanceEntries: 0,
          openIssues: 0,
          progressSum: 0,
          progressCount: 0,
        });
      }

      for (const user of departmentUsers) {
        if (!user.departmentId || !departmentStatsMap.has(user.departmentId)) {
          continue;
        }
        const bucket = departmentStatsMap.get(user.departmentId);
        bucket.members += 1;
        if (user.role === "MANAGER" || user.role === "ADMIN") {
          bucket.managers += 1;
        }
        if (user.role === "INTERN") {
          bucket.interns += 1;
        }
      }

      for (const project of projectsWithTasks) {
        if (!departmentStatsMap.has(project.departmentId)) {
          continue;
        }
        const bucket = departmentStatsMap.get(project.departmentId);
        bucket.totalProjects += 1;

        for (const task of project.tasks) {
          bucket.totalTasks += 1;
          bucket.progressSum += task.progress;
          bucket.progressCount += 1;
          if (task.status === "DONE") {
            bucket.completedTasks += 1;
          } else {
            bucket.pendingTasks += 1;
          }
        }
      }

      for (const issue of taskIssues) {
        const departmentIds = Array.from(
          new Set(
            issue.task.assignments
              .map((assignment) => assignment.user.departmentId)
              .filter(Boolean)
          )
        );

        for (const departmentId of departmentIds) {
          if (!departmentStatsMap.has(departmentId)) {
            continue;
          }

          if (issue.status !== "RESOLVED") {
            departmentStatsMap.get(departmentId).openIssues += 1;
          }
        }
      }

      for (const attendance of attendanceWithDepartments) {
        const departmentId = attendance.user?.departmentId;
        if (!departmentId || !departmentStatsMap.has(departmentId)) {
          continue;
        }
        const bucket = departmentStatsMap.get(departmentId);
        bucket.attendanceEntries += 1;
        bucket.totalHours += getDurationHours(attendance.checkIn, attendance.checkOut);
        if (!attendance.checkOut) {
          bucket.activeAttendance += 1;
        }
      }

      const departmentAnalytics = departmentBreakdown.map((department) => {
        const stats = departmentStatsMap.get(department.id);
        return {
          departmentId: department.id,
          departmentName: department.name,
          members: stats.members,
          managers: stats.managers,
          interns: stats.interns,
          totalProjects: stats.totalProjects,
          totalTasks: stats.totalTasks,
          completedTasks: stats.completedTasks,
          pendingTasks: stats.pendingTasks,
          completionRate: toPercent(stats.completedTasks, stats.totalTasks),
          avgProgress: stats.progressCount ? Math.round(stats.progressSum / stats.progressCount) : 0,
          activeAttendance: stats.activeAttendance,
          avgWorkingHours: stats.attendanceEntries
            ? Number((stats.totalHours / stats.attendanceEntries).toFixed(2))
            : 0,
          openIssues: stats.openIssues,
        };
      });

      const totalProjects = departmentAnalytics.reduce((sum, item) => sum + item.totalProjects, 0);
      const openIssues = departmentAnalytics.reduce((sum, item) => sum + item.openIssues, 0);
      const totalMembersForAttendance = departmentAnalytics.reduce((sum, item) => sum + item.members, 0);
      const totalActiveAttendance = departmentAnalytics.reduce((sum, item) => sum + item.activeAttendance, 0);
      const orgAvgProgress = departmentAnalytics.length
        ? Math.round(
            departmentAnalytics.reduce((sum, item) => sum + item.avgProgress, 0) /
              departmentAnalytics.length
          )
        : 0;

      return res.json({
        scope: isSuperAdmin ? "superadmin" : "admin",
        metrics: {
          totalEmployees,
          totalInterns,
          totalTasks,
          completedTasks,
          activeAttendance,
          checkedIn: Boolean(myActiveAttendance),
          totalDepartments,
          totalManagers,
        },
        departmentBreakdown,
        departmentPerformance,
        rolePerformance,
        recentTasks,
        analytics: {
          attendanceHeatmap,
          workingHoursTrend,
          taskProgressTrend,
          updatesFeed,
          superAdmin:
            isSuperAdmin
              ? {
                  departmentWise: departmentAnalytics,
                  organizationHealth: {
                    totalProjects,
                    projectToTaskRatio: totalProjects
                      ? Number((totalTasks / totalProjects).toFixed(2))
                      : 0,
                    taskCompletionRate: toPercent(completedTasks, totalTasks),
                    liveAttendanceRate: toPercent(totalActiveAttendance, totalMembersForAttendance),
                    openIssues,
                    avgDepartmentProgress: orgAvgProgress,
                  },
                }
              : null,
        },
      });
    }

    const [myTasks, completedTasks, pendingTasks, activeAttendance, myRecentTasks, myAttendance, myTrendTasks, updatesFeed] =
      await runSequentially([
        () => prisma.task.count({
          where: {
            assignments: {
              some: {
                userId: req.user.userId,
              },
            },
          },
        }),
        () => prisma.task.count({
          where: {
            status: "DONE",
            assignments: {
              some: {
                userId: req.user.userId,
              },
            },
          },
        }),
        () => prisma.task.count({
          where: {
            status: { in: ["TODO", "IN_PROGRESS"] },
            assignments: {
              some: {
                userId: req.user.userId,
              },
            },
          },
        }),
        () => prisma.attendance.findFirst({
          where: {
            userId: req.user.userId,
            checkOut: null,
          },
          orderBy: { checkIn: "desc" },
        }),
        () => prisma.task.findMany({
          where: {
            assignments: {
              some: {
                userId: req.user.userId,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            assignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    role: true,
                  },
                },
              },
            },
            checklistItems: {
              orderBy: { createdAt: "asc" },
            },
            issues: {
              orderBy: { createdAt: "desc" },
              include: {
                reporter: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },
                resolvedBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        }),
        () => prisma.attendance.findMany({
          where: {
            userId: req.user.userId,
            date: { gte: heatmapStart },
          },
          select: {
            date: true,
            checkIn: true,
            checkOut: true,
          },
        }),
        () => prisma.task.findMany({
          where: {
            assignments: {
              some: {
                userId: req.user.userId,
              },
            },
            OR: [{ createdAt: { gte: trendStart } }, { updatedAt: { gte: trendStart } }],
          },
          select: { createdAt: true, updatedAt: true, progress: true, status: true },
        }),
        () => prisma.taskIssue.findMany({
          where: {
            task: {
              assignments: {
                some: { userId: req.user.userId },
              },
            },
            managerResponse: { not: null },
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: {
            task: {
              select: { title: true },
            },
            resolvedBy: {
              select: { name: true, role: true },
            },
            reporter: {
              select: { name: true },
            },
          },
        }),
      ]);

    const attendanceHeatmap = buildAttendanceHeatmap(myAttendance, heatmapDays, 1, true);
    const workingHoursTrend = buildWorkingHoursTrend(myAttendance, trendDays);
    const taskProgressTrend = buildTaskProgressTrend(myTrendTasks, trendDays);

    return res.json({
      scope: "employee",
      metrics: {
        myTasks,
        completedTasks,
        pendingTasks,
        checkedIn: Boolean(activeAttendance),
      },
      recentTasks: myRecentTasks,
      analytics: {
        attendanceHeatmap,
        workingHoursTrend,
        taskProgressTrend,
        updatesFeed: updatesFeed.map((item) => ({
          id: item.id,
          title: `Update on: ${item.task?.title ?? "Task"}`,
          message: item.managerResponse,
          authorName: item.resolvedBy?.name ?? "Manager",
          authorRole: item.resolvedBy?.role ?? "MANAGER",
          taskTitle: item.task?.title ?? null,
          reporterName: item.reporter?.name ?? null,
          createdAt: item.updatedAt,
        })),
      },
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch dashboard metrics");
  }
}
