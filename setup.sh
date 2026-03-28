#!/bin/bash
# Echo-X 完整设置和启动脚本
# 使用 uv 管理 Python 虚拟环境，自动完成所有配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/.venv"
CONFIG_FILE="${SCRIPT_DIR}/config.json"

# 默认配置
GATEWAY_HOST="127.0.0.1"
GATEWAY_PORT="9742"
API_KEY=""

# 打印带颜色的信息
info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# 加载配置文件
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        info "加载配置文件: $CONFIG_FILE"
        
        # 使用 Python 解析 JSON
        API_KEY=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('api_key', ''))" 2>/dev/null || echo "")
        GATEWAY_HOST=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('gateway_host', '127.0.0.1'))" 2>/dev/null || echo "127.0.0.1")
        GATEWAY_PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('gateway_port', 9742))" 2>/dev/null || echo "9742")
        
        if [[ -n "$API_KEY" && "$API_KEY" != "your-kimi-api-key-here" ]]; then
            success "配置加载成功"
            info "  Key: ${API_KEY:0:20}..."
            info "  Host: $GATEWAY_HOST"
            info "  Port: $GATEWAY_PORT"
            return 0
        fi
    fi
    return 1
}

# 创建配置文件模板
create_config_template() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        info "创建配置文件模板..."
        cat > "$CONFIG_FILE" << 'EOF'
{
  "api_key": "your-kimi-api-key-here",
  "gateway_host": "127.0.0.1",
  "gateway_port": 9742
}
EOF
        chmod 600 "$CONFIG_FILE"
    fi
}

# 检查 uv 是否安装
check_uv() {
    if ! command -v uv &> /dev/null; then
        error "未找到 uv，正在安装..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        
        # 尝试加载 uv
        if [[ -f "$HOME/.cargo/env" ]]; then
            source "$HOME/.cargo/env"
        fi
        
        # 检查是否安装成功
        if ! command -v uv &> /dev/null; then
            error "uv 安装失败，请手动安装:"
            error "  curl -LsSf https://astral.sh/uv/install.sh | sh"
            exit 1
        fi
        
        success "uv 安装成功"
    else
        success "uv 已安装: $(uv --version)"
    fi
}

# 创建虚拟环境
setup_venv() {
    header "设置 Python 虚拟环境"
    
    if [[ -d "$VENV_DIR" ]]; then
        info "虚拟环境已存在: $VENV_DIR"
    else
        info "创建虚拟环境..."
        uv venv "$VENV_DIR"
        success "虚拟环境创建成功"
    fi
}

# 安装依赖
install_deps() {
    header "安装依赖"
    
    # 激活虚拟环境
    source "$VENV_DIR/bin/activate"
    
    # 升级 pip
    uv pip install --upgrade pip -q
    
    # 安装 openai SDK（首选，兼容性最好）
    info "安装 openai SDK..."
    uv pip install openai -q
    
    # 尝试安装 kimi-agent-sdk（Python 3.12+）
    PYTHON_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    if [[ "$(printf '%s\n' "3.12" "$PYTHON_VERSION" | sort -V | head -n1)" = "3.12" ]]; then
        info "Python $PYTHON_VERSION >= 3.12，尝试安装 kimi-agent-sdk..."
        uv pip install kimi-agent-sdk -q 2>/dev/null || warn "kimi-agent-sdk 安装失败，使用 openai SDK 作为备选"
    fi
    
    success "依赖安装完成"
}

# 检查端口是否被占用
check_port() {
    if lsof -Pi :${GATEWAY_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        warn "端口 ${GATEWAY_PORT} 已被占用"
        echo -n "是否终止占用进程? [y/N]: "
        read -r kill_proc
        if [[ "$kill_proc" =~ ^[Yy]$ ]]; then
            lsof -Pi :${GATEWAY_PORT} -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
            sleep 1
            success "已释放端口 ${GATEWAY_PORT}"
        else
            error "请修改 config.json 中的 gateway_port"
            exit 1
        fi
    fi
}

# 启动网关
start_gateway() {
    header "启动 Echo-X 网关"
    
    # 检查端口
    check_port
    
    # 激活虚拟环境
    source "$VENV_DIR/bin/activate"
    
    info "启动网关服务..."
    info "  地址: http://${GATEWAY_HOST}:${GATEWAY_PORT}"
    info "  Key: ${API_KEY:0:20}..."
    info "  按 Ctrl+C 停止服务"
    echo ""
    
    # 使用 trap 确保退出时清理
    cleanup() {
        echo ""
        info "正在停止网关服务..."
        exit 0
    }
    trap cleanup INT TERM
    
    # 启动网关
    python3 "${SCRIPT_DIR}/gateway.py" \
        --api-key "$API_KEY" \
        --host "$GATEWAY_HOST" \
        --port "$GATEWAY_PORT"
}

# 显示使用说明
show_usage() {
    cat << 'EOF'

========================================
Echo-X 网关服务使用说明
========================================

1. 配置文件:
   复制 config.json.example 为 config.json:
   
   cp config.json.example config.json
   
   然后编辑 config.json，填入你的 API Key:
   {
     "api_key": "sk-kimi-xxxxxxxxxxxxxxxx",
     "gateway_host": "127.0.0.1",
     "gateway_port": 9742
   }

2. 启动服务:
   ./setup.sh
   
   首次运行会自动:
   - 安装 uv (如未安装)
   - 创建 Python 虚拟环境 (.venv/)
   - 安装依赖
   - 启动网关服务

3. 后续运行:
   直接运行 ./setup.sh 即可

4. 停止服务:
   按 Ctrl+C

5. 浏览器扩展配置:
   - 打开 Echo-X 扩展设置
   - 输入相同的 API Key
   - 验证通过后即可使用

========================================
EOF
}

# 主流程
main() {
    header "Echo-X 设置和启动"
    
    # 检查配置文件
    if ! load_config; then
        create_config_template
        error "请先配置 API Key"
        info ""
        info "1. 复制配置文件模板:"
        info "   cp config.json.example config.json"
        info ""
        info "2. 编辑 config.json，填入你的 API Key"
        info ""
        info "3. 重新运行 ./setup.sh"
        info ""
        exit 1
    fi
    
    # 1. 检查 uv
    check_uv
    
    # 2. 创建虚拟环境
    setup_venv
    
    # 3. 安装依赖
    install_deps
    
    # 4. 启动网关
    start_gateway
}

# 运行主流程
main
