/**
 * OCR 任务执行器
 * 负责执行任务队列中的任务，调用API并处理结果
 */

import taskQueue from './taskQueue';
import api from '@/api/all';

/**
 * 执行图片识别任务
 * @param {Object} task - 任务对象
 * @param {Function} onComplete - 任务完成回调 (taskId, result)
 * @param {Function} onFailed - 任务失败回调 (taskId, error)
 */
async function executeImageTask(task, onComplete, onFailed) {
  const taskId = task.taskId;
  
  try {
    console.log(`🚀 [taskExecutor] 开始执行图片任务: ${taskId}`);
    
    const imageList = task.imageList || [];
    
    // 循环处理每张图片
    for (let i = 0; i < imageList.length; i++) {
      const image = imageList[i];
      
      // 检查任务是否被取消
      const currentTask = taskQueue.getTaskByDepId(task.depId);
      if (!currentTask || currentTask.taskId !== taskId || currentTask.status !== taskQueue.TASK_STATUS.RUNNING) {
        console.log(`⏹️ [taskExecutor] 任务 ${taskId} 已取消，退出`);
        return;
      }
      
      // 图片转 Base64（如果已经是 base64，直接使用）
      let imageBase64;
      if (image.base64) {
        imageBase64 = image.base64;
      } else if (image.dataUrl) {
        // 如果是 DataURL，提取 base64 部分
        imageBase64 = image.dataUrl.includes(',') ? image.dataUrl.split(',')[1] : image.dataUrl;
      } else {
        console.error(`❌ [taskExecutor] 图片 ${i} 缺少 base64 数据`);
        continue;
      }
      
      // 调用 OCR API
      const ocrData = {
        ImageBase64: imageBase64,
        depId: task.depId,
        depFatherId: task.depFatherId,
        disId: task.disId,
        userId: task.userId
      };
      
      console.log(`📤 [taskExecutor] 调用 OCR API，图片 ${i + 1}/${imageList.length}`);
      const res = await api.recognizeOrderOCR(ocrData, {
        showLoading: false // 禁用全局蒙板，只显示左侧识别中蒙版
      });
      
      if (res && res.data && res.data.code === 0) {
        const backendTaskId = res.data.taskId;
        const backendTask = res.data.task || null;
        // 检查后端是否已经保存了订单
        if (Array.isArray(res.data.data) && res.data.data.length > 0) {
          console.log(`✅ [taskExecutor] 后台已保存订单，数量: ${res.data.data.length}, taskId: ${backendTaskId}`);
          onComplete(taskId, {
            type: 'saved',
            savedOrders: res.data.data,
            taskId: backendTaskId,
            task: backendTask
          });
          return;
        }

        // 检查后端是否返回了解析后的商品列表（recognizeOrderFast 返回 items）
        const items = res.data.items || (res.data.data && res.data.data.items);

        if (items && items.length > 0) {
          console.log(`✅ [taskExecutor] 识别成功，订单数量: ${items.length}, taskId: ${backendTaskId}`);
          onComplete(taskId, {
            type: 'parsed',
            items: items,
            taskId: backendTaskId,
            task: backendTask
          });
          return;
        }

        // 如果返回成功但没有订单数据，也完成任务（返回空订单数组）
        console.log(`⚠️ [taskExecutor] API返回成功但没有订单数据, taskId: ${backendTaskId}`);
        onComplete(taskId, {
          type: 'parsed',
          items: [],
          taskId: backendTaskId,
          task: backendTask
        });
        return;
      } else {
        const errorMsg = res?.data?.msg || res?.data?.message || '识别失败';
        console.error(`❌ [taskExecutor] API返回错误:`, errorMsg, res);
        throw new Error(errorMsg);
      }
    }
    
    // 如果循环结束但没有返回订单，完成任务（返回空订单数组）
    console.log(`⚠️ [taskExecutor] 所有图片处理完成但没有识别到订单`);
    onComplete(taskId, {
      type: 'parsed',
      items: []
    });
    return;
    
  } catch (error) {
    console.error(`❌ [taskExecutor] 图片任务 ${taskId} 执行失败:`, error);
    onFailed(taskId, error);
  }
}

/**
 * 执行 Excel 识别任务
 * @param {Object} task - 任务对象
 * @param {Function} onComplete - 任务完成回调
 * @param {Function} onFailed - 任务失败回调
 */
async function executeExcelTask(task, onComplete, onFailed) {
  const taskId = task.taskId;
  
  try {
    console.log(`🚀 [taskExecutor] 开始执行 Excel 任务: ${taskId}`, {
      taskId: task.taskId,
      type: task.type,
      depId: task.depId,
      hasExcelFile: !!task.excelFile,
      excelFileType: task.excelFile ? typeof task.excelFile : 'null',
      isFileInstance: task.excelFile instanceof File,
      hasImageList: !!task.imageList,
      imageListLength: task.imageList ? task.imageList.length : 0
    });
    
    // 检查任务是否被取消
    const currentTask = taskQueue.getTaskByDepId(task.depId);
    if (!currentTask || currentTask.taskId !== taskId || currentTask.status !== taskQueue.TASK_STATUS.RUNNING) {
      console.log(`⏹️ [taskExecutor] 任务 ${taskId} 已取消，退出`);
      return;
    }
    
    // 检查任务类型是否正确
    if (task.type !== taskQueue.TASK_TYPE.EXCEL) {
      console.error(`❌ [taskExecutor] 任务 ${taskId} 类型错误，期望EXCEL但实际是:`, task.type);
      throw new Error(`任务类型错误：期望Excel任务，但实际类型是 ${task.type}`);
    }
    
    // 准备 FormData
    const formData = new FormData();
    
    // 从内存缓存中获取File对象
    let fileObj = taskQueue.getTaskFile(taskId);
    
    if (!fileObj) {
      // 如果缓存中没有，尝试从任务对象中获取（兼容旧数据）
      if (task.excelFile instanceof File) {
        fileObj = task.excelFile;
      } else if (task.excelFile && task.excelFile.file instanceof File) {
        fileObj = task.excelFile.file;
      }
    }
    
    if (!fileObj) {
      throw new Error('Excel文件已丢失，请重新上传文件');
    }
    
    formData.append('file', fileObj);
    
    formData.append('depId', task.depId);
    formData.append('depFatherId', task.depFatherId);
    if (task.disId) {
      formData.append('disId', task.disId);
    }
    if (task.userId) {
      formData.append('userId', task.userId);
    }
    
      console.log(`📤 [taskExecutor] 调用 Excel 识别 API`);
      const res = await api.recognizeOrderFromExcel(formData, {
        showLoading: false // 禁用全局loading，只显示左侧蒙版
      });
    
    if (res && res.data && res.data.code === 0) {
      // 检查后端是否已经保存了订单
      if (Array.isArray(res.data.data) && res.data.data.length > 0) {
        console.log(`✅ [taskExecutor] 后台已保存订单，数量: ${res.data.data.length}`);
        onComplete(taskId, {
          type: 'saved',
          savedOrders: res.data.data
        });
        return;
      }
      
      // 检查后端是否返回了解析后的商品列表
      const items = res.data.items || (res.data.data && res.data.data.items);
      
      if (items && items.length > 0) {
        console.log(`✅ [taskExecutor] 识别成功，订单数量: ${items.length}`);
        onComplete(taskId, {
          type: 'parsed',
          items: items
        });
        return;
      }
      
      throw new Error('未返回有效数据');
    } else {
      const errorMsg = res?.data?.msg || res?.data?.message || '识别失败';
      throw new Error(errorMsg);
    }
    
  } catch (error) {
    console.error(`❌ [taskExecutor] Excel 任务 ${taskId} 执行失败:`, error);
    onFailed(taskId, error);
  }
}

/**
 * 启动任务执行器
 * 定期检查任务队列并执行任务
 */
let executorInterval = null;
let onTaskCompleteCallback = null;
let onTaskFailedCallback = null;

function startExecutor(onTaskComplete, onTaskFailed) {
  // 保存回调函数
  onTaskCompleteCallback = onTaskComplete;
  onTaskFailedCallback = onTaskFailed;
  
  // 如果已经启动，不重复启动
  if (executorInterval) {
    return;
  }
  
  // 检查是否有任务
  const tasks = taskQueue.loadTasks();
  const hasTasks = tasks.some(task => 
    task.status === taskQueue.TASK_STATUS.PENDING || 
    task.status === taskQueue.TASK_STATUS.RUNNING
  );
  
  if (!hasTasks) {
    // 没有任务时不启动，但保存回调函数，以便后续有任务时使用
    return;
  }
  
  console.log('🚀 [taskExecutor] 任务执行器已启动');
  
  // 立即执行一次
  executeNextTask();
  
  // 每2秒检查一次任务队列
  executorInterval = setInterval(() => {
    executeNextTask();
  }, 2000);
}

/**
 * 停止任务执行器
 */
function stopExecutor() {
  if (executorInterval) {
    clearInterval(executorInterval);
    executorInterval = null;
    console.log('⏹️ [taskExecutor] 任务执行器已停止');
  }
}

/**
 * 执行下一个任务
 */
async function executeNextTask() {
  // 尝试获取待执行的任务
  const task = taskQueue.executeTasks();
  
  if (!task) {
    // 检查是否还有进行中的任务
    const tasks = taskQueue.loadTasks();
    const hasActiveTasks = tasks.some(t => 
      t.status === taskQueue.TASK_STATUS.PENDING || 
      t.status === taskQueue.TASK_STATUS.RUNNING
    );
    
    // 如果没有进行中的任务，停止执行器（避免定时器空转打日志）
    if (!hasActiveTasks) {
      stopExecutor();
    }
    return; // 没有待执行的任务或已达到并发上限
  }
  
  console.log('🔄 [taskExecutor] 开始执行任务:', task.taskId, task.type);
  
  // 根据任务类型执行
  // 确保任务类型正确，如果类型丢失，尝试从任务对象推断
  let taskType = task.type;
  if (!taskType) {
    // 如果类型丢失，尝试从任务对象推断
    // 优先检查imageList（因为图片数据可以序列化，Excel的File对象不能）
    if (task.imageList && Array.isArray(task.imageList) && task.imageList.length > 0) {
      taskType = taskQueue.TASK_TYPE.IMAGE;
      console.warn(`⚠️ [taskExecutor] 任务 ${task.taskId} 类型丢失，推断为图片任务（基于imageList）`);
    } else if (task.excelFile && task.excelFile instanceof File) {
      // 只有当excelFile是File对象时才推断为Excel任务
      taskType = taskQueue.TASK_TYPE.EXCEL;
      console.warn(`⚠️ [taskExecutor] 任务 ${task.taskId} 类型丢失，推断为Excel任务（基于excelFile）`);
    } else {
      console.error('❌ [taskExecutor] 任务类型丢失且无法推断:', {
        taskId: task.taskId,
        hasImageList: !!task.imageList,
        imageListLength: task.imageList ? task.imageList.length : 0,
        hasExcelFile: !!task.excelFile,
        excelFileType: task.excelFile ? typeof task.excelFile : 'null',
        isFileInstance: task.excelFile instanceof File,
        task: task
      });
      // 如果无法推断，标记任务为失败
      if (onTaskFailedCallback) {
        taskQueue.failTask(task.taskId);
        onTaskFailedCallback(task.taskId, new Error('任务类型丢失且无法推断'), task);
      }
      return;
    }
  }
  
  // 验证任务类型和任务内容是否匹配
  if (taskType === taskQueue.TASK_TYPE.IMAGE) {
    if (!task.imageList || task.imageList.length === 0) {
      console.error(`❌ [taskExecutor] 图片任务 ${task.taskId} 缺少imageList，任务对象:`, task);
      if (onTaskFailedCallback) {
        taskQueue.failTask(task.taskId);
        onTaskFailedCallback(task.taskId, new Error('图片任务缺少图片数据'), task);
      }
      return;
    }
  } else if (taskType === taskQueue.TASK_TYPE.EXCEL) {
    // Excel任务的File对象在缓存中，不在任务对象中
    const fileObj = taskQueue.getTaskFile(task.taskId);
    if (!fileObj) {
      console.error(`❌ [taskExecutor] Excel任务 ${task.taskId} 缺少File对象（缓存中也没有）`, task);
      if (onTaskFailedCallback) {
        taskQueue.failTask(task.taskId);
        onTaskFailedCallback(task.taskId, new Error('Excel文件已丢失，请重新上传文件'), task);
      }
      return;
    }
  }
  
  if (taskType === taskQueue.TASK_TYPE.IMAGE) {
    console.log('📸 [taskExecutor] 准备执行图片任务:', task.taskId);
    await executeImageTask(task, (taskId, result) => {
      taskQueue.completeTask(taskId);
      if (onTaskCompleteCallback) {
        onTaskCompleteCallback(taskId, result, task);
      }
    }, (taskId, error) => {
      taskQueue.failTask(taskId);
      if (onTaskFailedCallback) {
        onTaskFailedCallback(taskId, error, task);
      }
    });
    
    // 任务完成后（无论成功还是失败），立即执行下一个任务
    // 使用 setTimeout 确保回调已经执行完成
    setTimeout(() => {
      executeNextTask();
    }, 0);
  } else if (taskType === taskQueue.TASK_TYPE.EXCEL) {
    console.log('📊 [taskExecutor] 准备执行 Excel 任务:', task.taskId);
    await executeExcelTask(task, (taskId, result) => {
      taskQueue.completeTask(taskId);
      if (onTaskCompleteCallback) {
        onTaskCompleteCallback(taskId, result, task);
      }
    }, (taskId, error) => {
      taskQueue.failTask(taskId);
      if (onTaskFailedCallback) {
        onTaskFailedCallback(taskId, error, task);
      }
    });
    
    // 任务完成后（无论成功还是失败），立即执行下一个任务
    // 使用 setTimeout 确保回调已经执行完成
    setTimeout(() => {
      executeNextTask();
    }, 0);
  } else {
    console.error('❌ [taskExecutor] 未知的任务类型:', taskType, task);
  }
}

/**
 * 检查并启动执行器（如果有任务）
 * 注意：此方法需要在 startExecutor 被调用后才能使用（需要先设置回调函数）
 */
function checkAndStartExecutor() {
  // 如果没有回调函数，说明执行器从未启动过，无法启动
  if (!onTaskCompleteCallback || !onTaskFailedCallback) {
    return;
  }
  
  const tasks = taskQueue.loadTasks();
  const hasTasks = tasks.some(task => 
    task.status === taskQueue.TASK_STATUS.PENDING || 
    task.status === taskQueue.TASK_STATUS.RUNNING
  );
  
  if (hasTasks) {
    // 如果有任务，确保执行器已启动
    if (!executorInterval) {
      startExecutor(onTaskCompleteCallback, onTaskFailedCallback);
    }
    // 如果执行器已启动，不需要手动调用 executeNextTask()
    // 因为定时器会自动处理，避免重复执行
  }
}

export default {
  startExecutor,
  stopExecutor,
  executeImageTask,
  executeExcelTask,
  checkAndStartExecutor
};


