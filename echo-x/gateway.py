#!/usr/bin/env python3
"""
Echo-X Kimi 网关服务
独立运行，用于让浏览器扩展使用 sk-kimi-xxx 类型的 API Key
"""

import os
import sys
import json
import argparse
from typing import Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import threading

# 尝试导入 kimi_agent_sdk
try:
    from kimi_agent_sdk import Config, prompt
    KIMI_SDK_AVAILABLE = True
except ImportError:
    KIMI_SDK_AVAILABLE = False
    print("警告: kimi_agent_sdk 未安装，尝试使用 openai SDK")

# 尝试导入 openai 作为备选
try:
    from openai import OpenAI
    OPENAI_SDK_AVAILABLE = True
except ImportError:
    OPENAI_SDK_AVAILABLE = False


class KimiGateway:
    """Kimi API 网关"""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = base_url or "https://api.kimi.com/coding/v1"
        self.client = None
        
        if api_key.startswith("sk-kimi-"):
            # 使用 Coding 端点
            self.base_url = "https://api.kimi.com/coding/v1"
        
        self._init_client()
    
    def _init_client(self):
        """初始化 API 客户端"""
        if KIMI_SDK_AVAILABLE and self.api_key.startswith("sk-kimi-"):
            # 使用 kimi_agent_sdk
            self.config = Config.model_validate({
                "default_model": "kimi-2.5-coding",
                "providers": {
                    "kimi": {
                        "type": "kimi",
                        "base_url": self.base_url,
                        "api_key": self.api_key,
                    }
                },
                "models": {
                    "kimi-2.5-coding": {
                        "provider": "kimi",
                        "model": "kimi-2.5-coding",
                        "max_context_size": 262144,
                    }
                },
            })
        elif OPENAI_SDK_AVAILABLE:
            # 使用 OpenAI SDK
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
        else:
            raise RuntimeError("需要安装 kimi_agent_sdk 或 openai SDK")
    
    def chat_completions(self, messages: list, model: str = None, **kwargs) -> dict:
        """处理聊天完成请求"""
        model = model or "kimi-2.5-coding"
        
        if self.api_key.startswith("sk-kimi-") and KIMI_SDK_AVAILABLE:
            # 使用同步方式调用 kimi_agent_sdk
            import asyncio
            
            async def _prompt():
                content = messages[-1].get("content", "") if messages else ""
                chunks = []
                async for msg in prompt(content, config=self.config, yolo=True):
                    extract_text = getattr(msg, "extract_text", None)
                    if callable(extract_text):
                        text = extract_text()
                        if text:
                            chunks.append(str(text))
                return "".join(chunks)
            
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(_prompt())
            
            return {
                "id": "chatcmpl-gateway",
                "object": "chat.completion",
                "created": 0,
                "model": model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": result
                    },
                    "finish_reason": "stop"
                }]
            }
        elif self.client:
            # 使用 OpenAI SDK
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                **kwargs
            )
            return {
                "id": response.id,
                "object": "chat.completion",
                "created": response.created,
                "model": response.model,
                "choices": [{
                    "index": choice.index,
                    "message": {
                        "role": choice.message.role,
                        "content": choice.message.content
                    },
                    "finish_reason": choice.finish_reason
                } for choice in response.choices]
            }
        else:
            raise RuntimeError("没有可用的 SDK")
    
    def list_models(self) -> dict:
        """获取模型列表"""
        if self.api_key.startswith("sk-kimi-"):
            # sk-kimi- Key 的固定模型列表
            return {
                "object": "list",
                "data": [
                    {"id": "kimi-2.5-coding", "object": "model"},
                    {"id": "kimi-k2-5", "object": "model"},
                ]
            }
        elif self.client:
            response = self.client.models.list()
            return {
                "object": "list",
                "data": [{"id": m.id, "object": "model"} for m in response.data]
            }
        else:
            return {
                "object": "list",
                "data": [{"id": "kimi-2.5-coding", "object": "model"}]
            }


class GatewayHandler(BaseHTTPRequestHandler):
    """HTTP 请求处理器"""
    
    gateway: Optional[KimiGateway] = None
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[GATEWAY] {self.address_string()} - {format % args}")
    
    def _set_headers(self, status_code: int = 200):
        """设置响应头"""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
    
    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self._set_headers()
    
    def do_GET(self):
        """处理 GET 请求"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/v1/models":
            self._set_headers()
            result = self.gateway.list_models()
            self.wfile.write(json.dumps(result).encode())
        elif parsed_path.path == "/health":
            self._set_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
    
    def do_POST(self):
        """处理 POST 请求"""
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/v1/chat/completions":
            # 读取请求体
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            
            try:
                data = json.loads(body)
                messages = data.get("messages", [])
                model = data.get("model", "kimi-2.5-coding")
                max_tokens = data.get("max_tokens")
                temperature = data.get("temperature", 0.3)
                
                kwargs = {}
                if max_tokens:
                    kwargs["max_tokens"] = max_tokens
                if temperature is not None:
                    kwargs["temperature"] = temperature
                
                result = self.gateway.chat_completions(messages, model, **kwargs)
                
                self._set_headers()
                self.wfile.write(json.dumps(result).encode())
                
            except Exception as e:
                self._set_headers(500)
                error_response = {
                    "error": {
                        "message": str(e),
                        "type": "gateway_error"
                    }
                }
                self.wfile.write(json.dumps(error_response).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())


def main():
    parser = argparse.ArgumentParser(description="Echo-X Kimi Gateway")
    parser.add_argument("--api-key", required=True, help="Kimi API Key")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=9742, help="Port to bind to")
    
    args = parser.parse_args()
    
    # 创建网关实例
    print(f"[INFO] 初始化网关...")
    print(f"[INFO] API Key: {args.api_key[:20]}...")
    
    try:
        gateway = KimiGateway(args.api_key)
        GatewayHandler.gateway = gateway
        print(f"[SUCCESS] 网关初始化成功")
    except Exception as e:
        print(f"[ERROR] 网关初始化失败: {e}")
        sys.exit(1)
    
    # 启动 HTTP 服务器
    server = HTTPServer((args.host, args.port), GatewayHandler)
    print(f"[INFO] 启动网关服务: http://{args.host}:{args.port}")
    print(f"[INFO] 测试地址: http://{args.host}:{args.port}/health")
    print(f"[INFO] 按 Ctrl+C 停止服务")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] 正在停止服务...")
        server.shutdown()


if __name__ == "__main__":
    main()
