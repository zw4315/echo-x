#!/usr/bin/env python3
"""测试 Kimi API Key 是否有效"""

import sys
import json
import urllib.request
import urllib.error

API_KEY = "sk-kimi-4FVE5YF2rxbKve2nspB25entMRFxmEjYgD5KGhwMTzXJfuBbHMWgMTANEX6zZie6"

def test_chat_completions():
    """测试 chat completions 接口"""
    print("=== 测试 Chat Completions ===")
    
    url = "https://api.moonshot.cn/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    data = {
        "model": "moonshot-v1-8k",
        "messages": [{"role": "user", "content": "Hello"}],
        "max_tokens": 10
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers=headers,
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"✅ 成功!")
            print(f"状态: {response.status}")
            print(f"模型: {result.get('model')}")
            print(f"回复: {result['choices'][0]['message']['content']}")
            return True
    except urllib.error.HTTPError as e:
        print(f"❌ 失败!")
        print(f"HTTP 状态: {e.code}")
        error_body = e.read().decode('utf-8')
        try:
            error_json = json.loads(error_body)
            print(f"错误: {error_json.get('error', {}).get('message', error_body)}")
        except:
            print(f"错误: {error_body}")
        return False
    except Exception as e:
        print(f"❌ 异常: {e}")
        return False

def test_models():
    """测试 models 接口"""
    print("\n=== 测试 Models ===")
    
    url = "https://api.moonshot.cn/v1/models"
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }
    
    req = urllib.request.Request(url, headers=headers, method='GET')
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"✅ 成功!")
            print(f"状态: {response.status}")
            models = [m['id'] for m in result.get('data', [])]
            print(f"可用模型: {', '.join(models)}")
            return True
    except urllib.error.HTTPError as e:
        print(f"❌ 失败!")
        print(f"HTTP 状态: {e.code}")
        error_body = e.read().decode('utf-8')
        try:
            error_json = json.loads(error_body)
            print(f"错误: {error_json.get('error', {}).get('message', error_body)}")
        except:
            print(f"错误: {error_body}")
        return False
    except Exception as e:
        print(f"❌ 异常: {e}")
        return False

if __name__ == "__main__":
    print(f"API Key: {API_KEY[:20]}...")
    print(f"Key 长度: {len(API_KEY)}\n")
    
    chat_ok = test_chat_completions()
    models_ok = test_models()
    
    print("\n=== 总结 ===")
    if chat_ok:
        print("✅ API Key 有效!")
    else:
        print("❌ API Key 无效或已过期")
        print("\n可能原因:")
        print("1. Key 已被删除或撤销")
        print("2. 账户欠费或需要充值")
        print("3. Key 复制不完整")
        print("\n解决方法:")
        print("1. 登录 https://platform.moonshot.cn/ 检查 Key 状态")
        print("2. 查看账户余额")
        print("3. 重新创建一个新 Key")
