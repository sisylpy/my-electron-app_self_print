/**
 * OCR 订单识别任务队列管理工具
 * 实现异步任务队列、并发控制、状态持久化
 */

const STORAGE_KEY = 'simpleTaskList';
const MAX_CONCURRENT = 2; // 最大并发数（写死）

// File对象内存缓存（因为File对象无法序列化到localStorage）
const fileCache = new Map();

/**
 * 任务状态
 */
const TASK_STATUS = {
  PENDING: 'pending',    // 待执行
  RUNNING: 'running',    // 执行中
  COMPLETED: 'completed', // 已完成
  FAILED: 'failed'       // 失败
};

/**
 * 任务类型
 */
const TASK_TYPE = {
  IMAGE: 'image',
  EXCEL: 'excel'
};

/**
 * 从 localStorage 加载任务列表
 * 若存在上次未关闭留下的 RUNNING 任务，视为过期，改为 FAILED，避免执行器定时器空转打日志
 */
function loadTasks() {
  try {
    const tasksStr = localStorage.getItem(STORAGE_KEY);
    if (tasksStr) {
      const tasks = JSON.parse(tasksStr);
      if (Array.isArray(tasks)) {
        let changed = false;
        tasks.forEach(t => {
          if (t.status === TASK_STATUS.RUNNING) {
            t.status = TASK_STATUS.FAILED;
            changed = true;
          }
        });
        if (changed) {
          saveTasks(tasks);
          console.log('🔄 [taskQueue] 已将上次未完成的 RUNNING 任务标记为 FAILED');
        }
        return tasks;
      }
    }
  } catch (error) {
    console.error('加载任务列表失败:', error);
  }
  return [];
}

/**
 * 保存任务列表到 localStorage
 */
function saveTasks(tasks) {
  try {
    if (tasks && tasks.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('保存任务列表失败:', error);
  }
}

/**
 * 创建任务对象
 * @param {Object} taskInfo - 任务信息
 * @param {string} taskInfo.depId - 部门ID
 * @param {string} taskInfo.depFatherId - 父部门ID
 * @param {string} taskInfo.depName - 部门名称
 * @param {string} taskInfo.type - 任务类型 ('image' | 'excel')
 * @param {Array} taskInfo.imageList - 图片列表（图片任务需要）
 * @param {Object} taskInfo.excelFile - Excel文件（Excel任务需要）
 * @returns {Object} 任务对象
 */
function createTask(taskInfo) {
  const taskId = `${Date.now()}_${taskInfo.depId}`;
  
  // 如果 excelFile 是 File 对象，保存到内存缓存中，任务对象中保存文件基本信息
  let excelFileInfo = null;
  if (taskInfo.excelFile instanceof File) {
    fileCache.set(taskId, taskInfo.excelFile);
    // 保存文件基本信息到任务对象中（可以序列化）
    excelFileInfo = {
      name: taskInfo.excelFile.name,
      size: taskInfo.excelFile.size,
      type: taskInfo.excelFile.type,
      lastModified: taskInfo.excelFile.lastModified
    };
    console.log(`💾 [taskQueue] File对象已保存到缓存: ${taskId}`, taskInfo.excelFile.name);
  } else if (taskInfo.excelFile) {
    // 如果不是File对象，直接使用（兼容旧数据）
    excelFileInfo = taskInfo.excelFile;
  }
  
  // ✅ 如果任务信息中包含预览数据，保存到 excelFile 对象中
  if (taskInfo.excelPreview && excelFileInfo) {
    excelFileInfo.preview = JSON.parse(JSON.stringify(taskInfo.excelPreview));
    console.log(`💾 [taskQueue] 预览数据已保存到任务对象: ${taskId}`, {
      fileName: excelFileInfo.name,
      sheetsCount: taskInfo.excelPreview.sheets?.length || 0
    });
  }
  
  return {
    taskId: taskId,
    depId: taskInfo.depId,
    depFatherId: taskInfo.depFatherId,
    depName: taskInfo.depName,
    type: taskInfo.type,
    status: TASK_STATUS.PENDING,
    imageList: taskInfo.imageList || null,
    excelFile: excelFileInfo, // 保存文件基本信息（可能包含预览数据）
    disId: taskInfo.disId || null,
    userId: taskInfo.userId || null,
    createdAt: Date.now()
  };
}

/**
 * 检查指定部门是否有进行中的任务
 * @param {string} depId - 部门ID
 * @returns {boolean} 是否有进行中的任务
 */
function hasActiveTask(depId) {
  const tasks = loadTasks();
  return tasks.some(task => 
    String(task.depId) === String(depId) && 
    (task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.RUNNING)
  );
}

/**
 * 添加任务到队列
 * @param {Object} taskInfo - 任务信息
 * @returns {string|null} 任务ID，如果添加失败返回null
 */
function addTask(taskInfo) {
  console.log('📝 [taskQueue] addTask 被调用，任务信息:', {
    depId: taskInfo.depId,
    depFatherId: taskInfo.depFatherId,
    depName: taskInfo.depName,
    disId: taskInfo.disId,
    userId: taskInfo.userId,
    type: taskInfo.type
  });
  
  // 检查是否已有相同部门的进行中任务
  if (hasActiveTask(taskInfo.depId)) {
    console.warn(`部门 ${taskInfo.depId} 已有进行中的任务`);
    return null;
  }

  // 创建任务对象
  const task = createTask(taskInfo);
  
  console.log('📦 [taskQueue] 创建的任务对象:', {
    taskId: task.taskId,
    depId: task.depId,
    depFatherId: task.depFatherId,
    depName: task.depName,
    disId: task.disId,
    userId: task.userId,
    status: task.status
  });

  // 添加到任务列表
  const tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);

  console.log('✅ [taskQueue] 任务已添加:', task.taskId);

  // 不在这里执行任务，由任务执行器统一处理
  // executeTasks();

  return task.taskId;
}

/**
 * 获取运行中的任务数量
 * @returns {number} 运行中的任务数量
 */
function getRunningCount() {
  const tasks = loadTasks();
  return tasks.filter(task => task.status === TASK_STATUS.RUNNING).length;
}

/**
 * 获取待执行的任务
 * @returns {Object|null} 待执行的任务
 */
function getPendingTask() {
  const tasks = loadTasks();
  return tasks.find(task => task.status === TASK_STATUS.PENDING) || null;
}

/**
 * 更新任务状态
 * @param {string} taskId - 任务ID
 * @param {string} status - 新状态
 */
function updateTaskStatus(taskId, status) {
  const tasks = loadTasks();
  const task = tasks.find(t => t.taskId === taskId);
  if (task) {
    task.status = status;
    saveTasks(tasks);
    console.log(`✅ [taskQueue] 任务 ${taskId} 状态更新为: ${status}`);
  }
}

/**
 * 从任务列表中移除任务
 * @param {string} taskId - 任务ID
 */
function removeTask(taskId) {
  const tasks = loadTasks();
  const filteredTasks = tasks.filter(t => t.taskId !== taskId);
  saveTasks(filteredTasks);
  console.log(`✅ [taskQueue] 任务 ${taskId} 已移除`);
}

/**
 * 执行任务（并发控制）
 * 这个方法会被外部调用，用于执行任务队列中的任务
 * 实际的API调用逻辑由外部传入的 executor 函数处理
 */
function executeTasks() {
  // 检查是否已达到最大并发数
  const runningCount = getRunningCount();
  if (runningCount >= MAX_CONCURRENT) {
    console.log(`⏸️ [taskQueue] 已达到最大并发数 ${MAX_CONCURRENT}，等待中...`);
    return null;
  }

  // 查找待执行的任务
  const pendingTask = getPendingTask();
  if (!pendingTask) {
    console.log('✅ [taskQueue] 没有待执行的任务');
    return null;
  }

  // 更新任务状态为 running
  updateTaskStatus(pendingTask.taskId, TASK_STATUS.RUNNING);
  
  // 重新加载任务列表，获取更新后的任务对象
  const tasks = loadTasks();
  const updatedTask = tasks.find(t => t.taskId === pendingTask.taskId);
  
  if (!updatedTask) {
    console.error(`❌ [taskQueue] 任务 ${pendingTask.taskId} 更新后未找到`);
    return null;
  }
  
  // 检查任务对象的完整性
  console.log(`🚀 [taskQueue] 开始执行任务: ${updatedTask.taskId}`, {
    taskId: updatedTask.taskId,
    type: updatedTask.type,
    depId: updatedTask.depId,
    hasImageList: !!updatedTask.imageList,
    imageListLength: updatedTask.imageList ? updatedTask.imageList.length : 0,
    hasExcelFile: !!updatedTask.excelFile,
    excelFileType: updatedTask.excelFile ? typeof updatedTask.excelFile : 'null'
  });
  
  // 确保任务类型正确
  if (!updatedTask.type) {
    console.error(`❌ [taskQueue] 任务 ${updatedTask.taskId} 类型丢失！`, updatedTask);
    // 尝试从任务对象推断类型
    if (updatedTask.imageList && updatedTask.imageList.length > 0) {
      updatedTask.type = TASK_TYPE.IMAGE;
      console.warn(`⚠️ [taskQueue] 推断任务类型为IMAGE`);
    } else if (updatedTask.excelFile) {
      updatedTask.type = TASK_TYPE.EXCEL;
      console.warn(`⚠️ [taskQueue] 推断任务类型为EXCEL`);
    } else {
      console.error(`❌ [taskQueue] 无法推断任务类型，任务对象:`, updatedTask);
      return null;
    }
  }
  
  // 返回更新后的任务对象，由外部调用者执行实际的API调用
  return updatedTask;
}

/**
 * 获取任务的File对象（从内存缓存）
 * @param {string} taskId - 任务ID
 * @returns {File|null} File对象
 */
function getTaskFile(taskId) {
  const file = fileCache.get(taskId);
  if (file) {
    console.log(`✅ [taskQueue] 从缓存获取File对象: ${taskId}`, file.name);
  } else {
    console.warn(`⚠️ [taskQueue] 缓存中没有File对象: ${taskId}，缓存大小: ${fileCache.size}`);
  }
  return file || null;
}

/**
 * 完成任务
 * @param {string} taskId - 任务ID
 */
function completeTask(taskId) {
  updateTaskStatus(taskId, TASK_STATUS.COMPLETED);
  removeTask(taskId);
  // 清理File对象缓存
  fileCache.delete(taskId);
  console.log(`✅ [taskQueue] 任务 ${taskId} 已完成`);
  
  // 不在这里调用 executeTasks()，由 executeNextTask() 在任务完成后自动执行下一个任务
}

/**
 * 任务失败
 * @param {string} taskId - 任务ID
 */
function failTask(taskId) {
  updateTaskStatus(taskId, TASK_STATUS.FAILED);
  removeTask(taskId);
  // 清理File对象缓存
  fileCache.delete(taskId);
  console.log(`❌ [taskQueue] 任务 ${taskId} 已失败`);
  
  // 不在这里调用 executeTasks()，由 executeNextTask() 在任务完成后自动执行下一个任务
}

/**
 * 获取指定部门的任务
 * @param {string} depId - 部门ID
 * @returns {Object|null} 任务对象
 */
function getTaskByDepId(depId) {
  const tasks = loadTasks();
  return tasks.find(task => 
    String(task.depId) === String(depId) &&
    (task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.RUNNING)
  ) || null;
}

/**
 * 获取所有任务列表（用于调试）
 * @returns {Array} 任务列表
 */
function getAllTasks() {
  return loadTasks();
}

export default {
  // 常量
  TASK_STATUS,
  TASK_TYPE,
  MAX_CONCURRENT,
  
  // 方法
  loadTasks,
  saveTasks,
  createTask,
  hasActiveTask,
  addTask,
  getRunningCount,
  getPendingTask,
  updateTaskStatus,
  removeTask,
  executeTasks,
  completeTask,
  failTask,
  getTaskByDepId,
  getAllTasks,
  getTaskFile
};


