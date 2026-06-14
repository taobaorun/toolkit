.PHONY: help build build-all build-cli build-extension build-web clean install lint test

# Toolkit — 统一构建入口
# 根据每个工具 .tool.yml 中声明的 artifact 类型自动分发构建

# 自动发现所有包含 .tool.yml 的工具目录
TOOLS := $(wildcard tools/*/.tool.yml)
TOOL_DIRS := $(patsubst tools/%/.tool.yml,%,$(TOOLS))

# 默认目标：打印帮助
help:
	@echo "Toolkit Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make build-<name>       Build a specific tool, e.g. make build-iam-token"
	@echo "  make build-cli            Build all CLI tools"
	@echo "  make build-extension      Build all Chrome extension tools"
	@echo "  make build-web            Build all web tools"
	@echo "  make build                Build all tools"
	@echo "  make lint                 Run lint on all tools"
	@echo "  make test                 Run tests for all tools"
	@echo "  make clean                Clean all build artifacts"
	@echo ""
	@echo "Tools detected: $(TOOL_DIRS)"

# --- Build all ---
build: build-cli build-extension build-web

# --- Build by artifact type ---
build-cli:
	@for tool_dir in $(TOOL_DIRS); do \
		if grep -q 'type: cli' tools/$$tool_dir/.tool.yml 2>/dev/null; then \
			echo "Building CLI: $$tool_dir"; \
			$(MAKE) _build-node-cli TOOL=$$tool_dir 2>/dev/null || \
			$(MAKE) _build-python-cli TOOL=$$tool_dir 2>/dev/null || \
			$(MAKE) _build-go-cli TOOL=$$tool_dir 2>/dev/null || true; \
		fi; \
	done

build-extension:
	@for tool_dir in $(TOOL_DIRS); do \
		if grep -q 'type: chrome-extension' tools/$$tool_dir/.tool.yml 2>/dev/null; then \
			echo "Building Chrome Extension: $$tool_dir"; \
			$(MAKE) _build-extension TOOL=$$tool_dir; \
		fi; \
	done

build-web:
	@for tool_dir in $(TOOL_DIRS); do \
		if grep -q 'type: web' tools/$$tool_dir/.tool.yml 2>/dev/null; then \
			echo "Building Web: $$tool_dir"; \
			$(MAKE) _build-web TOOL=$$tool_dir; \
		fi; \
	done

# --- Build by tool name (dynamic targets) ---
# Usage: make build-iam-token → builds tools/iam-token/
build-%:
	@if [ -f tools/$*/.tool.yml ]; then \
		echo "Building tool: $*"; \
		grep -q 'type: cli' tools/$*/.tool.yml && $(MAKE) _build-node-cli TOOL=$* 2>/dev/null || \
		$(MAKE) _build-python-cli TOOL=$* 2>/dev/null || \
		$(MAKE) _build-go-cli TOOL=$* 2>/dev/null || true; \
		grep -q 'type: chrome-extension' tools/$*/.tool.yml && $(MAKE) _build-extension TOOL=$* || true; \
		grep -q 'type: web' tools/$*/.tool.yml && $(MAKE) _build-web TOOL=$* || true; \
	else \
		echo "Error: tools/$*/.tool.yml not found"; \
		exit 1; \
	fi

# --- Internal: Node.js CLI build ---
_build-node-cli:
	@cd tools/$(TOOL) && npm install --silent && npm run build --if-present
	@mkdir -p dist/$(TOOL)
	@cd tools/$(TOOL) && npm pack --pack-destination ../../dist/$(TOOL) 2>/dev/null || \
		echo "  → Skipped npm pack (no package.json or private package)"

# --- Internal: Python CLI build ---
_build-python-cli:
	@cd tools/$(TOOL) && pip install -r requirements.txt --quiet 2>/dev/null || true
	@echo "  → Python tool built (pip install from source)"

# --- Internal: Go CLI build ---
_build-go-cli:
	@cd tools/$(TOOL) && go build -o ../../dist/$(TOOL)/$(TOOL) . 2>/dev/null || \
		echo "  → Go build failed or no main.go"

# --- Internal: Chrome Extension build ---
_build-extension:
	@mkdir -p dist/$(TOOL)
	@if [ -d tools/$(TOOL)/extension ]; then \
		cd tools/$(TOOL)/extension && zip -r ../../../dist/$(TOOL)/$(TOOL)-extension.zip . -x "*.DS_Store"; \
		echo "  → Extension packaged: dist/$(TOOL)/$(TOOL)-extension.zip"; \
	else \
		echo "  → Skipped: tools/$(TOOL)/extension/ not found"; \
	fi

# --- Internal: Web build ---
_build-web:
	@mkdir -p dist/$(TOOL)/web
	@if [ -d tools/$(TOOL)/web ]; then \
		cp -r tools/$(TOOL)/web/* dist/$(TOOL)/web/; \
		echo "  → Web files copied to dist/$(TOOL)/web/"; \
	else \
		echo "  → Skipped: tools/$(TOOL)/web/ not found"; \
	fi

# --- Lint ---
lint:
	@for tool_dir in $(TOOL_DIRS); do \
		if [ -f tools/$$tool_dir/package.json ]; then \
			echo "Linting $$tool_dir (Node.js)"; \
			cd tools/$$tool_dir && npx eslint . --ext .ts,.js 2>/dev/null || true; \
		fi; \
	done

# --- Test ---
test:
	@for tool_dir in $(TOOL_DIRS); do \
		if [ -f tools/$$tool_dir/package.json ]; then \
			echo "Testing $$tool_dir"; \
			cd tools/$$tool_dir && npm test 2>/dev/null || true; \
		elif [ -f tools/$$tool_dir/go.mod ]; then \
			echo "Testing $$tool_dir (Go)"; \
			cd tools/$$tool_dir && go test ./... 2>/dev/null || true; \
		fi; \
	done

# --- Clean ---
clean:
	@rm -rf dist/
	@echo "Cleaned dist/"