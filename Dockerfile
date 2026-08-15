# LifeTrace 后端容器镜像
# 数据库/上传/向量库全部落在 lifetrace/data/，运行时用持久卷挂载到 /app/lifetrace/data
# 真实密钥配置通过 Secret 文件挂载覆盖 /app/lifetrace/config/config.yaml
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LIFETRACE_SERVER__HOST=0.0.0.0 \
    LIFETRACE_SERVER__PORT=8001

# onnxruntime/opencv 运行时依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-runtime.txt ./
RUN pip install --no-cache-dir -r requirements-runtime.txt

COPY lifetrace/ ./lifetrace/

# 构建产物不带本地数据、日志和真实密钥；用占位配置兜底，部署时再覆盖
RUN rm -rf ./lifetrace/data ./lifetrace/logs \
    && find ./lifetrace -name "__pycache__" -type d -exec rm -rf {} + \
    && cp ./lifetrace/config/default_config.yaml ./lifetrace/config/config.yaml \
    && mkdir -p ./lifetrace/data

EXPOSE 8001

CMD ["python", "-m", "lifetrace.server"]
