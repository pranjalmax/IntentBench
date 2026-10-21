FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e

ARG CODEX_VERSION=0.150.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "@openai/codex@${CODEX_VERSION}" \
    && test "$(codex --version)" = "codex-cli ${CODEX_VERSION}"

RUN mkdir -p /opt/intentbench-seed /opt/intentbench-image-canary \
    && printf '%s\n' \
      '{' \
      '  "name": "intentbench-linux-dependencies",' \
      '  "private": true,' \
      '  "devDependencies": {' \
      '    "typescript": "6.0.3",' \
      '    "vitest": "4.1.11"' \
      '  }' \
      '}' > /opt/intentbench-seed/package.json \
    && cd /opt/intentbench-seed \
    && npm install --ignore-scripts --no-audit --no-fund --package-lock=false \
    && mv node_modules /opt/intentbench-node_modules \
    && cd / \
    && rm -rf /opt/intentbench-seed \
    && printf '%s\n' 'INTENTBENCH_SYNTHETIC_IMAGE_CANARY' > /opt/intentbench-image-canary/private-canary.txt \
    && git config --system --add safe.directory /workspace

RUN useradd --create-home --uid 10001 --shell /bin/sh intentbench \
    && mkdir -p /workspace /intentbench-auth /intentbench-output /codex-home \
    && chown -R intentbench:intentbench /workspace /intentbench-output /codex-home

COPY entrypoint.sh /usr/local/bin/intentbench-entrypoint
RUN chmod 0755 /usr/local/bin/intentbench-entrypoint

USER intentbench
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/intentbench-entrypoint"]
