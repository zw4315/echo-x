// API 验证器 - 连接本地网关

export interface ApiValidationResult {
  valid: boolean;
  error?: string;
  availableModels?: string[];
  defaultModel?: string;
}

const GATEWAY_URL = 'http://127.0.0.1:9742/v1';

// 检测本地网关是否运行
export async function checkGatewayStatus(): Promise<{
  running: boolean;
  error?: string;
  models?: string[];
}> {
  try {
    const response = await fetch(`${GATEWAY_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer local'  // 本地网关不需要真实 Key
      }
    });

    if (!response.ok) {
      return {
        running: false,
        error: `网关返回错误: HTTP ${response.status}`
      };
    }

    const data = await response.json();
    const models = data.data?.map((m: any) => m.id) || [];
    
    return {
      running: true,
      models
    };
  } catch (error: any) {
    return {
      running: false,
      error: '无法连接到本地网关，请运行 ./setup.sh 启动服务'
    };
  }
}

// 获取模型显示名称
export function getModelDisplayName(modelId: string): string {
  const displayNames: Record<string, string> = {
    'kimi-2.5-coding': 'Kimi 2.5 Coding',
    'kimi-k2-5': 'Kimi K2.5',
    'kimi-k2': 'Kimi K2',
    'kimi-k1-5': 'Kimi K1.5',
    'kimi-latest': 'Kimi 最新版',
    'moonshot-v1-128k': 'Moonshot 128k',
    'moonshot-v1-32k': 'Moonshot 32k',
    'moonshot-v1-8k': 'Moonshot 8k'
  };

  return displayNames[modelId] || modelId;
}

// 获取模型提示信息
export function getModelHint(modelId: string): string {
  const hints: Record<string, string> = {
    'kimi-2.5-coding': 'Kimi Coding 专用模型',
    'kimi-k2-5': '超长上下文，最强推理能力',
    'kimi-k2': '多模态，长文本',
    'kimi-k1-5': '高效平衡',
    'kimi-latest': '自动使用最新模型',
    'moonshot-v1-128k': '128k 上下文',
    'moonshot-v1-32k': '32k 上下文',
    'moonshot-v1-8k': '8k 上下文'
  };

  return hints[modelId] || '';
}
